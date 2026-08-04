import io
import json
import logging
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Tuple
from difflib import SequenceMatcher

import pandas as pd
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.db.models import Q
from django.http import FileResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.views import APIView

from apps.outlets.models import Outlet
from apps.products.models import Product, Category
from apps.inventory.models import StockTake, StockTakeItem
from apps.products.views import ProductViewSet
from apps.tenants.permissions import HasTenantModuleAccess
from .models import ImportApplyError, ImportAuditEvent, ImportBatch, ImportRowResult, ImportStockMutation
from apps.inventory.stock_helpers import adjust_stock, get_available_stock

logger = logging.getLogger(__name__)


class BaseImportView(APIView):
    permission_classes = [IsAuthenticated, HasTenantModuleAccess]
    required_tenant_permissions = ['allow_inventory', 'allow_inventory_products']

    SYNC_STRATEGY_UPDATE_EXISTING = 'update_existing'
    SYNC_STRATEGY_CREATE_NEW = 'create_new'
    SYNC_STRATEGY_STOCK_ONLY = 'stock_only'
    SYNC_STRATEGY_PRICES_ONLY = 'prices_only'
    SYNC_STRATEGY_FULL_SYNC = 'full_sync'
    SYNC_STRATEGY_CATALOG_ONLY = 'catalog_only'
    SYNC_STRATEGY_COST_ONLY = 'cost_only'
    SYNC_STRATEGY_CHOICES = {
        SYNC_STRATEGY_UPDATE_EXISTING,
        SYNC_STRATEGY_CREATE_NEW,
        SYNC_STRATEGY_STOCK_ONLY,
        SYNC_STRATEGY_PRICES_ONLY,
        SYNC_STRATEGY_FULL_SYNC,
        SYNC_STRATEGY_CATALOG_ONLY,
        SYNC_STRATEGY_COST_ONLY,
    }

    COST_PRICE_METHOD_CHOICES = {'replace', 'average_cost', 'highest_cost', 'lowest_cost', 'ignore'}
    STOCK_UPDATE_METHOD_CHOICES = {'replace_quantity', 'increase', 'decrease', 'stock_count_adjustment', 'ignore'}
    DUPLICATE_PRODUCTS_CHOICES = {'update_existing', 'skip', 'merge', 'review'}
    MISSING_PRODUCTS_CHOICES = {'auto_create', 'skip', 'review_first'}

    def _resolve_tenant(self, request):
        return getattr(request, 'tenant', None) or getattr(request.user, 'tenant', None)

    def _resolve_outlet(self, request, tenant):
        outlet_id = request.headers.get('X-Outlet-ID') or request.query_params.get('outlet') or request.data.get('outlet')
        if not outlet_id:
            return None, Response({'detail': 'Outlet is required for imports.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            outlet = Outlet.objects.get(id=int(outlet_id), tenant=tenant)
            return outlet, None
        except (ValueError, TypeError, Outlet.DoesNotExist):
            return None, Response({'detail': f'Invalid outlet: {outlet_id}'}, status=status.HTTP_400_BAD_REQUEST)

    def _read_csv_from_bytes(self, file_bytes: bytes) -> pd.DataFrame:
        """Read CSV bytes with common encodings and separator inference."""
        decode_errors = []
        for encoding in ('utf-8-sig', 'utf-8', 'latin-1'):
            try:
                text = file_bytes.decode(encoding)
                # sep=None + python engine lets pandas infer comma/semicolon/tab delimiters.
                return pd.read_csv(io.StringIO(text), sep=None, engine='python')
            except Exception as exc:
                decode_errors.append(f'{encoding}: {exc}')

        raise ValueError(f'Unable to parse CSV data ({"; ".join(decode_errors)})')

    def _read_dataframe(self, uploaded_file) -> pd.DataFrame:
        file_name = uploaded_file.name.lower()
        file_bytes = uploaded_file.read()
        uploaded_file.seek(0)

        if file_name.endswith('.csv'):
            return self._read_csv_from_bytes(file_bytes)

        # Try Excel first for .xlsx/.xls uploads.
        try:
            if file_name.endswith('.xlsx'):
                return pd.read_excel(io.BytesIO(file_bytes), engine='openpyxl')
            if file_name.endswith('.xls'):
                # Let pandas choose engine for legacy .xls if available.
                return pd.read_excel(io.BytesIO(file_bytes))

            # Unknown extension: attempt Excel, then fallback to CSV.
            return pd.read_excel(io.BytesIO(file_bytes))
        except Exception as excel_exc:
            # Some users upload CSV files with .xlsx extension; fallback to CSV parsing.
            try:
                return self._read_csv_from_bytes(file_bytes)
            except Exception:
                raise ValueError(
                    'Unsupported file content. Please upload a valid Excel (.xlsx/.xls) '
                    'or CSV (.csv) file. If this is CSV, ensure the extension is .csv.'
                ) from excel_exc

    def _normalize_columns(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, str]]:
        df.columns = df.columns.str.strip()
        column_mapping = {col.lower().replace(' ', '_'): col for col in df.columns}
        return df, column_mapping

    def _build_identity(self, name: str, sku: str, barcode: str) -> str:
        if sku:
            return f'sku:{sku.lower()}'
        if barcode:
            return f'barcode:{barcode.lower()}'
        return f'name:{name.lower()}'

    def _is_effectively_blank_row(self, row) -> bool:
        for value in row.to_dict().values():
            if pd.isna(value):
                continue
            if str(value).strip() != '':
                return False
        return True

    def _resolve_sync_mode(self, request) -> str:
        return str(
            request.headers.get('X-Sync-Mode')
            or request.query_params.get('mode')
            or request.data.get('mode')
            or ''
        ).strip().lower()

    def _resolve_sync_strategy(self, request, *, default=None) -> str:
        raw_value = (
            request.headers.get('X-Sync-Strategy')
            or request.query_params.get('sync_strategy')
            or request.data.get('sync_strategy')
            or default
            or self.SYNC_STRATEGY_FULL_SYNC
        )
        strategy = str(raw_value).strip().lower().replace('-', '_')
        if strategy not in self.SYNC_STRATEGY_CHOICES:
            raise ValueError(
                f"Invalid sync_strategy '{raw_value}'. "
                f"Allowed values: {', '.join(sorted(self.SYNC_STRATEGY_CHOICES))}."
            )
        return strategy

    def _resolve_sync_option(self, request, option_name: str, *, default: str, choices: set[str]) -> str:
        raw_value = request.query_params.get(option_name) or request.data.get(option_name) or default
        value = str(raw_value).strip().lower().replace('-', '_')
        if value not in choices:
            raise ValueError(
                f"Invalid {option_name} '{raw_value}'. Allowed values: {', '.join(sorted(choices))}."
            )
        return value

    def _pick_first_column(self, column_mapping: Dict[str, str], *keys: str) -> str:
        for key in keys:
            if key in column_mapping:
                return column_mapping[key]
        return ''

    def _parse_optional_decimal(self, value, *, min_value=None, zero_is_blank=False):
        if value is None:
            return None, []

        text = str(value).strip()
        if text == '':
            return None, []

        if zero_is_blank and text == '0':
            return None, []

        try:
            decimal_value = Decimal(text)
        except Exception:
            return None, [f'Invalid value: {value}']

        if min_value is not None and decimal_value < Decimal(str(min_value)):
            return None, [f'Value must be at least {min_value}']

        return decimal_value, []

    def _stringify_decimal(self, value):
        if value is None:
            return ''
        return str(value)

    def _coerce_bool_text(self, value, default='yes'):
        if value is None:
            return default
        text = str(value).strip().lower()
        if text in ('', '1', 'true', 'yes', 'y', 'active'):
            return 'yes'
        if text in ('0', 'false', 'no', 'n', 'inactive'):
            return 'no'
        return default

    def _coerce_bool(self, value, default=False):
        if value is None:
            return default
        if isinstance(value, bool):
            return value
        text = str(value).strip().lower()
        if text in ('1', 'true', 'yes', 'y', 'on'):
            return True
        if text in ('0', 'false', 'no', 'n', 'off'):
            return False
        return default

    def _structured_rejection(
        self,
        code: str,
        reason: str,
        resolution: str,
        *,
        field: str = '',
        details: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            'code': code,
            'reason': reason,
            'resolution': resolution,
        }
        if field:
            payload['field'] = field
        if details:
            payload['details'] = details
        return payload

    def _clean_text(self, value: Any) -> str:
        return str(value or '').strip()

    def _normalize_identity(self, name: str, sku: str, barcode: str) -> str:
        if sku:
            return f'sku:{sku.lower()}'
        if barcode:
            return f'barcode:{barcode.lower()}'
        return f'name:{name.lower()}' if name else ''

    def _similarity(self, left: str, right: str) -> float:
        left_value = self._clean_text(left).lower()
        right_value = self._clean_text(right).lower()
        if not left_value or not right_value:
            return 0.0
        return SequenceMatcher(None, left_value, right_value).ratio()

    def _stocktake_item_payload(self, item) -> Dict[str, Any]:
        product = getattr(item, 'product', None)
        return {
            'id': str(item.id),
            'product_id': str(getattr(product, 'id', '') or ''),
            'product_name': getattr(product, 'name', '') or 'Unknown Product',
            'sku': getattr(product, 'sku', '') or '',
            'barcode': getattr(product, 'barcode', '') or '',
            'quantity_before': int(getattr(item, 'expected_quantity', 0) or 0),
        }

    def _match_stocktake_item(self, row_name: str, row_sku: str, row_barcode: str, stocktake_items: List[Dict[str, Any]]):
        normalized_name = self._clean_text(row_name).lower()
        normalized_sku = self._clean_text(row_sku).lower()
        normalized_barcode = self._clean_text(row_barcode).lower()

        barcode_matches = [item for item in stocktake_items if normalized_barcode and self._clean_text(item.get('barcode')).lower() == normalized_barcode]
        sku_matches = [item for item in stocktake_items if normalized_sku and self._clean_text(item.get('sku')).lower() == normalized_sku]
        name_matches = [item for item in stocktake_items if normalized_name and self._clean_text(item.get('product_name')).lower() == normalized_name]

        if normalized_barcode and normalized_sku and barcode_matches and sku_matches:
            barcode_ids = {item.get('product_id') for item in barcode_matches}
            sku_ids = {item.get('product_id') for item in sku_matches}
            if barcode_ids != sku_ids:
                return None, self._structured_rejection(
                    'BARCODE_SKU_CONFLICT',
                    'Barcode and SKU point to different products.',
                    'Correct the file so both identifiers refer to the same product.',
                    field='barcode,sku',
                    details={'barcode_matches': list(barcode_ids), 'sku_matches': list(sku_ids)},
                )

        if len(barcode_matches) > 1 or len(sku_matches) > 1 or len(name_matches) > 1:
            return None, self._structured_rejection(
                'DUPLICATE_SESSION_PRODUCT',
                'Multiple session items matched this row.',
                'Resolve duplicate products in the stock take session before re-importing.',
                details={
                    'barcode_matches': len(barcode_matches),
                    'sku_matches': len(sku_matches),
                    'name_matches': len(name_matches),
                },
            )

        if barcode_matches:
            return barcode_matches[0], None
        if sku_matches:
            return sku_matches[0], None
        if name_matches:
            return name_matches[0], None

        if not normalized_name:
            return None, self._structured_rejection(
                'MISSING_REQUIRED_FIELDS',
                'Provide Product Name, SKU, or Barcode.',
                'Add at least one identifier before re-importing.',
                field='product_name,sku,barcode',
            )

        fuzzy_matches = []
        for item in stocktake_items:
            score = self._similarity(normalized_name, self._clean_text(item.get('product_name')).lower())
            if score >= 0.86:
                fuzzy_matches.append((score, item))

        if len(fuzzy_matches) == 1:
            return fuzzy_matches[0][1], None
        if len(fuzzy_matches) > 1:
            return None, self._structured_rejection(
                'AMBIGUOUS_NAME_MATCH',
                'More than one stock take item matched this product name.',
                'Use the exact SKU or barcode to resolve the match.',
                field='product_name',
                details={'matches': len(fuzzy_matches)},
            )

        return None, self._structured_rejection(
            'NEW_PRODUCT_REQUIRED',
            'No matching item found in this stock take session.',
            'New products need to be created or added first, then re-import the corrected file.',
            field='product_name,sku,barcode',
        )

    def _recompute_batch_preview_totals(self, batch: ImportBatch):
        total_rows = batch.rows.count()
        invalid_rows = batch.rows.filter(status=ImportRowResult.STATUS_INVALID).count()
        warning_rows = batch.rows.filter(status=ImportRowResult.STATUS_WARNING).count()
        valid_rows = max(0, total_rows - invalid_rows)

        summary = batch.preview_summary if isinstance(batch.preview_summary, dict) else {}
        summary.update({
            'total_rows': total_rows,
            'valid_rows': valid_rows,
            'invalid_rows': invalid_rows,
            'warning_rows': warning_rows,
        })

        batch.total_rows = total_rows
        batch.valid_rows = valid_rows
        batch.invalid_rows = invalid_rows
        batch.warning_rows = warning_rows
        batch.preview_summary = summary

    def _build_sync_row_from_payload(self, payload: Dict[str, Any], *, tenant, outlet):
        errors: List[str] = []
        warnings: List[str] = []

        name = str(payload.get('name') or '').strip()
        sku = str(payload.get('sku') or '').strip()
        barcode = str(payload.get('barcode') or '').strip()
        category_name = str(payload.get('category') or '').strip()
        description = str(payload.get('description') or '').strip()
        batch_expiry_date = str(payload.get('batch_expiry_date') or '').strip()

        if not name and not sku and not barcode:
            errors.append('Provide Product Name, SKU, or Barcode')

        retail_price, retail_errors = self._parse_optional_decimal(
            payload.get('retail_price'), min_value='0.01', zero_is_blank=True
        )
        wholesale_price, wholesale_errors = self._parse_optional_decimal(
            payload.get('wholesale_price'), min_value='0.01', zero_is_blank=True
        )
        cost_price, cost_errors = self._parse_optional_decimal(
            payload.get('cost_price'), min_value='0', zero_is_blank=True
        )
        errors.extend(retail_errors)
        errors.extend(wholesale_errors)
        errors.extend(cost_errors)

        stock_text = str(payload.get('stock') or '').strip()
        stock_value = ''
        if stock_text != '':
            try:
                stock_int = int(float(stock_text))
                if stock_int < 0:
                    errors.append('Counted quantity must be 0 or greater')
                else:
                    stock_value = str(stock_int)
            except (TypeError, ValueError):
                errors.append(f'Invalid counted quantity: {stock_text}')

        low_stock_text = str(payload.get('low_stock_threshold') or '').strip()
        low_stock_value = '0'
        if low_stock_text != '':
            try:
                low_stock_value = str(max(0, int(float(low_stock_text))))
            except (TypeError, ValueError):
                errors.append(f'Invalid low stock threshold: {low_stock_text}')

        is_active = self._coerce_bool_text(payload.get('is_active'), default='yes')

        queryset = Product.objects.filter(tenant=tenant, outlet=outlet)
        existing = None
        if not errors:
            if sku:
                existing = queryset.filter(sku__iexact=sku).first()
            if not existing and barcode:
                existing = queryset.filter(barcode__iexact=barcode).first()
            if not existing and name:
                existing = queryset.filter(name__iexact=name).first()

        if not existing and retail_price is None:
            errors.append('Retail price is required for new products')

        identity = self._build_identity(name or sku or barcode, sku, barcode)
        action = ImportRowResult.ACTION_CREATE if not existing else ImportRowResult.ACTION_UPDATE
        if errors:
            status_value = ImportRowResult.STATUS_INVALID
            action = ImportRowResult.ACTION_SKIP
        elif warnings:
            status_value = ImportRowResult.STATUS_WARNING
        else:
            status_value = ImportRowResult.STATUS_VALID

        normalized_data = {
            'name': name,
            'sku': sku,
            'barcode': barcode,
            'category': category_name,
            'retail_price': self._stringify_decimal(retail_price),
            'wholesale_price': self._stringify_decimal(wholesale_price),
            'cost_price': self._stringify_decimal(cost_price),
            'stock': stock_value,
            'low_stock_threshold': low_stock_value,
            'batch_expiry_date': batch_expiry_date,
            'description': description,
            'is_active': is_active,
            'matched_product_id': str(existing.id) if existing else '',
        }

        return {
            'identity_key': identity,
            'status': status_value,
            'action': action,
            'errors': errors,
            'warnings': warnings,
            'normalized_data': normalized_data,
        }

    def _build_upsert_row_from_payload(self, payload: Dict[str, Any], *, tenant, outlet):
        errors: List[str] = []
        warnings: List[str] = []

        name = str(payload.get('name') or '').strip()
        sku = str(payload.get('sku') or '').strip()
        barcode = str(payload.get('barcode') or '').strip()

        if not name:
            errors.append('Product name is required')

        retail_price_text = str(payload.get('retail_price') or '').strip()
        retail_price = None
        if retail_price_text != '':
            try:
                retail_price = float(retail_price_text)
                if retail_price < 0.01:
                    errors.append('Price must be >= 0.01')
            except (TypeError, ValueError):
                errors.append(f'Invalid price: {retail_price_text}')
        else:
            errors.append('Price is required')

        identity = self._build_identity(name or sku or barcode, sku, barcode) if (name or sku or barcode) else ''
        action = ImportRowResult.ACTION_CREATE
        if not errors and name:
            existing = Product.objects.filter(tenant=tenant, outlet=outlet)
            if sku:
                existing = existing.filter(sku__iexact=sku)
            elif barcode:
                existing = existing.filter(barcode__iexact=barcode)
            else:
                existing = existing.filter(name__iexact=name)

            if existing.exists():
                errors.append('Product already exists in this outlet. Use Product & Inventory Sync mode to update existing products.')
                action = ImportRowResult.ACTION_SKIP

        if errors:
            status_value = ImportRowResult.STATUS_INVALID
            action = ImportRowResult.ACTION_SKIP
        elif warnings:
            status_value = ImportRowResult.STATUS_WARNING
        else:
            status_value = ImportRowResult.STATUS_VALID

        normalized_data = {
            'name': name,
            'sku': sku,
            'barcode': barcode,
            'retail_price': str(retail_price) if retail_price is not None else '',
        }

        return {
            'identity_key': identity,
            'status': status_value,
            'action': action,
            'errors': errors,
            'warnings': warnings,
            'normalized_data': normalized_data,
        }

    def _preview_sync_rows(self, df: pd.DataFrame, column_mapping: Dict[str, str], tenant, outlet) -> Dict[str, Any]:
        name_col = self._pick_first_column(column_mapping, 'product_name', 'name', 'product', 'item_name')
        sku_col = self._pick_first_column(column_mapping, 'sku', 'code', 'product_code')
        barcode_col = self._pick_first_column(column_mapping, 'barcode', 'bar_code', 'barcodevalue')
        category_col = self._pick_first_column(column_mapping, 'category', 'category_name')
        retail_price_col = self._pick_first_column(column_mapping, 'retail_price', 'price', 'selling_price')
        wholesale_price_col = self._pick_first_column(column_mapping, 'wholesale_price', 'wholesaleprice')
        cost_price_col = self._pick_first_column(column_mapping, 'cost', 'cost_price')
        stock_col = self._pick_first_column(column_mapping, 'initial_stock_qty', 'counted_quantity', 'stock', 'quantity', 'on_hand_quantity')
        low_stock_threshold_col = self._pick_first_column(column_mapping, 'low_stock_threshold', 'lowstockthreshold')
        batch_expiry_date_col = self._pick_first_column(column_mapping, 'batch_expiry_date', 'expiry_date', 'expirydate')
        description_col = self._pick_first_column(column_mapping, 'description', 'details')
        is_active_col = self._pick_first_column(column_mapping, 'is_active', 'active')

        if not name_col and not sku_col and not barcode_col:
            raise ValueError('Provide at least one identifier column: Product Name, SKU, or Barcode.')

        row_results: List[Dict[str, Any]] = []
        seen_identity = set()

        for idx, row in df.iterrows():
            if self._is_effectively_blank_row(row):
                continue

            row_number = idx + 2
            errors: List[str] = []
            warnings: List[str] = []

            name_val = row[name_col] if name_col and name_col in row else None
            sku_val = row[sku_col] if sku_col and sku_col in row else None
            barcode_val = row[barcode_col] if barcode_col and barcode_col in row else None
            category_val = row[category_col] if category_col and category_col in row else None
            retail_price_val = row[retail_price_col] if retail_price_col and retail_price_col in row else None
            wholesale_price_val = row[wholesale_price_col] if wholesale_price_col and wholesale_price_col in row else None
            cost_price_val = row[cost_price_col] if cost_price_col and cost_price_col in row else None
            stock_val = row[stock_col] if stock_col and stock_col in row else None
            low_stock_threshold_val = row[low_stock_threshold_col] if low_stock_threshold_col and low_stock_threshold_col in row else None
            batch_expiry_date_val = row[batch_expiry_date_col] if batch_expiry_date_col and batch_expiry_date_col in row else None
            description_val = row[description_col] if description_col and description_col in row else None
            is_active_val = row[is_active_col] if is_active_col and is_active_col in row else None

            name = str(name_val).strip() if pd.notna(name_val) else ''
            sku = str(sku_val).strip() if pd.notna(sku_val) else ''
            barcode = str(barcode_val).strip() if pd.notna(barcode_val) else ''
            category_name = str(category_val).strip() if pd.notna(category_val) else ''

            if not name and not sku and not barcode:
                errors.append('Provide Product Name, SKU, or Barcode')

            current_quantity = None
            if pd.notna(stock_val) and str(stock_val).strip() != '':
                try:
                    current_quantity = int(float(stock_val))
                    if current_quantity < 0:
                        errors.append('Counted quantity must be 0 or greater')
                except (TypeError, ValueError):
                    errors.append(f'Invalid counted quantity: {stock_val}')

            retail_price = None
            if pd.notna(retail_price_val):
                retail_price, retail_errors = self._parse_optional_decimal(retail_price_val, min_value='0.01', zero_is_blank=True)
                errors.extend(retail_errors)

            wholesale_price = None
            if pd.notna(wholesale_price_val):
                wholesale_price, wholesale_errors = self._parse_optional_decimal(wholesale_price_val, min_value='0.01', zero_is_blank=True)
                errors.extend(wholesale_errors)

            cost_price = None
            if pd.notna(cost_price_val):
                cost_price, cost_errors = self._parse_optional_decimal(cost_price_val, min_value='0', zero_is_blank=True)
                errors.extend(cost_errors)

            identity = self._build_identity(name or sku or barcode, sku, barcode)
            if identity in seen_identity:
                warnings.append('Duplicate row detected in file')
            seen_identity.add(identity)

            low_stock_threshold = 0
            if pd.notna(low_stock_threshold_val) and str(low_stock_threshold_val).strip() != '':
                try:
                    low_stock_threshold = max(0, int(float(low_stock_threshold_val)))
                except (TypeError, ValueError):
                    errors.append(f'Invalid low stock threshold: {low_stock_threshold_val}')

            batch_expiry_date = ''
            if pd.notna(batch_expiry_date_val) and str(batch_expiry_date_val).strip() != '':
                batch_expiry_date = str(batch_expiry_date_val).strip()

            description = str(description_val).strip() if pd.notna(description_val) else ''

            is_active = True
            if pd.notna(is_active_val) and str(is_active_val).strip() != '':
                active_text = str(is_active_val).strip().lower()
                is_active = active_text in ('1', 'true', 'yes', 'y', 'active')

            existing = None
            if not errors:
                queryset = Product.objects.filter(tenant=tenant, outlet=outlet)
                if sku:
                    existing = queryset.filter(sku__iexact=sku).first()
                if not existing and barcode:
                    existing = queryset.filter(barcode__iexact=barcode).first()
                if not existing and name:
                    existing = queryset.filter(name__iexact=name).first()

            if not existing and retail_price is None:
                errors.append('Retail price is required for new products')

            action = ImportRowResult.ACTION_CREATE if not existing else ImportRowResult.ACTION_UPDATE
            if errors:
                status_value = ImportRowResult.STATUS_INVALID
                action = ImportRowResult.ACTION_SKIP
            elif warnings:
                status_value = ImportRowResult.STATUS_WARNING
            else:
                status_value = ImportRowResult.STATUS_VALID

            raw_data = {str(k): (None if pd.isna(v) else str(v)) for k, v in row.to_dict().items()}
            normalized_data = {
                'name': name,
                'sku': sku,
                'barcode': barcode,
                'category': category_name,
                'retail_price': str(retail_price) if retail_price is not None else '',
                'wholesale_price': str(wholesale_price) if wholesale_price is not None else '',
                'cost_price': str(cost_price) if cost_price is not None else '',
                'stock': str(current_quantity if current_quantity is not None else ''),
                'low_stock_threshold': str(low_stock_threshold),
                'batch_expiry_date': batch_expiry_date,
                'description': description,
                'is_active': 'yes' if is_active else 'no',
                'matched_product_id': str(existing.id) if existing else '',
            }

            row_results.append({
                'row_number': row_number,
                'status': status_value,
                'action': action,
                'identity_key': identity,
                'errors': errors,
                'warnings': warnings,
                'raw_data': raw_data,
                'normalized_data': normalized_data,
            })

        total_rows = len(row_results)
        invalid_rows = sum(1 for r in row_results if r['status'] == ImportRowResult.STATUS_INVALID)
        warning_rows = sum(1 for r in row_results if r['status'] == ImportRowResult.STATUS_WARNING)
        valid_rows = total_rows - invalid_rows

        return {
            'row_results': row_results,
            'summary': {
                'total_rows': total_rows,
                'valid_rows': valid_rows,
                'invalid_rows': invalid_rows,
                'warning_rows': warning_rows,
            }
        }

    def _apply_inventory_sync_batch(self, request, batch: ImportBatch, sync_strategy: str, sync_options: Dict[str, str]):
        valid_rows_qs = batch.rows.filter(status__in=[ImportRowResult.STATUS_VALID, ImportRowResult.STATUS_WARNING]).exclude(action=ImportRowResult.ACTION_SKIP).order_by('row_number')
        valid_rows = list(valid_rows_qs.values('row_number', 'raw_data', 'normalized_data'))
        if not valid_rows:
            return Response({'detail': 'No staged rows available for apply.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            batch.apply_errors.all().delete()
            batch.stock_mutations.all().delete()
            batch.status = ImportBatch.STATUS_APPLYING
            batch.approved_by = request.user
            batch.apply_idempotency_key = request.headers.get('X-Idempotency-Key') or request.data.get('idempotency_key')
            batch.save(update_fields=['status', 'approved_by', 'apply_idempotency_key', 'updated_at'])
            ImportAuditEvent.objects.create(
                batch=batch,
                event_type='apply_started',
                message='Inventory sync apply started',
                metadata={'valid_rows': batch.valid_rows, 'sync_strategy': sync_strategy},
                created_by=request.user,
            )

        outlet = batch.outlet
        tenant = batch.tenant
        products_updated = 0
        new_products_created = 0
        stock_increases = 0
        stock_decreases = 0
        prices_changed = 0
        skipped_by_strategy = 0
        total_imported = 0
        total_failed = 0
        chunk_reports: List[Dict[str, Any]] = []

        apply_catalog_fields = sync_strategy in {
            self.SYNC_STRATEGY_FULL_SYNC,
            self.SYNC_STRATEGY_UPDATE_EXISTING,
            self.SYNC_STRATEGY_CATALOG_ONLY,
        }
        apply_price_updates = sync_strategy in {
            self.SYNC_STRATEGY_FULL_SYNC,
            self.SYNC_STRATEGY_UPDATE_EXISTING,
            self.SYNC_STRATEGY_PRICES_ONLY,
        }
        apply_cost_updates = sync_strategy in {
            self.SYNC_STRATEGY_FULL_SYNC,
            self.SYNC_STRATEGY_UPDATE_EXISTING,
            self.SYNC_STRATEGY_COST_ONLY,
        }
        apply_stock_updates = sync_strategy in {
            self.SYNC_STRATEGY_FULL_SYNC,
            self.SYNC_STRATEGY_UPDATE_EXISTING,
            self.SYNC_STRATEGY_STOCK_ONLY,
        }
        cost_price_method = str(sync_options.get('cost_price_method') or 'replace').strip().lower()
        stock_update_method = str(sync_options.get('stock_update_method') or 'replace_quantity').strip().lower()
        duplicate_products = str(sync_options.get('duplicate_products') or 'update_existing').strip().lower()
        missing_products = str(sync_options.get('missing_products') or 'auto_create').strip().lower()

        apply_stock_updates = apply_stock_updates and stock_update_method != 'ignore'
        allow_create = missing_products == 'auto_create' or sync_strategy in {
            self.SYNC_STRATEGY_FULL_SYNC,
            self.SYNC_STRATEGY_CREATE_NEW,
        }
        allow_update = sync_strategy in {
            self.SYNC_STRATEGY_FULL_SYNC,
            self.SYNC_STRATEGY_UPDATE_EXISTING,
            self.SYNC_STRATEGY_STOCK_ONLY,
            self.SYNC_STRATEGY_PRICES_ONLY,
            self.SYNC_STRATEGY_CATALOG_ONLY,
            self.SYNC_STRATEGY_COST_ONLY,
        }

        def _get_decimal(value, default=None):
            if value in (None, ''):
                return default
            try:
                return Decimal(str(value))
            except Exception:
                return default

        for row in valid_rows:
            row_number = int(row['row_number'])
            raw_data = row.get('raw_data') if isinstance(row.get('raw_data'), dict) else {}
            normalized_data = row.get('normalized_data') if isinstance(row.get('normalized_data'), dict) else {}

            try:
                name = str(normalized_data.get('name') or '').strip()
                sku = str(normalized_data.get('sku') or '').strip()
                barcode = str(normalized_data.get('barcode') or '').strip()
                category_name = str(normalized_data.get('category') or '').strip()
                retail_price = _get_decimal(normalized_data.get('retail_price'))
                wholesale_price = _get_decimal(normalized_data.get('wholesale_price'))
                cost_price = _get_decimal(normalized_data.get('cost_price'))
                stock_value = normalized_data.get('stock')
                low_stock_threshold = int(float(normalized_data.get('low_stock_threshold') or 0)) if str(normalized_data.get('low_stock_threshold') or '').strip() != '' else 0
                batch_expiry_date = str(normalized_data.get('batch_expiry_date') or '').strip()
                description = str(normalized_data.get('description') or '').strip()
                is_active_value = str(normalized_data.get('is_active') or '').strip().lower()
                is_active = True if is_active_value == '' else is_active_value in ('1', 'true', 'yes', 'y', 'active')
                target_stock = int(float(stock_value)) if str(stock_value).strip() != '' else None

                queryset = Product.objects.filter(tenant=tenant, outlet=outlet)
                product = None
                if sku:
                    product = queryset.filter(sku__iexact=sku).first()
                if not product and barcode:
                    product = queryset.filter(barcode__iexact=barcode).first()
                if not product and name:
                    product = queryset.filter(name__iexact=name).first()

                category = None
                if category_name:
                    category, _ = Category.objects.get_or_create(
                        tenant=tenant,
                        name=category_name,
                        defaults={'description': ''},
                    )

                product_was_created = False

                if product is None:
                    if not allow_create:
                        skipped_by_strategy += 1
                        continue

                    if retail_price is None:
                        raise ValueError('Retail price is required for new products')

                    product = Product.objects.create(
                        tenant=tenant,
                        outlet=outlet,
                        category=category,
                        name=name or sku or barcode,
                        sku=sku or None,
                        barcode=barcode,
                        retail_price=retail_price,
                        wholesale_price=wholesale_price,
                        cost=cost_price,
                        low_stock_threshold=low_stock_threshold,
                        description=description,
                        is_active=is_active,
                        is_archived=False,
                        archived_at=None,
                        archived_reason='',
                        archived_by=None,
                        stock=0,
                    )
                    new_products_created += 1
                    product_was_created = True

                if product is not None and not product_was_created and not allow_update:
                    skipped_by_strategy += 1
                    continue

                original_retail_price = product.retail_price
                original_cost = product.cost
                original_name = product.name
                original_category_id = product.category_id
                original_stock = get_available_stock(product, outlet)

                changed = False
                if getattr(product, 'is_archived', False):
                    product.is_archived = False
                    product.archived_at = None
                    product.archived_reason = ''
                    product.archived_by = None
                    changed = True
                if apply_catalog_fields:
                    if name and name != product.name:
                        product.name = name
                        changed = True
                    if sku and sku != (product.sku or ''):
                        product.sku = sku
                        changed = True
                    if barcode and barcode != (product.barcode or ''):
                        product.barcode = barcode
                        changed = True
                    if category and product.category_id != category.id:
                        product.category = category
                        changed = True
                    if low_stock_threshold != product.low_stock_threshold:
                        product.low_stock_threshold = low_stock_threshold
                        changed = True
                    if description and description != (product.description or ''):
                        product.description = description
                        changed = True
                    if product.is_active != is_active:
                        product.is_active = is_active
                        changed = True

                if apply_price_updates or product_was_created:
                    if retail_price is not None and retail_price != product.retail_price:
                        product.retail_price = retail_price
                        prices_changed += 1
                        changed = True
                    if wholesale_price is not None and wholesale_price != product.wholesale_price:
                        product.wholesale_price = wholesale_price
                        changed = True
                if apply_cost_updates or product_was_created:
                    if cost_price is not None:
                        next_cost = cost_price
                        if not product_was_created and product.cost is not None:
                            if cost_price_method == 'average_cost':
                                next_cost = (Decimal(str(product.cost)) + cost_price) / Decimal('2')
                            elif cost_price_method == 'highest_cost':
                                next_cost = max(Decimal(str(product.cost)), cost_price)
                            elif cost_price_method == 'lowest_cost':
                                next_cost = min(Decimal(str(product.cost)), cost_price)
                            elif cost_price_method == 'ignore':
                                next_cost = Decimal(str(product.cost))
                        if cost_price_method != 'ignore' and next_cost != product.cost:
                            product.cost = next_cost
                            changed = True
                if batch_expiry_date:
                    # Expiry date is acknowledged from the template, but product-level expiry is optional.
                    # If future batch handling is added here, this value is already available in normalized_data.
                    pass

                if changed:
                    product.save()
                    products_updated += 1

                should_apply_stock = apply_stock_updates or product_was_created
                if should_apply_stock and target_stock is not None and target_stock != original_stock:
                    if stock_update_method == 'increase':
                        target_stock = max(0, original_stock + abs(target_stock))
                    elif stock_update_method == 'decrease':
                        target_stock = max(0, original_stock - abs(target_stock))
                    elif stock_update_method == 'stock_count_adjustment':
                        target_stock = max(0, original_stock + target_stock)
                    elif stock_update_method == 'ignore' and not product_was_created:
                        target_stock = original_stock

                    movement_reason = f'Inventory sync import row {row_number}'
                    adjust_stock(
                        product=product,
                        outlet=outlet,
                        new_quantity=target_stock,
                        user=request.user,
                        reason=movement_reason,
                    )

                    # Persist exact delta for deterministic rollback.
                    ImportStockMutation.objects.create(
                        batch=batch,
                        row_number=row_number,
                        product=product,
                        outlet=outlet,
                        before_quantity=original_stock,
                        applied_quantity=target_stock,
                        quantity_delta=(target_stock - original_stock),
                        sync_strategy=sync_strategy,
                        movement_reason=movement_reason,
                    )

                    if target_stock > original_stock:
                        stock_increases += 1
                    else:
                        stock_decreases += 1
                elif not changed and product.id:
                    products_updated += 0

                total_imported += 1
            except Exception as row_exc:
                total_failed += 1
                ImportApplyError.objects.create(
                    batch=batch,
                    row_number=row_number,
                    chunk_index=1,
                    error_code='inventory_sync_apply_failed',
                    message=str(row_exc),
                    details={'mode': ImportBatch.MODE_INVENTORY_SYNC},
                    raw_data=raw_data,
                )
                continue

        final_status = ImportBatch.STATUS_APPLIED if total_failed == 0 else ImportBatch.STATUS_FAILED
        response_data = {
            'success': total_failed == 0,
            'imported': total_imported,
            'failed': total_failed,
            'total_rows': len(valid_rows),
            'chunks': [{
                'chunk_index': 1,
                'rows': len(valid_rows),
                'imported': total_imported,
                'failed': total_failed,
                'row_numbers': [int(r['row_number']) for r in valid_rows],
            }],
            'products_updated': products_updated,
            'new_products_created': new_products_created,
            'stock_increases': stock_increases,
            'stock_decreases': stock_decreases,
            'prices_changed': prices_changed,
            'skipped_by_strategy': skipped_by_strategy,
            'sync_strategy': sync_strategy,
            'sync_options': sync_options,
            'stock_updates_enabled': apply_stock_updates,
            'errors': total_failed,
        }

        with transaction.atomic():
            batch.status = final_status
            batch.applied_rows = max(0, total_imported)
            batch.applied_at = timezone.now() if final_status == ImportBatch.STATUS_APPLIED else None
            batch.apply_summary = response_data
            batch.save(update_fields=['status', 'applied_rows', 'applied_at', 'apply_summary', 'updated_at'])
            ImportAuditEvent.objects.create(
                batch=batch,
                event_type='apply_succeeded' if final_status == ImportBatch.STATUS_APPLIED else 'apply_failed',
                message='Inventory sync completed' if final_status == ImportBatch.STATUS_APPLIED else 'Inventory sync completed with errors',
                metadata=batch.apply_summary,
                created_by=request.user,
            )

        return Response({
            'batch_id': str(batch.id),
            'status': batch.status,
            'apply_summary': batch.apply_summary,
        }, status=status.HTTP_200_OK if final_status == ImportBatch.STATUS_APPLIED else status.HTTP_207_MULTI_STATUS)

    def _preview_rows(self, df: pd.DataFrame, column_mapping: Dict[str, str], tenant, outlet) -> Dict[str, Any]:
        if 'product_name' in column_mapping:
            name_col = column_mapping['product_name']
        elif 'name' in column_mapping:
            name_col = column_mapping['name']
        else:
            raise ValueError('Required column "Name" or "product_name" not found.')

        if 'retail_price' in column_mapping:
            price_col = column_mapping['retail_price']
        elif 'price' in column_mapping:
            price_col = column_mapping['price']
        elif 'retail_price' in df.columns:
            price_col = 'retail_price'
        else:
            raise ValueError('Required column "Price" or "retail_price" not found.')

        seen_identity = set()
        row_results: List[Dict[str, Any]] = []

        for idx, row in df.iterrows():
            if self._is_effectively_blank_row(row):
                continue

            row_number = idx + 2
            errors: List[str] = []
            warnings: List[str] = []

            name_val = row[name_col] if name_col in row else None
            price_val = row[price_col] if price_col in row else None
            sku_val = row[column_mapping['sku']] if 'sku' in column_mapping else None
            barcode_val = row[column_mapping['barcode']] if 'barcode' in column_mapping else None

            name = str(name_val).strip() if pd.notna(name_val) else ''
            sku = str(sku_val).strip() if pd.notna(sku_val) else ''
            barcode = str(barcode_val).strip() if pd.notna(barcode_val) else ''

            if not name:
                errors.append('Product name is required')

            price = None
            if pd.notna(price_val):
                try:
                    price = float(price_val)
                    if price < 0.01:
                        errors.append('Price must be >= 0.01')
                except (TypeError, ValueError):
                    errors.append(f'Invalid price: {price_val}')
            else:
                errors.append('Price is required')

            identity = self._build_identity(name, sku, barcode) if name else ''
            if identity:
                if identity in seen_identity:
                    errors.append('Duplicate product row detected in file. Keep one row per product in Import Products mode.')
                seen_identity.add(identity)

            action = ImportRowResult.ACTION_CREATE
            if not errors and name:
                existing = Product.objects.filter(tenant=tenant, outlet=outlet)
                if sku:
                    existing = existing.filter(sku__iexact=sku)
                elif barcode:
                    existing = existing.filter(barcode__iexact=barcode)
                else:
                    existing = existing.filter(name__iexact=name)

                if existing.exists():
                    errors.append('Product already exists in this outlet. Use Product & Inventory Sync mode to update existing products.')
                    action = ImportRowResult.ACTION_SKIP

            if errors:
                status_value = ImportRowResult.STATUS_INVALID
                action = ImportRowResult.ACTION_SKIP
            elif warnings:
                status_value = ImportRowResult.STATUS_WARNING
            else:
                status_value = ImportRowResult.STATUS_VALID

            raw_data = {str(k): (None if pd.isna(v) else str(v)) for k, v in row.to_dict().items()}
            normalized_data = {
                'name': name,
                'sku': sku,
                'barcode': barcode,
                'retail_price': price,
            }

            row_results.append({
                'row_number': row_number,
                'status': status_value,
                'action': action,
                'identity_key': identity,
                'errors': errors,
                'warnings': warnings,
                'raw_data': raw_data,
                'normalized_data': normalized_data,
            })

        total_rows = len(row_results)
        invalid_rows = sum(1 for r in row_results if r['status'] == ImportRowResult.STATUS_INVALID)
        warning_rows = sum(1 for r in row_results if r['status'] == ImportRowResult.STATUS_WARNING)
        valid_rows = total_rows - invalid_rows

        return {
            'row_results': row_results,
            'summary': {
                'total_rows': total_rows,
                'valid_rows': valid_rows,
                'invalid_rows': invalid_rows,
                'warning_rows': warning_rows,
            }
        }


class ProductImportPreviewView(BaseImportView):
    def post(self, request):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        outlet, outlet_error = self._resolve_outlet(request, tenant)
        if outlet_error:
            return outlet_error

        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({'detail': 'file is required'}, status=status.HTTP_400_BAD_REQUEST)

        sync_mode = self._resolve_sync_mode(request)
        is_inventory_sync = sync_mode == ImportBatch.MODE_INVENTORY_SYNC
        batch_sync_mode = ImportBatch.MODE_INVENTORY_SYNC if is_inventory_sync else ImportBatch.MODE_UPSERT_ADJUST
        sync_strategy = self.SYNC_STRATEGY_FULL_SYNC
        if is_inventory_sync:
            try:
                sync_strategy = self._resolve_sync_strategy(request)
            except ValueError as exc:
                return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        sync_options: Dict[str, str] = {}
        if is_inventory_sync:
            try:
                sync_options = {
                    'cost_price_method': self._resolve_sync_option(
                        request,
                        'cost_price_method',
                        default='replace',
                        choices=self.COST_PRICE_METHOD_CHOICES,
                    ),
                    'stock_update_method': self._resolve_sync_option(
                        request,
                        'stock_update_method',
                        default='replace_quantity',
                        choices=self.STOCK_UPDATE_METHOD_CHOICES,
                    ),
                    'duplicate_products': self._resolve_sync_option(
                        request,
                        'duplicate_products',
                        default='update_existing',
                        choices=self.DUPLICATE_PRODUCTS_CHOICES,
                    ),
                    'missing_products': self._resolve_sync_option(
                        request,
                        'missing_products',
                        default='auto_create',
                        choices=self.MISSING_PRODUCTS_CHOICES,
                    ),
                }
            except ValueError as exc:
                return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        idempotency_key = request.headers.get('X-Idempotency-Key') or request.data.get('idempotency_key')
        if idempotency_key:
            existing_batch = ImportBatch.objects.filter(
                tenant=tenant,
                entity_type=ImportBatch.ENTITY_PRODUCTS,
                sync_mode=batch_sync_mode,
                idempotency_key=idempotency_key,
            ).first()
            if existing_batch:
                return Response({
                    'batch_id': str(existing_batch.id),
                    'status': existing_batch.status,
                    'summary': existing_batch.preview_summary,
                    'idempotent_reuse': True,
                })

        try:
            df = self._read_dataframe(uploaded_file)
            df, column_mapping = self._normalize_columns(df)
            preview_data = self._preview_sync_rows(df, column_mapping, tenant, outlet) if is_inventory_sync else self._preview_rows(df, column_mapping, tenant, outlet)
            summary_payload = dict(preview_data['summary'])
            if is_inventory_sync:
                summary_payload['sync_strategy'] = sync_strategy
                summary_payload['sync_options'] = sync_options

            with transaction.atomic():
                batch = ImportBatch.objects.create(
                    tenant=tenant,
                    outlet=outlet,
                    entity_type=ImportBatch.ENTITY_PRODUCTS,
                    sync_mode=batch_sync_mode,
                    status=ImportBatch.STATUS_PREVIEW_READY,
                    source_filename=uploaded_file.name,
                    idempotency_key=idempotency_key,
                    total_rows=preview_data['summary']['total_rows'],
                    valid_rows=preview_data['summary']['valid_rows'],
                    invalid_rows=preview_data['summary']['invalid_rows'],
                    warning_rows=preview_data['summary']['warning_rows'],
                    preview_summary=summary_payload,
                    created_by=request.user,
                    previewed_at=timezone.now(),
                )

                ImportRowResult.objects.bulk_create([
                    ImportRowResult(
                        batch=batch,
                        row_number=r['row_number'],
                        status=r['status'],
                        action=r['action'],
                        identity_key=r['identity_key'],
                        errors=r['errors'],
                        warnings=r['warnings'],
                        raw_data=r['raw_data'],
                        normalized_data=r['normalized_data'],
                    )
                    for r in preview_data['row_results']
                ], batch_size=500)

                ImportAuditEvent.objects.create(
                    batch=batch,
                    event_type='preview_created',
                    message='Preview completed and batch staged for apply.',
                    metadata=summary_payload,
                    created_by=request.user,
                )

            return Response({
                'batch_id': str(batch.id),
                'status': batch.status,
                'summary': batch.preview_summary,
                'sample_errors': [
                    {
                        'row_number': row.row_number,
                        'errors': row.errors,
                    }
                    for row in batch.rows.filter(status=ImportRowResult.STATUS_INVALID).order_by('row_number')[:20]
                ],
            }, status=status.HTTP_201_CREATED)

        except Exception as exc:
            logger.error('Product import preview failed: %s', exc, exc_info=True)
            return Response({'detail': f'Preview failed: {exc}'}, status=status.HTTP_400_BAD_REQUEST)


class ProductImportApplyView(BaseImportView):
    def post(self, request, batch_id):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            batch = ImportBatch.objects.select_related('tenant', 'outlet').get(id=batch_id, tenant=tenant, entity_type=ImportBatch.ENTITY_PRODUCTS)
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        apply_idempotency_key = request.headers.get('X-Idempotency-Key') or request.data.get('idempotency_key')
        if apply_idempotency_key and batch.apply_idempotency_key and batch.apply_idempotency_key == apply_idempotency_key:
            return Response({
                'batch_id': str(batch.id),
                'status': batch.status,
                'apply_summary': batch.apply_summary,
                'idempotent_reuse': True,
            })

        if batch.status == ImportBatch.STATUS_APPLIED:
            return Response({
                'batch_id': str(batch.id),
                'status': batch.status,
                'apply_summary': batch.apply_summary,
                'already_applied': True,
            })

        if batch.status not in [ImportBatch.STATUS_PREVIEW_READY, ImportBatch.STATUS_APPROVED]:
            return Response({'detail': f'Batch is not ready to apply (status={batch.status})'}, status=status.HTTP_409_CONFLICT)

        if batch.valid_rows <= 0:
            return Response({'detail': 'No valid rows to apply'}, status=status.HTTP_400_BAD_REQUEST)

        if not batch.is_approved:
            return Response({'detail': 'Batch must be approved before apply.'}, status=status.HTTP_409_CONFLICT)

        if batch.sync_mode == ImportBatch.MODE_INVENTORY_SYNC:
            try:
                default_strategy = (batch.preview_summary or {}).get('sync_strategy')
                sync_strategy = self._resolve_sync_strategy(request, default=default_strategy)
                preview_sync_options = (batch.preview_summary or {}).get('sync_options') if isinstance(batch.preview_summary, dict) else {}
                sync_options = {
                    'cost_price_method': self._resolve_sync_option(
                        request,
                        'cost_price_method',
                        default=str((preview_sync_options or {}).get('cost_price_method') or 'replace'),
                        choices=self.COST_PRICE_METHOD_CHOICES,
                    ),
                    'stock_update_method': self._resolve_sync_option(
                        request,
                        'stock_update_method',
                        default=str((preview_sync_options or {}).get('stock_update_method') or 'replace_quantity'),
                        choices=self.STOCK_UPDATE_METHOD_CHOICES,
                    ),
                    'duplicate_products': self._resolve_sync_option(
                        request,
                        'duplicate_products',
                        default=str((preview_sync_options or {}).get('duplicate_products') or 'update_existing'),
                        choices=self.DUPLICATE_PRODUCTS_CHOICES,
                    ),
                    'missing_products': self._resolve_sync_option(
                        request,
                        'missing_products',
                        default=str((preview_sync_options or {}).get('missing_products') or 'auto_create'),
                        choices=self.MISSING_PRODUCTS_CHOICES,
                    ),
                }
            except ValueError as exc:
                return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            return self._apply_inventory_sync_batch(request, batch, sync_strategy, sync_options)

        chunk_size_raw = request.data.get('chunk_size', 100)
        try:
            chunk_size = max(1, min(int(chunk_size_raw), 1000))
        except (TypeError, ValueError):
            return Response({'detail': 'chunk_size must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)

        continue_on_error = str(request.data.get('continue_on_error', 'false')).lower() in ('1', 'true', 'yes', 'y')

        if batch.status == ImportBatch.STATUS_APPLYING:
            return Response({'detail': 'Batch apply already in progress.'}, status=status.HTTP_409_CONFLICT)

        valid_rows_qs = batch.rows.filter(status__in=[ImportRowResult.STATUS_VALID, ImportRowResult.STATUS_WARNING]).exclude(action=ImportRowResult.ACTION_SKIP).order_by('row_number')
        valid_rows = list(valid_rows_qs.values('row_number', 'raw_data'))
        if not valid_rows:
            return Response({'detail': 'No staged rows available for apply.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            batch.apply_errors.all().delete()
            batch.status = ImportBatch.STATUS_APPLYING
            batch.approved_by = request.user
            batch.apply_idempotency_key = apply_idempotency_key
            batch.save(update_fields=['status', 'approved_by', 'apply_idempotency_key', 'updated_at'])
            ImportAuditEvent.objects.create(
                batch=batch,
                event_type='apply_started',
                message='Apply operation started',
                metadata={'valid_rows': batch.valid_rows, 'chunk_size': chunk_size, 'continue_on_error': continue_on_error},
                created_by=request.user,
            )

        try:
            chunks: List[List[Dict[str, Any]]] = [
                valid_rows[i:i + chunk_size]
                for i in range(0, len(valid_rows), chunk_size)
            ]

            total_imported_rows = 0
            total_imported_products = 0
            total_failed = 0
            total_skipped_or_collapsed = 0
            chunk_reports: List[Dict[str, Any]] = []

            for chunk_index, chunk_rows in enumerate(chunks, start=1):
                row_numbers = [r['row_number'] for r in chunk_rows]
                try:
                    with transaction.atomic():
                        df = pd.DataFrame([r['raw_data'] for r in chunk_rows])
                        csv_text = df.to_csv(index=False)
                        upload_file = SimpleUploadedFile(
                            name=f"chunk_{chunk_index}_{batch.source_filename.rsplit('.', 1)[0]}.csv",
                            content=csv_text.encode('utf-8'),
                            content_type='text/csv',
                        )

                        factory = APIRequestFactory()
                        drf_request = factory.post(
                            '/api/v1/products/bulk-import/',
                            {'file': upload_file},
                            format='multipart',
                            HTTP_X_OUTLET_ID=str(batch.outlet_id),
                        )
                        force_authenticate(drf_request, user=request.user)
                        drf_request.tenant = tenant

                        response = ProductViewSet.as_view({'post': 'bulk_import'})(drf_request)
                        response_status = int(getattr(response, 'status_code', 500))
                        response_data = getattr(response, 'data', {})

                        if response_status >= 400:
                            raise RuntimeError(f"Chunk request failed ({response_status}): {response_data}")

                        chunk_failed = int(response_data.get('failed', 0)) if isinstance(response_data, dict) else 0
                        chunk_imported_rows = int(response_data.get('imported_rows', response_data.get('imported', 0))) if isinstance(response_data, dict) else 0
                        chunk_imported_products = int(response_data.get('imported_products', chunk_imported_rows)) if isinstance(response_data, dict) else 0
                        chunk_skipped_or_collapsed = int(response_data.get('skipped_or_collapsed_rows', max(0, len(chunk_rows) - chunk_imported_rows - chunk_failed))) if isinstance(response_data, dict) else 0

                        # Enforce all-or-nothing semantics per chunk.
                        if chunk_failed > 0:
                            raise RuntimeError(f"Chunk validation failed: {response_data}")

                        total_imported_rows += chunk_imported_rows
                        total_imported_products += chunk_imported_products
                        total_skipped_or_collapsed += chunk_skipped_or_collapsed
                        chunk_accounted_rows = chunk_imported_rows + chunk_failed + chunk_skipped_or_collapsed
                        chunk_reports.append({
                            'chunk_index': chunk_index,
                            'rows': len(chunk_rows),
                            'imported': chunk_imported_rows,
                            'imported_rows': chunk_imported_rows,
                            'imported_products': chunk_imported_products,
                            'failed': chunk_failed,
                            'skipped_or_collapsed_rows': chunk_skipped_or_collapsed,
                            'accounted_rows': chunk_accounted_rows,
                            'is_balanced': len(chunk_rows) == chunk_accounted_rows,
                            'row_numbers': row_numbers,
                        })

                except Exception as chunk_exc:
                    total_failed += len(chunk_rows)
                    ImportApplyError.objects.bulk_create([
                        ImportApplyError(
                            batch=batch,
                            row_number=row_number,
                            chunk_index=chunk_index,
                            error_code='chunk_apply_failed',
                            message=str(chunk_exc),
                            details={'continue_on_error': continue_on_error},
                            raw_data=next((r['raw_data'] for r in chunk_rows if r['row_number'] == row_number), {}),
                        )
                        for row_number in row_numbers
                    ], batch_size=200)

                    chunk_reports.append({
                        'chunk_index': chunk_index,
                        'rows': len(chunk_rows),
                        'imported': 0,
                        'imported_rows': 0,
                        'imported_products': 0,
                        'failed': len(chunk_rows),
                        'skipped_or_collapsed_rows': 0,
                        'accounted_rows': len(chunk_rows),
                        'is_balanced': True,
                        'row_numbers': row_numbers,
                        'error': str(chunk_exc),
                    })

                    if not continue_on_error:
                        break

            final_status = ImportBatch.STATUS_APPLIED if total_failed == 0 else ImportBatch.STATUS_FAILED
            accounted_rows = total_imported_rows + total_failed + total_skipped_or_collapsed
            response_data = {
                'success': total_failed == 0,
                'imported': total_imported_rows,
                'imported_rows': total_imported_rows,
                'imported_products': total_imported_products,
                'failed': total_failed,
                'total_rows': len(valid_rows),
                'skipped_or_collapsed_rows': total_skipped_or_collapsed,
                'reconciliation': {
                    'total_rows': len(valid_rows),
                    'imported_rows': total_imported_rows,
                    'failed_rows': total_failed,
                    'skipped_or_collapsed_rows': total_skipped_or_collapsed,
                    'accounted_rows': accounted_rows,
                    'is_balanced': len(valid_rows) == accounted_rows,
                },
                'chunks': chunk_reports,
            }

            with transaction.atomic():
                batch.status = final_status
                batch.applied_rows = max(0, total_imported_rows)
                batch.applied_at = timezone.now() if final_status == ImportBatch.STATUS_APPLIED else None
                batch.apply_summary = response_data
                batch.save(update_fields=['status', 'applied_rows', 'applied_at', 'apply_summary', 'updated_at'])
                ImportAuditEvent.objects.create(
                    batch=batch,
                    event_type='apply_succeeded' if final_status == ImportBatch.STATUS_APPLIED else 'apply_failed',
                    message='Apply operation completed' if final_status == ImportBatch.STATUS_APPLIED else 'Apply operation completed with errors',
                    metadata=batch.apply_summary,
                    created_by=request.user,
                )

            return Response({
                'batch_id': str(batch.id),
                'status': batch.status,
                'apply_summary': batch.apply_summary,
            }, status=status.HTTP_200_OK if final_status == ImportBatch.STATUS_APPLIED else status.HTTP_207_MULTI_STATUS)

        except Exception as exc:
            logger.error('Product import apply failed: %s', exc, exc_info=True)
            with transaction.atomic():
                batch.status = ImportBatch.STATUS_FAILED
                batch.apply_summary = {'detail': str(exc)}
                batch.save(update_fields=['status', 'apply_summary', 'updated_at'])
                ImportAuditEvent.objects.create(
                    batch=batch,
                    event_type='apply_failed',
                    message='Apply operation failed with exception',
                    metadata={'exception': str(exc)},
                    created_by=request.user,
                )
            return Response({'detail': f'Apply failed: {exc}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProductImportStatusView(BaseImportView):
    def get(self, request, batch_id):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        sync_mode = self._resolve_sync_mode(request)

        try:
            batch = ImportBatch.objects.get(id=batch_id, tenant=tenant, entity_type=ImportBatch.ENTITY_PRODUCTS)
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if sync_mode and batch.sync_mode != sync_mode:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'batch_id': str(batch.id),
            'status': batch.status,
            'is_approved': batch.is_approved,
            'sync_mode': batch.sync_mode,
            'sync_strategy': (batch.preview_summary or {}).get('sync_strategy') or (batch.apply_summary or {}).get('sync_strategy') or self.SYNC_STRATEGY_FULL_SYNC,
            'total_rows': batch.total_rows,
            'valid_rows': batch.valid_rows,
            'invalid_rows': batch.invalid_rows,
            'warning_rows': batch.warning_rows,
            'applied_rows': batch.applied_rows,
            'preview_summary': batch.preview_summary,
            'apply_summary': batch.apply_summary,
            'created_at': batch.created_at,
            'approved_at': batch.approved_at,
            'previewed_at': batch.previewed_at,
            'applied_at': batch.applied_at,
        })


class ProductImportHistoryView(BaseImportView):
    def get(self, request):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        sync_mode = self._resolve_sync_mode(request)

        batches = ImportBatch.objects.filter(
            tenant=tenant,
            entity_type=ImportBatch.ENTITY_PRODUCTS,
        ).select_related('outlet', 'created_by').order_by('-created_at')

        if sync_mode:
            batches = batches.filter(sync_mode=sync_mode)

        outlet_id = request.query_params.get('outlet')
        if outlet_id:
            try:
                batches = batches.filter(outlet_id=int(outlet_id))
            except (TypeError, ValueError):
                return Response({'detail': f'Invalid outlet: {outlet_id}'}, status=status.HTTP_400_BAD_REQUEST)

        status_filter = request.query_params.get('status')
        if status_filter:
            batches = batches.filter(status=status_filter)

        search = (request.query_params.get('search') or '').strip()
        if search:
            search_filters = (
                Q(source_filename__icontains=search)
                | Q(status__icontains=search)
                | Q(outlet__name__icontains=search)
                | Q(created_by__username__icontains=search)
                | Q(created_by__email__icontains=search)
            )

            # Allow searching by partial UUID text for batch id.
            if len(search) >= 4:
                search_filters = search_filters | Q(id__icontains=search)

            batches = batches.filter(search_filters)

        date_from_raw = request.query_params.get('date_from')
        if date_from_raw:
            try:
                date_from = datetime.strptime(date_from_raw, '%Y-%m-%d').date()
                batches = batches.filter(created_at__date__gte=date_from)
            except ValueError:
                return Response({'detail': 'date_from must be YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)

        date_to_raw = request.query_params.get('date_to')
        if date_to_raw:
            try:
                date_to = datetime.strptime(date_to_raw, '%Y-%m-%d').date()
                batches = batches.filter(created_at__date__lte=date_to)
            except ValueError:
                return Response({'detail': 'date_to must be YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except (TypeError, ValueError):
            return Response({'detail': 'page must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            page_size = max(1, min(int(request.query_params.get('page_size', 10)), 50))
        except (TypeError, ValueError):
            return Response({'detail': 'page_size must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)

        total_count = batches.count()
        total_pages = max(1, (total_count + page_size - 1) // page_size)
        if page > total_pages:
            page = total_pages

        start = (page - 1) * page_size
        end = start + page_size
        items = list(batches[start:end])

        results = []
        for batch in items:
            apply_summary = batch.apply_summary if isinstance(batch.apply_summary, dict) else {}
            created_by = None
            if batch.created_by:
                created_by = (
                    getattr(batch.created_by, 'username', None)
                    or getattr(batch.created_by, 'email', None)
                    or str(batch.created_by)
                )

            results.append({
                'batch_id': str(batch.id),
                'import_date': batch.created_at,
                'source_filename': batch.source_filename,
                'status': batch.status,
                'is_approved': batch.is_approved,
                'sync_strategy': (batch.preview_summary or {}).get('sync_strategy') or (batch.apply_summary or {}).get('sync_strategy') or self.SYNC_STRATEGY_FULL_SYNC,
                'outlet': {
                    'id': str(batch.outlet_id),
                    'name': getattr(batch.outlet, 'name', ''),
                },
                'created_by': created_by,
                'total_rows': batch.total_rows,
                'valid_rows': batch.valid_rows,
                'invalid_rows': batch.invalid_rows,
                'warning_rows': batch.warning_rows,
                'applied_rows': batch.applied_rows,
                'imported': int(apply_summary.get('imported', 0) or 0),
                'failed': int(apply_summary.get('failed', 0) or 0),
                'previewed_at': batch.previewed_at,
                'approved_at': batch.approved_at,
                'applied_at': batch.applied_at,
            })

        return Response({
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages,
            'results': results,
        })


class ProductImportRowsView(BaseImportView):
    def get(self, request, batch_id):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        sync_mode = self._resolve_sync_mode(request)

        try:
            batch = ImportBatch.objects.select_related('outlet').get(
                id=batch_id,
                tenant=tenant,
                entity_type=ImportBatch.ENTITY_PRODUCTS,
            )
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if sync_mode and batch.sync_mode != sync_mode:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except (TypeError, ValueError):
            return Response({'detail': 'page must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            page_size = max(1, min(int(request.query_params.get('page_size', 10)), 1000))
        except (TypeError, ValueError):
            return Response({'detail': 'page_size must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)

        search = (request.query_params.get('search') or '').strip().lower()

        apply_error_map = {}
        for err in batch.apply_errors.all().order_by('created_at', 'row_number'):
            apply_error_map[err.row_number] = f"{err.message}{f' ({err.error_code})' if err.error_code else ''}"

        rows = []

        def _pick_value(raw_data, normalized_data, keys):
            for key in keys:
                if key in raw_data and raw_data.get(key) not in (None, ''):
                    return str(raw_data.get(key))
                if key in normalized_data and normalized_data.get(key) not in (None, ''):
                    return str(normalized_data.get(key))
            return ''

        for row in batch.rows.all().order_by('row_number'):
            raw_data = row.raw_data if isinstance(row.raw_data, dict) else {}
            normalized_data = row.normalized_data if isinstance(row.normalized_data, dict) else {}

            product_name = _pick_value(raw_data, normalized_data, ['Product Name', 'product_name', 'Name', 'name'])
            sku = _pick_value(raw_data, normalized_data, ['SKU', 'sku', 'code'])
            barcode = _pick_value(raw_data, normalized_data, ['Barcode', 'barcode', 'bar_code'])
            category = _pick_value(raw_data, normalized_data, ['Category', 'category', 'category_name'])
            price = _pick_value(raw_data, normalized_data, ['Retail Price', 'retail_price', 'price'])
            cost = _pick_value(raw_data, normalized_data, ['Cost Price', 'cost_price', 'cost'])
            stock = _pick_value(raw_data, normalized_data, ['Initial Stock Qty', 'initial_stock_qty', 'stock', 'quantity'])

            mismatch = apply_error_map.get(row.row_number)
            if not mismatch and row.errors:
                mismatch = ', '.join(row.errors)
            if not mismatch and row.warnings:
                mismatch = ', '.join(row.warnings)
            if not mismatch:
                mismatch = '-'

            if row.status == ImportRowResult.STATUS_INVALID:
                display_status = 'Invalid'
            elif row.row_number in apply_error_map:
                display_status = 'Failed'
            elif row.status == ImportRowResult.STATUS_WARNING:
                display_status = 'Warning'
            elif batch.status == ImportBatch.STATUS_APPLIED and row.action != ImportRowResult.ACTION_SKIP:
                display_status = 'Imported'
            elif batch.is_approved and row.action != ImportRowResult.ACTION_SKIP:
                display_status = 'Ready'
            else:
                display_status = 'Pending'

            item = {
                'row_number': row.row_number,
                'product_name': product_name or '-',
                'sku': sku or '-',
                'barcode': barcode or '-',
                'category': category or '-',
                'price': price or '-',
                'cost': cost or '-',
                'stock': stock or '-',
                'status': display_status,
                'mismatch_error': mismatch,
                'action': row.action,
                'matched_product_id': normalized_data.get('matched_product_id') or '',
                'raw_data': raw_data,
                'normalized_data': normalized_data,
                'identity_key': row.identity_key,
            }

            if search:
                searchable = ' '.join([
                    str(item['row_number']),
                    item['product_name'],
                    item['sku'],
                    item['barcode'],
                    item['category'],
                    item['status'],
                    item['mismatch_error'],
                ]).lower()
                if search not in searchable:
                    continue

            rows.append(item)

        total_count = len(rows)
        total_pages = max(1, (total_count + page_size - 1) // page_size)
        if page > total_pages:
            page = total_pages

        start = (page - 1) * page_size
        end = start + page_size

        return Response({
            'batch_id': str(batch.id),
            'status': batch.status,
            'is_approved': batch.is_approved,
            'import_date': batch.created_at,
            'source_filename': batch.source_filename,
            'outlet': {
                'id': str(batch.outlet_id),
                'name': getattr(batch.outlet, 'name', ''),
            },
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages,
            'results': rows[start:end],
        })


class ProductImportMissingProductsView(BaseImportView):
    def get(self, request, batch_id):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        sync_mode = self._resolve_sync_mode(request)

        try:
            batch = ImportBatch.objects.select_related('outlet').get(
                id=batch_id,
                tenant=tenant,
                entity_type=ImportBatch.ENTITY_PRODUCTS,
            )
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if sync_mode and batch.sync_mode != sync_mode:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if batch.sync_mode != ImportBatch.MODE_INVENTORY_SYNC:
            return Response({'detail': 'Missing-products list is available for inventory sync mode only.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except (TypeError, ValueError):
            return Response({'detail': 'page must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            page_size = max(1, min(int(request.query_params.get('page_size', 50)), 200))
        except (TypeError, ValueError):
            return Response({'detail': 'page_size must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)

        search = (request.query_params.get('search') or '').strip().lower()
        include_inactive = str(request.query_params.get('include_inactive', 'false')).lower() in ('1', 'true', 'yes', 'y')

        batch_identity_keys = set(
            batch.rows.exclude(identity_key='').values_list('identity_key', flat=True)
        )

        products_qs = Product.objects.filter(tenant=tenant, outlet=batch.outlet).select_related('category').order_by('name', 'id')
        if not include_inactive:
            products_qs = products_qs.filter(is_active=True, is_archived=False)
        else:
            products_qs = products_qs.filter(is_archived=False)

        missing_products = []

        for product in products_qs:
            candidates = []
            sku = str(product.sku or '').strip()
            barcode = str(product.barcode or '').strip()
            name = str(product.name or '').strip()

            if sku:
                candidates.append(f"sku:{sku.lower()}")
            if barcode:
                candidates.append(f"barcode:{barcode.lower()}")
            if name:
                candidates.append(f"name:{name.lower()}")

            if candidates and any(candidate in batch_identity_keys for candidate in candidates):
                continue

            available_stock = get_available_stock(product, batch.outlet)
            item = {
                'id': str(product.id),
                'name': product.name or '',
                'sku': sku,
                'barcode': barcode,
                'category': getattr(product.category, 'name', '') if product.category_id else '',
                'sellable_stock': int(available_stock or 0),
                'low_stock_threshold': int(product.low_stock_threshold or 0),
                'retail_price': str(product.retail_price or ''),
                'is_active': bool(product.is_active),
            }

            if search:
                searchable = ' '.join([
                    item['name'],
                    item['sku'],
                    item['barcode'],
                    item['category'],
                ]).lower()
                if search not in searchable:
                    continue

            missing_products.append(item)

        total_count = len(missing_products)
        total_pages = max(1, (total_count + page_size - 1) // page_size)
        if page > total_pages:
            page = total_pages

        start = (page - 1) * page_size
        end = start + page_size

        return Response({
            'batch_id': str(batch.id),
            'status': batch.status,
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages,
            'results': missing_products[start:end],
        })


class ProductImportRowUpdateView(BaseImportView):
    def patch(self, request, batch_id, row_number):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        sync_mode = self._resolve_sync_mode(request)

        try:
            batch = ImportBatch.objects.select_related('outlet').get(
                id=batch_id,
                tenant=tenant,
                entity_type=ImportBatch.ENTITY_PRODUCTS,
            )
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if sync_mode and batch.sync_mode != sync_mode:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if batch.status == ImportBatch.STATUS_APPLYING:
            return Response({'detail': 'Cannot edit rows while apply is running.'}, status=status.HTTP_409_CONFLICT)
        if batch.status == ImportBatch.STATUS_APPLIED:
            return Response({'detail': 'Cannot edit rows after apply is completed.'}, status=status.HTTP_409_CONFLICT)

        try:
            row = ImportRowResult.objects.get(batch=batch, row_number=row_number)
        except ImportRowResult.DoesNotExist:
            return Response({'detail': 'Import row not found'}, status=status.HTTP_404_NOT_FOUND)

        payload = request.data if isinstance(request.data, dict) else {}
        normalized = row.normalized_data if isinstance(row.normalized_data, dict) else {}
        incoming = {
            'name': payload.get('product_name', normalized.get('name', '')),
            'sku': payload.get('sku', normalized.get('sku', '')),
            'barcode': payload.get('barcode', normalized.get('barcode', '')),
            'category': payload.get('category', normalized.get('category', '')),
            'retail_price': payload.get('price', normalized.get('retail_price', '')),
            'wholesale_price': payload.get('wholesale_price', normalized.get('wholesale_price', '')),
            'cost_price': payload.get('cost', normalized.get('cost_price', '')),
            'stock': payload.get('stock', normalized.get('stock', '')),
            'low_stock_threshold': payload.get('low_stock_threshold', normalized.get('low_stock_threshold', '0')),
            'batch_expiry_date': payload.get('batch_expiry_date', normalized.get('batch_expiry_date', '')),
            'description': payload.get('description', normalized.get('description', '')),
            'is_active': payload.get('is_active', normalized.get('is_active', 'yes')),
        }

        if batch.sync_mode == ImportBatch.MODE_INVENTORY_SYNC:
            computed = self._build_sync_row_from_payload(incoming, tenant=tenant, outlet=batch.outlet)
            normalized_out = computed['normalized_data']
        else:
            computed = self._build_upsert_row_from_payload(incoming, tenant=tenant, outlet=batch.outlet)
            normalized_out = {
                **computed['normalized_data'],
                'category': str(incoming.get('category') or '').strip(),
                'cost_price': str(incoming.get('cost_price') or '').strip(),
                'stock': str(incoming.get('stock') or '').strip(),
                'low_stock_threshold': str(incoming.get('low_stock_threshold') or '').strip(),
                'description': str(incoming.get('description') or '').strip(),
                'is_active': self._coerce_bool_text(incoming.get('is_active'), default='yes'),
            }

        row.status = computed['status']
        row.action = computed['action']
        row.identity_key = computed['identity_key']
        row.errors = computed['errors']
        row.warnings = computed['warnings']
        row.normalized_data = normalized_out
        row.raw_data = {
            'Product Name': normalized_out.get('name', ''),
            'SKU': normalized_out.get('sku', ''),
            'Barcode': normalized_out.get('barcode', ''),
            'Category': normalized_out.get('category', ''),
            'Retail Price': normalized_out.get('retail_price', ''),
            'Cost Price': normalized_out.get('cost_price', ''),
            'Initial Stock Qty': normalized_out.get('stock', ''),
            'Low Stock Threshold': normalized_out.get('low_stock_threshold', ''),
            'Description': normalized_out.get('description', ''),
            'Is Active': normalized_out.get('is_active', 'yes'),
        }
        row.save(update_fields=['status', 'action', 'identity_key', 'errors', 'warnings', 'normalized_data', 'raw_data'])

        with transaction.atomic():
            batch.apply_errors.all().delete()
            if batch.status == ImportBatch.STATUS_FAILED:
                batch.status = ImportBatch.STATUS_PREVIEW_READY
            batch.is_approved = False
            batch.approved_by = None
            batch.approved_at = None
            batch.apply_summary = {}
            batch.applied_rows = 0
            batch.applied_at = None
            self._recompute_batch_preview_totals(batch)
            batch.save(update_fields=[
                'status', 'is_approved', 'approved_by', 'approved_at',
                'apply_summary', 'applied_rows', 'applied_at',
                'total_rows', 'valid_rows', 'invalid_rows', 'warning_rows',
                'preview_summary', 'updated_at',
            ])
            ImportAuditEvent.objects.create(
                batch=batch,
                event_type='row_updated',
                message=f'Row {row.row_number} updated in staged import batch.',
                metadata={
                    'row_number': row.row_number,
                    'status': row.status,
                    'action': row.action,
                    'errors': row.errors,
                    'warnings': row.warnings,
                },
                created_by=request.user,
            )

        return Response({
            'batch_id': str(batch.id),
            'row_number': row.row_number,
            'status': row.status,
            'action': row.action,
            'errors': row.errors,
            'warnings': row.warnings,
            'normalized_data': row.normalized_data,
            'preview_summary': batch.preview_summary,
        })


class ProductImportSourceDownloadView(BaseImportView):
    def get(self, request, batch_id):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        sync_mode = self._resolve_sync_mode(request)

        try:
            batch = ImportBatch.objects.get(id=batch_id, tenant=tenant, entity_type=ImportBatch.ENTITY_PRODUCTS)
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if sync_mode and batch.sync_mode != sync_mode:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if not batch.source_file:
            return Response({'detail': 'No source file available for this batch.'}, status=status.HTTP_404_NOT_FOUND)

        response = FileResponse(batch.source_file.open('rb'), as_attachment=True, filename=batch.source_filename)
        return response


class ProductImportApproveView(BaseImportView):
    def post(self, request, batch_id):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            batch = ImportBatch.objects.get(id=batch_id, tenant=tenant, entity_type=ImportBatch.ENTITY_PRODUCTS)
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if batch.status == ImportBatch.STATUS_APPROVED and batch.is_approved:
            return Response({
                'batch_id': str(batch.id),
                'status': batch.status,
                'is_approved': batch.is_approved,
                'approved_at': batch.approved_at,
            })

        if batch.status not in [ImportBatch.STATUS_PREVIEW_READY, ImportBatch.STATUS_FAILED, ImportBatch.STATUS_CANCELLED]:
            return Response({'detail': f'Batch cannot be approved in current status: {batch.status}'}, status=status.HTTP_409_CONFLICT)

        # Failed/cancelled batches move back into approval stage for a new apply attempt.
        if batch.status in [ImportBatch.STATUS_FAILED, ImportBatch.STATUS_CANCELLED]:
            batch.status = ImportBatch.STATUS_APPROVED
        else:
            batch.status = ImportBatch.STATUS_APPROVED

        batch.is_approved = True
        batch.approved_by = request.user
        batch.approved_at = timezone.now()
        batch.save(update_fields=['status', 'is_approved', 'approved_by', 'approved_at', 'updated_at'])

        ImportAuditEvent.objects.create(
            batch=batch,
            event_type='approved',
            message='Batch approved for apply',
            metadata={'approved_at': batch.approved_at.isoformat()},
            created_by=request.user,
        )

        return Response({
            'batch_id': str(batch.id),
            'status': batch.status,
            'is_approved': batch.is_approved,
            'approved_at': batch.approved_at,
        })


class ProductImportCancelView(BaseImportView):
    def post(self, request, batch_id):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        sync_mode = self._resolve_sync_mode(request)

        try:
            batch = ImportBatch.objects.get(id=batch_id, tenant=tenant, entity_type=ImportBatch.ENTITY_PRODUCTS)
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if sync_mode and batch.sync_mode != sync_mode:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if batch.status == ImportBatch.STATUS_CANCELLED:
            return Response({
                'batch_id': str(batch.id),
                'status': batch.status,
                'is_approved': batch.is_approved,
                'already_cancelled': True,
            })

        if batch.status == ImportBatch.STATUS_APPLYING:
            return Response({'detail': 'Cannot cancel while apply is in progress.'}, status=status.HTTP_409_CONFLICT)

        if batch.status == ImportBatch.STATUS_APPLIED:
            return Response(
                {'detail': 'Applied batches must be reversed using rollback before cancellation.'},
                status=status.HTTP_409_CONFLICT,
            )

        with transaction.atomic():
            batch.status = ImportBatch.STATUS_CANCELLED
            batch.is_approved = False
            batch.approved_by = None
            batch.approved_at = None
            batch.apply_idempotency_key = None
            batch.save(update_fields=['status', 'is_approved', 'approved_by', 'approved_at', 'apply_idempotency_key', 'updated_at'])

            ImportAuditEvent.objects.create(
                batch=batch,
                event_type='cancelled',
                message='Import sync process cancelled.',
                metadata={'cancelled_at': timezone.now().isoformat()},
                created_by=request.user,
            )

        return Response({
            'batch_id': str(batch.id),
            'status': batch.status,
            'is_approved': batch.is_approved,
        })


class ProductImportRecoverView(BaseImportView):
    def post(self, request, batch_id):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        sync_mode = self._resolve_sync_mode(request)

        try:
            source_batch = ImportBatch.objects.get(id=batch_id, tenant=tenant, entity_type=ImportBatch.ENTITY_PRODUCTS)
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if sync_mode and source_batch.sync_mode != sync_mode:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if source_batch.sync_mode != ImportBatch.MODE_INVENTORY_SYNC:
            return Response({'detail': 'Recovery is available for inventory sync batches only.'}, status=status.HTTP_400_BAD_REQUEST)

        if source_batch.status != ImportBatch.STATUS_APPLIED:
            return Response(
                {'detail': f'Only applied batches can be recovered (current status={source_batch.status}).'},
                status=status.HTTP_409_CONFLICT,
            )

        restore_previous_state = str(request.data.get('restore_previous_state', 'false')).lower() in ('1', 'true', 'yes', 'y')
        auto_apply = str(request.data.get('auto_apply', 'false')).lower() in ('1', 'true', 'yes', 'y')
        delete_source_batch = str(request.data.get('delete_source_batch', 'false')).lower() in ('1', 'true', 'yes', 'y')

        template_batch = source_batch
        recovered_from_previous_batch = False
        if restore_previous_state:
            template_batch = ImportBatch.objects.filter(
                tenant=tenant,
                entity_type=ImportBatch.ENTITY_PRODUCTS,
                sync_mode=source_batch.sync_mode,
                outlet=source_batch.outlet,
                status=ImportBatch.STATUS_APPLIED,
                created_at__lt=source_batch.created_at,
            ).order_by('-created_at').first()

            if not template_batch:
                template_batch = source_batch
            else:
                recovered_from_previous_batch = True

        source_rows = list(template_batch.rows.all().order_by('row_number'))
        if not source_rows:
            return Response({'detail': 'No staged rows found in this batch.'}, status=status.HTTP_400_BAD_REQUEST)

        total_rows = len(source_rows)
        invalid_rows = sum(1 for row in source_rows if row.status == ImportRowResult.STATUS_INVALID)
        warning_rows = sum(1 for row in source_rows if row.status == ImportRowResult.STATUS_WARNING)
        valid_rows = max(0, total_rows - invalid_rows)

        sync_strategy = (
            (template_batch.preview_summary or {}).get('sync_strategy')
            or (template_batch.apply_summary or {}).get('sync_strategy')
            or self.SYNC_STRATEGY_FULL_SYNC
        )

        preview_summary = {
            'total_rows': total_rows,
            'valid_rows': valid_rows,
            'invalid_rows': invalid_rows,
            'warning_rows': warning_rows,
            'sync_strategy': sync_strategy,
        }

        with transaction.atomic():
            recovered_batch = ImportBatch.objects.create(
                tenant=source_batch.tenant,
                outlet=source_batch.outlet,
                entity_type=source_batch.entity_type,
                sync_mode=source_batch.sync_mode,
                status=ImportBatch.STATUS_PREVIEW_READY,
                source_filename=template_batch.source_filename,
                source_file=template_batch.source_file,
                total_rows=total_rows,
                valid_rows=valid_rows,
                invalid_rows=invalid_rows,
                warning_rows=warning_rows,
                preview_summary=preview_summary,
                created_by=request.user,
                previewed_at=timezone.now(),
            )

            ImportRowResult.objects.bulk_create([
                ImportRowResult(
                    batch=recovered_batch,
                    row_number=row.row_number,
                    status=row.status,
                    action=row.action,
                    identity_key=row.identity_key,
                    errors=row.errors,
                    warnings=row.warnings,
                    raw_data=row.raw_data,
                    normalized_data=row.normalized_data,
                )
                for row in source_rows
            ], batch_size=500)

            ImportAuditEvent.objects.create(
                batch=recovered_batch,
                event_type='recovery_created',
                message='Recovery batch created from applied inventory sync.',
                metadata={
                    'source_batch_id': str(source_batch.id),
                    'template_batch_id': str(template_batch.id),
                    'sync_strategy': sync_strategy,
                    'rows_copied': total_rows,
                    'restore_previous_state': restore_previous_state,
                    'recovered_from_previous_batch': recovered_from_previous_batch,
                    'auto_apply': auto_apply,
                    'delete_source_batch': delete_source_batch,
                },
                created_by=request.user,
            )

            ImportAuditEvent.objects.create(
                batch=source_batch,
                event_type='recovery_requested',
                message='Recovery batch created from this applied sync batch.',
                metadata={
                    'recovered_batch_id': str(recovered_batch.id),
                    'template_batch_id': str(template_batch.id),
                    'sync_strategy': sync_strategy,
                    'rows_copied': total_rows,
                    'restore_previous_state': restore_previous_state,
                    'recovered_from_previous_batch': recovered_from_previous_batch,
                    'auto_apply': auto_apply,
                    'delete_source_batch': delete_source_batch,
                },
                created_by=request.user,
            )

        apply_response = None
        source_batch_deleted = False
        source_batch_deleted_id = None

        if auto_apply:
            recovered_batch.is_approved = True
            recovered_batch.approved_by = request.user
            recovered_batch.approved_at = timezone.now()
            recovered_batch.save(update_fields=['is_approved', 'approved_by', 'approved_at', 'updated_at'])

            apply_response = self._apply_inventory_sync_batch(request, recovered_batch, sync_strategy)
            apply_success = int(getattr(apply_response, 'status_code', 500)) == status.HTTP_200_OK

            if delete_source_batch and apply_success:
                source_batch_deleted_id = str(source_batch.id)
                source_batch.delete()
                source_batch_deleted = True

        return Response({
            'source_batch_id': str(source_batch.id),
            'template_batch_id': str(template_batch.id),
            'batch_id': str(recovered_batch.id),
            'status': recovered_batch.status,
            'is_approved': recovered_batch.is_approved,
            'sync_strategy': sync_strategy,
            'preview_summary': recovered_batch.preview_summary,
            'restore_previous_state': restore_previous_state,
            'recovered_from_previous_batch': recovered_from_previous_batch,
            'auto_apply': auto_apply,
            'source_batch_deleted': source_batch_deleted,
            'source_batch_deleted_id': source_batch_deleted_id,
            'apply_summary': recovered_batch.apply_summary if auto_apply else None,
        }, status=status.HTTP_201_CREATED)


class ProductImportRollbackPreviewView(BaseImportView):
    def post(self, request, batch_id):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        sync_mode = self._resolve_sync_mode(request)

        try:
            batch = ImportBatch.objects.select_related('outlet').get(
                id=batch_id,
                tenant=tenant,
                entity_type=ImportBatch.ENTITY_PRODUCTS,
            )
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if sync_mode and batch.sync_mode != sync_mode:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if batch.sync_mode != ImportBatch.MODE_INVENTORY_SYNC:
            return Response({'detail': 'Rollback is available for inventory sync batches only.'}, status=status.HTTP_400_BAD_REQUEST)

        if batch.status != ImportBatch.STATUS_APPLIED:
            return Response({'detail': f'Only applied batches can be rolled back (current status={batch.status}).'}, status=status.HTTP_409_CONFLICT)

        mutations = list(
            batch.stock_mutations.select_related('product', 'outlet').filter(rolled_back=False).order_by('row_number', 'id')
        )
        if not mutations:
            return Response({
                'batch_id': str(batch.id),
                'can_rollback': False,
                'detail': 'No stock mutations available to roll back for this batch.',
                'summary': {
                    'rows': 0,
                    'products': 0,
                    'net_delta': 0,
                    'estimated_reversed_increases': 0,
                    'estimated_reversed_decreases': 0,
                    'would_be_negative': 0,
                },
                'results': [],
            })

        results = []
        net_delta = 0
        reversed_increases = 0
        reversed_decreases = 0
        would_be_negative = 0

        for mutation in mutations:
            current_quantity = int(get_available_stock(mutation.product, mutation.outlet) or 0)
            reverse_delta = -int(mutation.quantity_delta or 0)
            projected_quantity = current_quantity + reverse_delta
            is_negative = projected_quantity < 0
            if is_negative:
                would_be_negative += 1

            if reverse_delta > 0:
                reversed_increases += 1
            elif reverse_delta < 0:
                reversed_decreases += 1

            net_delta += reverse_delta
            results.append({
                'mutation_id': mutation.id,
                'row_number': mutation.row_number,
                'product_id': str(mutation.product_id),
                'product_name': mutation.product.name,
                'outlet_id': str(mutation.outlet_id),
                'before_quantity': mutation.before_quantity,
                'applied_quantity': mutation.applied_quantity,
                'original_delta': mutation.quantity_delta,
                'reverse_delta': reverse_delta,
                'current_quantity': current_quantity,
                'projected_quantity': projected_quantity,
                'would_be_negative': is_negative,
            })

        return Response({
            'batch_id': str(batch.id),
            'can_rollback': would_be_negative == 0,
            'summary': {
                'rows': len(mutations),
                'products': len({m.product_id for m in mutations}),
                'net_delta': net_delta,
                'estimated_reversed_increases': reversed_increases,
                'estimated_reversed_decreases': reversed_decreases,
                'would_be_negative': would_be_negative,
            },
            'results': results,
        })


class ProductImportRollbackExecuteView(BaseImportView):
    def post(self, request, batch_id):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        sync_mode = self._resolve_sync_mode(request)

        try:
            batch = ImportBatch.objects.select_related('outlet').get(
                id=batch_id,
                tenant=tenant,
                entity_type=ImportBatch.ENTITY_PRODUCTS,
            )
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if sync_mode and batch.sync_mode != sync_mode:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if batch.sync_mode != ImportBatch.MODE_INVENTORY_SYNC:
            return Response({'detail': 'Rollback is available for inventory sync batches only.'}, status=status.HTTP_400_BAD_REQUEST)

        if batch.status != ImportBatch.STATUS_APPLIED:
            return Response({'detail': f'Only applied batches can be rolled back (current status={batch.status}).'}, status=status.HTTP_409_CONFLICT)

        confirm = self._coerce_bool(request.data.get('confirm'), default=False)
        if not confirm:
            return Response(
                {'detail': 'Rollback confirmation required. Send {"confirm": true}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rollback_idempotency_key = request.headers.get('X-Idempotency-Key') or request.data.get('idempotency_key')
        if rollback_idempotency_key:
            existing_event = ImportAuditEvent.objects.filter(
                batch=batch,
                event_type='rollback_completed',
                metadata__rollback_idempotency_key=rollback_idempotency_key,
            ).order_by('-created_at').first()
            if existing_event:
                return Response({
                    'batch_id': str(batch.id),
                    'status': 'rolled_back',
                    'idempotent_reuse': True,
                    'rollback': existing_event.metadata,
                })

        mutations = list(
            batch.stock_mutations.select_related('product', 'outlet').filter(rolled_back=False).order_by('row_number', 'id')
        )
        if not mutations:
            return Response({'detail': 'No stock mutations left to roll back for this batch.'}, status=status.HTTP_409_CONFLICT)

        try:
            with transaction.atomic():
                adjusted = 0
                errors = []

                for mutation in mutations:
                    current_quantity = int(get_available_stock(mutation.product, mutation.outlet) or 0)
                    reverse_delta = -int(mutation.quantity_delta or 0)
                    target_quantity = current_quantity + reverse_delta

                    if target_quantity < 0:
                        errors.append({
                            'mutation_id': mutation.id,
                            'product_id': str(mutation.product_id),
                            'product_name': mutation.product.name,
                            'current_quantity': current_quantity,
                            'reverse_delta': reverse_delta,
                            'projected_quantity': target_quantity,
                        })
                        continue

                    adjust_stock(
                        product=mutation.product,
                        outlet=mutation.outlet,
                        new_quantity=target_quantity,
                        user=request.user,
                        reason=f'Inventory sync rollback batch {batch.id} row {mutation.row_number}',
                    )
                    mutation.rolled_back = True
                    mutation.rolled_back_at = timezone.now()
                    mutation.save(update_fields=['rolled_back', 'rolled_back_at'])
                    adjusted += 1

                if errors:
                    raise ValueError(errors)

                rollback_metadata = {
                    'batch_id': str(batch.id),
                    'mutations_total': len(mutations),
                    'mutations_reversed': adjusted,
                    'rollback_idempotency_key': rollback_idempotency_key,
                    'rolled_back_at': timezone.now().isoformat(),
                }
                ImportAuditEvent.objects.create(
                    batch=batch,
                    event_type='rollback_completed',
                    message='Inventory sync rollback completed',
                    metadata=rollback_metadata,
                    created_by=request.user,
                )

                apply_summary = batch.apply_summary if isinstance(batch.apply_summary, dict) else {}
                apply_summary['rollback'] = {
                    'completed': True,
                    'mutations_reversed': adjusted,
                    'rolled_back_at': timezone.now().isoformat(),
                }
                batch.apply_summary = apply_summary
                batch.status = ImportBatch.STATUS_CANCELLED
                batch.is_approved = False
                batch.save(update_fields=['apply_summary', 'status', 'is_approved', 'updated_at'])
        except ValueError as rollback_error:
            details = rollback_error.args[0] if rollback_error.args else []
            return Response(
                {
                    'detail': 'Rollback aborted because at least one product would go negative.',
                    'errors': details,
                },
                status=status.HTTP_409_CONFLICT,
            )

        return Response({
            'batch_id': str(batch.id),
            'status': batch.status,
            'rollback': {
                'mutations_total': len(mutations),
                'mutations_reversed': len(mutations),
            },
        })


class ProductImportErrorsView(BaseImportView):
    def get(self, request, batch_id):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        sync_mode = self._resolve_sync_mode(request)

        try:
            batch = ImportBatch.objects.get(id=batch_id, tenant=tenant, entity_type=ImportBatch.ENTITY_PRODUCTS)
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if sync_mode and batch.sync_mode != sync_mode:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        rows = batch.rows.filter(status=ImportRowResult.STATUS_INVALID).order_by('row_number')[:500]
        apply_errors = batch.apply_errors.order_by('created_at', 'row_number')[:500]
        return Response({
            'batch_id': str(batch.id),
            'preview_error_count': rows.count(),
            'preview_errors': [
                {
                    'row_number': row.row_number,
                    'errors': row.errors,
                    'raw_data': row.raw_data,
                }
                for row in rows
            ],
            'apply_error_count': apply_errors.count(),
            'apply_errors': [
                {
                    'row_number': err.row_number,
                    'chunk_index': err.chunk_index,
                    'error_code': err.error_code,
                    'message': err.message,
                    'details': err.details,
                    'raw_data': err.raw_data,
                }
                for err in apply_errors
            ],
        })


class StockTakeImportPreviewView(BaseImportView):
    def post(self, request, stock_take_id):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            stock_take = StockTake.objects.select_related('outlet', 'tenant').get(id=stock_take_id, tenant=tenant)
        except StockTake.DoesNotExist:
            return Response({'detail': 'Stock take not found'}, status=status.HTTP_404_NOT_FOUND)

        outlet_hint = request.headers.get('X-Outlet-ID') or request.query_params.get('outlet') or request.data.get('outlet')
        if outlet_hint not in (None, ''):
            try:
                outlet_hint_id = int(outlet_hint)
            except (TypeError, ValueError):
                return Response({'detail': f'Invalid outlet: {outlet_hint}'}, status=status.HTTP_400_BAD_REQUEST)

            if outlet_hint_id != stock_take.outlet_id:
                return Response({'detail': 'Stock take does not belong to the current outlet.'}, status=status.HTTP_403_FORBIDDEN)

        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({'detail': 'file is required'}, status=status.HTTP_400_BAD_REQUEST)

        rows_json_payload = request.data.get('rows_json')
        parsed_rows_payload: List[Dict[str, Any]] = []
        if rows_json_payload not in (None, ''):
            try:
                decoded_rows = json.loads(rows_json_payload) if isinstance(rows_json_payload, str) else rows_json_payload
            except Exception:
                return Response({'detail': 'rows_json must be valid JSON.'}, status=status.HTTP_400_BAD_REQUEST)

            if not isinstance(decoded_rows, list):
                return Response({'detail': 'rows_json must be a JSON array.'}, status=status.HTTP_400_BAD_REQUEST)

            for payload_row in decoded_rows:
                if not isinstance(payload_row, dict):
                    continue

                parsed_rows_payload.append({
                    'Product Name': payload_row.get('productName') or payload_row.get('product_name') or payload_row.get('Product Name') or '',
                    'SKU': payload_row.get('sku') or payload_row.get('SKU') or '',
                    'Barcode': payload_row.get('barcode') or payload_row.get('Barcode') or '',
                    'Counted Quantity': payload_row.get('countedQuantity') if payload_row.get('countedQuantity') is not None else payload_row.get('counted_quantity', payload_row.get('Counted Quantity', '')),
                })

        idempotency_key = request.headers.get('X-Idempotency-Key') or request.data.get('idempotency_key')
        if idempotency_key:
            existing_batch = ImportBatch.objects.filter(
                tenant=tenant,
                entity_type=ImportBatch.ENTITY_STOCK_TAKE,
                stock_take=stock_take,
                idempotency_key=idempotency_key,
            ).first()
            if existing_batch:
                return Response({
                    'batch_id': str(existing_batch.id),
                    'status': existing_batch.status,
                    'summary': existing_batch.preview_summary,
                    'idempotent_reuse': True,
                })

        processing_started_at = timezone.now()
        try:
            try:
                df = self._read_dataframe(uploaded_file)
            except Exception as file_parse_exc:
                if not parsed_rows_payload:
                    raise file_parse_exc

                logger.warning(
                    'Stock take preview file parser failed; using rows_json fallback. stock_take_id=%s error=%s',
                    stock_take_id,
                    file_parse_exc,
                )
                df = pd.DataFrame(parsed_rows_payload)

            df, column_mapping = self._normalize_columns(df)

            name_col = self._pick_first_column(column_mapping, 'product_name', 'name', 'product', 'item_name')
            sku_col = self._pick_first_column(column_mapping, 'sku', 'code', 'product_code')
            barcode_col = self._pick_first_column(column_mapping, 'barcode', 'bar_code', 'barcodevalue')
            qty_col = self._pick_first_column(column_mapping, 'counted_quantity', 'quantity', 'count', 'stock')

            if not qty_col:
                return Response({'detail': 'Counted Quantity column is required.'}, status=status.HTTP_400_BAD_REQUEST)

            stocktake_items = [self._stocktake_item_payload(item) for item in stock_take.items.select_related('product').all()]
            item_lookup = {item['product_id']: item for item in stocktake_items if item.get('product_id')}
            seen_identity: Dict[str, int] = {}
            row_results: List[Dict[str, Any]] = []

            for idx, row in df.iterrows():
                if self._is_effectively_blank_row(row):
                    continue

                row_number = idx + 2
                raw_data = {str(k): (None if pd.isna(v) else str(v)) for k, v in row.to_dict().items()}
                errors: List[Dict[str, Any]] = []
                warnings: List[Dict[str, Any]] = []

                product_name = self._clean_text(row[name_col]) if name_col in row else ''
                sku = self._clean_text(row[sku_col]) if sku_col in row else ''
                barcode = self._clean_text(row[barcode_col]) if barcode_col in row else ''
                identity = self._normalize_identity(product_name or sku or barcode, sku, barcode)

                qty_value = row[qty_col] if qty_col in row else None
                counted_quantity = None
                if pd.notna(qty_value) and self._clean_text(qty_value) != '':
                    try:
                        counted_quantity = int(float(qty_value))
                        if counted_quantity < 0:
                            errors.append(self._structured_rejection(
                                'INVALID_QUANTITY',
                                'Counted quantity must be 0 or greater.',
                                'Enter a valid non-negative quantity.',
                                field='counted_quantity',
                            ))
                    except (TypeError, ValueError):
                        errors.append(self._structured_rejection(
                            'INVALID_QUANTITY',
                            f'Invalid counted quantity: {qty_value}',
                            'Enter a whole number for counted quantity.',
                            field='counted_quantity',
                        ))
                else:
                    errors.append(self._structured_rejection(
                        'MISSING_REQUIRED_FIELDS',
                        'Counted quantity is required.',
                        'Add a counted quantity before re-importing.',
                        field='counted_quantity',
                    ))

                match_item = None
                match_error = None
                if not errors:
                    match_item, match_error = self._match_stocktake_item(product_name, sku, barcode, stocktake_items)
                    if match_error:
                        errors.append(match_error)

                duplicate_count = seen_identity.get(identity, 0)
                if duplicate_count > 0:
                    warnings.append(self._structured_rejection(
                        'DUPLICATE_PRODUCT_IN_FILE',
                        'This product appears more than once in the uploaded file.',
                        'Keep one row per product or review the aggregated count before applying.',
                    ))
                seen_identity[identity] = duplicate_count + 1

                quantity_before = int(match_item.get('quantity_before', 0) if match_item else 0)
                quantity_after = int(counted_quantity if counted_quantity is not None else quantity_before)

                status_value = ImportRowResult.STATUS_VALID
                action_value = ImportRowResult.ACTION_UPDATE
                if errors:
                    status_value = ImportRowResult.STATUS_INVALID
                    action_value = ImportRowResult.ACTION_SKIP
                elif warnings:
                    status_value = ImportRowResult.STATUS_WARNING

                normalized_data = {
                    'product_name': product_name,
                    'sku': sku,
                    'barcode': barcode,
                    'counted_quantity': str(counted_quantity if counted_quantity is not None else ''),
                    'matched_product_id': match_item['product_id'] if match_item else '',
                    'matched_item_id': match_item['id'] if match_item else '',
                    'expected_quantity': str(quantity_before),
                    'quantity_after': str(quantity_after),
                    'duplicate_count': str(duplicate_count),
                }

                row_results.append({
                    'row_number': row_number,
                    'status': status_value,
                    'action': action_value,
                    'identity_key': identity,
                    'errors': errors,
                    'warnings': warnings,
                    'raw_data': raw_data,
                    'normalized_data': normalized_data,
                })

            total_rows = len(row_results)
            accepted_rows = sum(1 for row in row_results if row['status'] in {ImportRowResult.STATUS_VALID, ImportRowResult.STATUS_WARNING})
            rejected_rows = sum(1 for row in row_results if row['status'] == ImportRowResult.STATUS_INVALID)
            duplicate_rows = sum(1 for row in row_results if any(err.get('code') == 'DUPLICATE_PRODUCT_IN_FILE' for err in row['warnings']))
            processing_time_ms = int((timezone.now() - processing_started_at).total_seconds() * 1000)

            summary_payload = {
                'stock_take_id': str(stock_take.id),
                'stock_take_status': stock_take.status,
                'source_filename': uploaded_file.name,
                'total_rows': total_rows,
                'accepted_rows': accepted_rows,
                'rejected_rows': rejected_rows,
                'duplicate_rows': duplicate_rows,
                'processing_time_ms': processing_time_ms,
                'validation_messages': [
                    err
                    for row in row_results
                    for err in row['errors']
                ],
            }

            with transaction.atomic():
                batch_kwargs = {
                    'tenant': tenant,
                    'outlet': stock_take.outlet,
                    'stock_take': stock_take,
                    'entity_type': ImportBatch.ENTITY_STOCK_TAKE,
                    'sync_mode': ImportBatch.MODE_UPSERT_ADJUST,
                    'status': ImportBatch.STATUS_PREVIEW_READY,
                    'source_filename': uploaded_file.name,
                    'source_file': uploaded_file,
                    'idempotency_key': idempotency_key,
                    'total_rows': total_rows,
                    'valid_rows': accepted_rows,
                    'invalid_rows': rejected_rows,
                    'warning_rows': duplicate_rows,
                    'preview_summary': summary_payload,
                    'created_by': request.user,
                    'previewed_at': timezone.now(),
                }

                try:
                    # Use an inner savepoint so storage upload failures do not poison the outer transaction.
                    with transaction.atomic():
                        batch = ImportBatch.objects.create(**batch_kwargs)
                except Exception as source_file_exc:
                    error_text = str(source_file_exc).lower()
                    if 'unsupported zip file' not in error_text:
                        raise

                    logger.warning(
                        'Stock take preview source file upload failed; retrying without source_file. stock_take_id=%s error=%s',
                        stock_take.id,
                        source_file_exc,
                    )

                    # Continue preview even when storage rejects workbook formats (e.g., zipped xlsx upload restrictions).
                    summary_payload = {
                        **summary_payload,
                        'source_file_storage_warning': 'Source file could not be stored by configured media storage. Preview and apply remain available.',
                    }
                    batch_kwargs['preview_summary'] = summary_payload
                    batch_kwargs['source_file'] = None
                    with transaction.atomic():
                        batch = ImportBatch.objects.create(**batch_kwargs)

                ImportRowResult.objects.bulk_create([
                    ImportRowResult(
                        batch=batch,
                        row_number=row['row_number'],
                        status=row['status'],
                        action=row['action'],
                        identity_key=row['identity_key'],
                        errors=row['errors'],
                        warnings=row['warnings'],
                        raw_data=row['raw_data'],
                        normalized_data=row['normalized_data'],
                    ) for row in row_results
                ], batch_size=500)

                ImportAuditEvent.objects.create(
                    batch=batch,
                    event_type='stock_take_preview_created',
                    message='Stock take import preview completed and staged.',
                    metadata=summary_payload,
                    created_by=request.user,
                )

            return Response({
                'batch_id': str(batch.id),
                'status': batch.status,
                'summary': batch.preview_summary,
                'sample_errors': [
                    {
                        'row_number': row.row_number,
                        'errors': row.errors,
                    }
                    for row in batch.rows.filter(status=ImportRowResult.STATUS_INVALID).order_by('row_number')[:20]
                ],
            }, status=status.HTTP_201_CREATED)
        except Exception as exc:
            logger.error('Stock take import preview failed: %s', exc, exc_info=True)
            return Response({'detail': f'Preview failed: {exc}'}, status=status.HTTP_400_BAD_REQUEST)


class StockTakeImportStatusView(BaseImportView):
    def get(self, request, batch_id):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            batch = ImportBatch.objects.select_related('outlet', 'stock_take', 'created_by').get(
                id=batch_id,
                tenant=tenant,
                entity_type=ImportBatch.ENTITY_STOCK_TAKE,
            )
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        created_by = None
        if batch.created_by:
            created_by = getattr(batch.created_by, 'username', None) or getattr(batch.created_by, 'email', None) or str(batch.created_by)

        return Response({
            'batch_id': str(batch.id),
            'status': batch.status,
            'stock_take_id': str(batch.stock_take_id) if batch.stock_take_id else '',
            'is_approved': batch.is_approved,
            'source_filename': batch.source_filename,
            'created_by': created_by,
            'outlet': {
                'id': str(batch.outlet_id),
                'name': getattr(batch.outlet, 'name', ''),
            },
            'total_rows': batch.total_rows,
            'valid_rows': batch.valid_rows,
            'invalid_rows': batch.invalid_rows,
            'warning_rows': batch.warning_rows,
            'applied_rows': batch.applied_rows,
            'preview_summary': batch.preview_summary,
            'apply_summary': batch.apply_summary,
            'created_at': batch.created_at,
            'previewed_at': batch.previewed_at,
            'applied_at': batch.applied_at,
        })


class StockTakeImportHistoryView(BaseImportView):
    def get(self, request, stock_take_id):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            stock_take = StockTake.objects.get(id=stock_take_id, tenant=tenant)
        except StockTake.DoesNotExist:
            return Response({'detail': 'Stock take not found'}, status=status.HTTP_404_NOT_FOUND)

        batches = ImportBatch.objects.filter(
            tenant=tenant,
            entity_type=ImportBatch.ENTITY_STOCK_TAKE,
            stock_take=stock_take,
        ).select_related('outlet', 'created_by').order_by('-created_at')

        search = (request.query_params.get('search') or '').strip()
        if search:
            search_filters = (
                Q(source_filename__icontains=search)
                | Q(status__icontains=search)
                | Q(outlet__name__icontains=search)
                | Q(created_by__username__icontains=search)
                | Q(created_by__email__icontains=search)
            )
            if len(search) >= 4:
                search_filters = search_filters | Q(id__icontains=search)
            batches = batches.filter(search_filters)

        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except (TypeError, ValueError):
            return Response({'detail': 'page must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            page_size = max(1, min(int(request.query_params.get('page_size', 10)), 50))
        except (TypeError, ValueError):
            return Response({'detail': 'page_size must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)

        total_count = batches.count()
        total_pages = max(1, (total_count + page_size - 1) // page_size)
        if page > total_pages:
            page = total_pages

        start = (page - 1) * page_size
        end = start + page_size
        items = list(batches[start:end])

        results = []
        for batch in items:
            created_by = None
            if batch.created_by:
                created_by = getattr(batch.created_by, 'username', None) or getattr(batch.created_by, 'email', None) or str(batch.created_by)

            results.append({
                'batch_id': str(batch.id),
                'import_date': batch.created_at,
                'source_filename': batch.source_filename,
                'status': batch.status,
                'stock_take_id': str(stock_take.id),
                'stock_take_status': stock_take.status,
                'created_by': created_by,
                'outlet': {
                    'id': str(batch.outlet_id),
                    'name': getattr(batch.outlet, 'name', ''),
                },
                'total_rows': batch.total_rows,
                'accepted_rows': (batch.preview_summary or {}).get('accepted_rows', batch.valid_rows),
                'rejected_rows': (batch.preview_summary or {}).get('rejected_rows', batch.invalid_rows),
                'duplicate_rows': (batch.preview_summary or {}).get('duplicate_rows', batch.warning_rows),
                'processing_time_ms': (batch.preview_summary or {}).get('processing_time_ms', 0),
                'preview_summary': batch.preview_summary,
                'apply_summary': batch.apply_summary,
                'previewed_at': batch.previewed_at,
                'applied_at': batch.applied_at,
            })

        return Response({
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages,
            'results': results,
        })


class StockTakeImportRowsView(BaseImportView):
    def get(self, request, batch_id):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            batch = ImportBatch.objects.select_related('outlet', 'stock_take').get(
                id=batch_id,
                tenant=tenant,
                entity_type=ImportBatch.ENTITY_STOCK_TAKE,
            )
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except (TypeError, ValueError):
            return Response({'detail': 'page must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            page_size = max(1, min(int(request.query_params.get('page_size', 10)), 100))
        except (TypeError, ValueError):
            return Response({'detail': 'page_size must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)

        search = (request.query_params.get('search') or '').strip().lower()
        applied_lookup = {
            str(item.product_id): item
            for item in batch.stock_take.items.select_related('product').all()
        } if batch.stock_take_id else {}

        rows = []
        for row in batch.rows.all().order_by('row_number'):
            raw_data = row.raw_data if isinstance(row.raw_data, dict) else {}
            normalized_data = row.normalized_data if isinstance(row.normalized_data, dict) else {}
            target_product_id = str(normalized_data.get('matched_product_id') or '')
            matched_item = applied_lookup.get(target_product_id)

            status_value = 'Rejected' if row.status == ImportRowResult.STATUS_INVALID else ('Imported' if batch.status == ImportBatch.STATUS_APPLIED else 'Ready')
            if row.status == ImportRowResult.STATUS_WARNING and batch.status != ImportBatch.STATUS_APPLIED:
                status_value = 'Ready'

            issue_messages = []
            for error in row.errors or []:
                if isinstance(error, dict):
                    issue_messages.append(str(error.get('reason') or error.get('resolution') or '').strip())
                else:
                    issue_messages.append(str(error))
            for warning in row.warnings or []:
                if isinstance(warning, dict):
                    issue_messages.append(str(warning.get('reason') or warning.get('resolution') or '').strip())
                else:
                    issue_messages.append(str(warning))

            item = {
                'row_number': row.row_number,
                'product_name': normalized_data.get('product_name') or raw_data.get('Product Name') or raw_data.get('name') or '-',
                'sku': normalized_data.get('sku') or raw_data.get('SKU') or raw_data.get('sku') or '-',
                'barcode': normalized_data.get('barcode') or raw_data.get('Barcode') or raw_data.get('barcode') or '-',
                'counted_quantity': int(float(normalized_data.get('counted_quantity') or 0)) if str(normalized_data.get('counted_quantity') or '').strip() else 0,
                'quantity_before': int(float(normalized_data.get('expected_quantity') or 0)) if str(normalized_data.get('expected_quantity') or '').strip() else 0,
                'quantity_after': int(float(normalized_data.get('quantity_after') or normalized_data.get('counted_quantity') or 0)) if str(normalized_data.get('quantity_after') or normalized_data.get('counted_quantity') or '').strip() else 0,
                'status': status_value,
                'reason': '; '.join(issue_messages) if issue_messages else (row.warnings[0].get('reason') if row.warnings and isinstance(row.warnings[0], dict) else '-'),
                'rejection_code': next((err.get('code') for err in row.errors or [] if isinstance(err, dict)), ''),
                'suggested_resolution': next((err.get('resolution') for err in row.errors or [] if isinstance(err, dict)), ''),
                'raw_data': raw_data,
                'normalized_data': normalized_data,
                'target_item_id': normalized_data.get('matched_item_id') or '',
                'target_product_id': target_product_id,
                'expected_quantity': int(float(normalized_data.get('expected_quantity') or 0)) if str(normalized_data.get('expected_quantity') or '').strip() else 0,
                'duplicate_count': int(float(normalized_data.get('duplicate_count') or 0)) if str(normalized_data.get('duplicate_count') or '').strip() else 0,
                'matched_item_quantity_before': int(getattr(matched_item, 'expected_quantity', 0) or 0),
            }

            if search:
                searchable = ' '.join([
                    str(item['row_number']),
                    item['product_name'],
                    item['sku'],
                    item['barcode'],
                    item['status'],
                    item['reason'],
                    item['rejection_code'],
                ]).lower()
                if search not in searchable:
                    continue

            rows.append(item)

        total_count = len(rows)
        total_pages = max(1, (total_count + page_size - 1) // page_size)
        if page > total_pages:
            page = total_pages

        start = (page - 1) * page_size
        end = start + page_size

        return Response({
            'batch_id': str(batch.id),
            'status': batch.status,
            'stock_take_id': str(batch.stock_take_id) if batch.stock_take_id else '',
            'is_approved': batch.is_approved,
            'source_filename': batch.source_filename,
            'outlet': {
                'id': str(batch.outlet_id),
                'name': getattr(batch.outlet, 'name', ''),
            },
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages,
            'results': rows[start:end],
        })


class StockTakeImportRowUpdateView(BaseImportView):
    def patch(self, request, batch_id, row_number):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            batch = ImportBatch.objects.select_related('outlet', 'stock_take').get(
                id=batch_id,
                tenant=tenant,
                entity_type=ImportBatch.ENTITY_STOCK_TAKE,
            )
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if batch.status == ImportBatch.STATUS_APPLYING:
            return Response({'detail': 'Cannot edit rows while apply is running.'}, status=status.HTTP_409_CONFLICT)

        try:
            row = ImportRowResult.objects.get(batch=batch, row_number=row_number)
        except ImportRowResult.DoesNotExist:
            return Response({'detail': 'Import row not found'}, status=status.HTTP_404_NOT_FOUND)

        payload = request.data if isinstance(request.data, dict) else {}
        product_name = self._clean_text(payload.get('product_name') or payload.get('productName') or row.normalized_data.get('product_name'))
        sku = self._clean_text(payload.get('sku') or row.normalized_data.get('sku'))
        barcode = self._clean_text(payload.get('barcode') or row.normalized_data.get('barcode'))
        counted_quantity_raw = payload.get('counted_quantity', payload.get('countedQuantity', row.normalized_data.get('counted_quantity', '0')))

        try:
            counted_quantity = max(0, int(float(counted_quantity_raw)))
        except (TypeError, ValueError):
            return Response({'detail': 'counted_quantity must be a valid integer'}, status=status.HTTP_400_BAD_REQUEST)

        stocktake_items = [self._stocktake_item_payload(item) for item in batch.stock_take.items.select_related('product').all()]
        match_item, match_error = self._match_stocktake_item(product_name, sku, barcode, stocktake_items)

        errors = []
        warnings = []
        if match_error:
            errors.append(match_error)
        if counted_quantity < 0:
            errors.append(self._structured_rejection(
                'INVALID_QUANTITY',
                'Counted quantity must be 0 or greater.',
                'Enter a valid non-negative quantity.',
                field='counted_quantity',
            ))

        quantity_before = int(match_item.get('quantity_before', 0) if match_item else 0)
        quantity_after = counted_quantity
        status_value = ImportRowResult.STATUS_INVALID if errors else ImportRowResult.STATUS_VALID
        action_value = ImportRowResult.ACTION_SKIP if errors else ImportRowResult.ACTION_UPDATE

        row.raw_data = {
            'Product Name': product_name,
            'SKU': sku,
            'Barcode': barcode,
            'Counted Quantity': counted_quantity,
        }
        row.normalized_data = {
            'product_name': product_name,
            'sku': sku,
            'barcode': barcode,
            'counted_quantity': str(counted_quantity),
            'matched_product_id': match_item['product_id'] if match_item else '',
            'matched_item_id': match_item['id'] if match_item else '',
            'expected_quantity': str(quantity_before),
            'quantity_after': str(quantity_after),
            'duplicate_count': row.normalized_data.get('duplicate_count', '0') if isinstance(row.normalized_data, dict) else '0',
        }
        row.status = status_value
        row.action = action_value
        row.errors = errors
        row.warnings = warnings
        row.identity_key = self._normalize_identity(product_name or sku or barcode, sku, barcode)
        row.save(update_fields=['raw_data', 'normalized_data', 'status', 'action', 'errors', 'warnings', 'identity_key'])

        batch.total_rows = batch.rows.count()
        batch.valid_rows = batch.rows.exclude(status=ImportRowResult.STATUS_INVALID).count()
        batch.invalid_rows = batch.rows.filter(status=ImportRowResult.STATUS_INVALID).count()
        batch.warning_rows = batch.rows.filter(status=ImportRowResult.STATUS_WARNING).count()
        batch.preview_summary = {
            **(batch.preview_summary if isinstance(batch.preview_summary, dict) else {}),
            'total_rows': batch.total_rows,
            'accepted_rows': batch.valid_rows,
            'rejected_rows': batch.invalid_rows,
            'duplicate_rows': batch.warning_rows,
        }
        batch.save(update_fields=['total_rows', 'valid_rows', 'invalid_rows', 'warning_rows', 'preview_summary', 'updated_at'])

        ImportAuditEvent.objects.create(
            batch=batch,
            event_type='stock_take_row_updated',
            message=f'Stock take import row {row.row_number} updated.',
            metadata={'row_number': row.row_number, 'status': row.status, 'errors': row.errors},
            created_by=request.user,
        )

        return Response({
            'batch_id': str(batch.id),
            'row_number': row.row_number,
            'status': row.status,
            'action': row.action,
            'errors': row.errors,
            'warnings': row.warnings,
            'normalized_data': row.normalized_data,
            'preview_summary': batch.preview_summary,
        })


class StockTakeImportSourceDownloadView(BaseImportView):
    def get(self, request, batch_id):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            batch = ImportBatch.objects.get(id=batch_id, tenant=tenant, entity_type=ImportBatch.ENTITY_STOCK_TAKE)
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if not batch.source_file:
            return Response({'detail': 'No source file available for this batch.'}, status=status.HTTP_404_NOT_FOUND)

        return FileResponse(batch.source_file.open('rb'), as_attachment=True, filename=batch.source_filename)


class StockTakeImportReopenView(BaseImportView):
    def post(self, request, batch_id):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            source_batch = ImportBatch.objects.get(id=batch_id, tenant=tenant, entity_type=ImportBatch.ENTITY_STOCK_TAKE)
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if not source_batch.stock_take_id:
            return Response({'detail': 'This batch is not linked to a stock take.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            reopened_batch = ImportBatch.objects.create(
                tenant=source_batch.tenant,
                outlet=source_batch.outlet,
                stock_take=source_batch.stock_take,
                entity_type=ImportBatch.ENTITY_STOCK_TAKE,
                sync_mode=ImportBatch.MODE_UPSERT_ADJUST,
                status=ImportBatch.STATUS_PREVIEW_READY,
                source_filename=source_batch.source_filename,
                source_file=source_batch.source_file,
                total_rows=source_batch.total_rows,
                valid_rows=source_batch.valid_rows,
                invalid_rows=source_batch.invalid_rows,
                warning_rows=source_batch.warning_rows,
                preview_summary=dict(source_batch.preview_summary or {}),
                apply_summary={},
                created_by=request.user,
                previewed_at=timezone.now(),
            )

            ImportRowResult.objects.bulk_create([
                ImportRowResult(
                    batch=reopened_batch,
                    row_number=row.row_number,
                    status=row.status,
                    action=row.action,
                    identity_key=row.identity_key,
                    errors=row.errors,
                    warnings=row.warnings,
                    raw_data=row.raw_data,
                    normalized_data=row.normalized_data,
                )
                for row in source_batch.rows.all().order_by('row_number')
            ], batch_size=500)

            ImportAuditEvent.objects.create(
                batch=reopened_batch,
                event_type='stock_take_reopened',
                message='Stock take import reopened from history.',
                metadata={'source_batch_id': str(source_batch.id)},
                created_by=request.user,
            )

        return Response({
            'batch_id': str(reopened_batch.id),
            'status': reopened_batch.status,
            'stock_take_id': str(reopened_batch.stock_take_id) if reopened_batch.stock_take_id else '',
        }, status=status.HTTP_201_CREATED)


class StockTakeImportApplyView(BaseImportView):
    def post(self, request, batch_id):
        tenant = self._resolve_tenant(request)
        if not tenant:
            return Response({'detail': 'Tenant is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            batch = ImportBatch.objects.select_related('outlet', 'stock_take').get(
                id=batch_id,
                tenant=tenant,
                entity_type=ImportBatch.ENTITY_STOCK_TAKE,
            )
        except ImportBatch.DoesNotExist:
            return Response({'detail': 'Import batch not found'}, status=status.HTTP_404_NOT_FOUND)

        if batch.status == ImportBatch.STATUS_APPLIED:
            return Response({
                'batch_id': str(batch.id),
                'status': batch.status,
                'apply_summary': batch.apply_summary,
                'already_applied': True,
            })

        valid_rows_qs = batch.rows.filter(status__in=[ImportRowResult.STATUS_VALID, ImportRowResult.STATUS_WARNING]).exclude(action=ImportRowResult.ACTION_SKIP).order_by('row_number')
        valid_rows = list(valid_rows_qs)
        if not valid_rows:
            return Response({'detail': 'No valid rows to apply'}, status=status.HTTP_400_BAD_REQUEST)

        start_time = timezone.now()
        with transaction.atomic():
            batch.status = ImportBatch.STATUS_APPLYING
            batch.approved_by = request.user
            batch.is_approved = True
            batch.approved_at = timezone.now()
            batch.apply_idempotency_key = request.headers.get('X-Idempotency-Key') or request.data.get('idempotency_key')
            batch.save(update_fields=['status', 'approved_by', 'is_approved', 'approved_at', 'apply_idempotency_key', 'updated_at'])
            ImportAuditEvent.objects.create(
                batch=batch,
                event_type='stock_take_apply_started',
                message='Stock take import apply started',
                metadata={'valid_rows': len(valid_rows)},
                created_by=request.user,
            )

        applied_rows = 0
        failed_rows = 0
        grouped_updates: Dict[str, Dict[str, Any]] = {}

        for row in valid_rows:
            normalized_data = row.normalized_data if isinstance(row.normalized_data, dict) else {}
            target_item_id = str(normalized_data.get('matched_item_id') or '')
            target_product_id = str(normalized_data.get('matched_product_id') or '')
            counted_quantity = int(float(normalized_data.get('counted_quantity') or 0)) if str(normalized_data.get('counted_quantity') or '').strip() else 0

            group_key = target_item_id or f'product:{target_product_id}'
            entry = grouped_updates.get(group_key)
            if entry:
                entry['counted_quantity'] += counted_quantity
                entry['rows'].append(row)
                continue

            grouped_updates[group_key] = {
                'target_item_id': target_item_id,
                'target_product_id': target_product_id,
                'counted_quantity': counted_quantity,
                'rows': [row],
            }

        apply_errors = []
        with transaction.atomic():
            for group_key, entry in grouped_updates.items():
                counted_quantity = int(entry['counted_quantity'])
                rows_in_group = entry['rows']
                first_row = rows_in_group[0]
                normalized_data = first_row.normalized_data if isinstance(first_row.normalized_data, dict) else {}
                expected_quantity = int(float(normalized_data.get('expected_quantity') or 0)) if str(normalized_data.get('expected_quantity') or '').strip() else 0
                product_id = str(normalized_data.get('matched_product_id') or '')

                try:
                    if entry['target_item_id']:
                        item = StockTakeItem.objects.select_for_update().get(id=entry['target_item_id'], stock_take=batch.stock_take)
                    elif product_id:
                        item = StockTakeItem.objects.select_for_update().filter(stock_take=batch.stock_take, product_id=product_id).first()
                        if item is None:
                            item = StockTakeItem.objects.create(
                                stock_take=batch.stock_take,
                                product_id=product_id,
                                expected_quantity=expected_quantity,
                                counted_quantity=0,
                                notes=f'Created during stock take import apply for batch {batch.id}',
                            )
                    else:
                        raise ValueError('Matched product not found for row.')

                    item.expected_quantity = expected_quantity if expected_quantity >= 0 else 0
                    item.counted_quantity = counted_quantity
                    item.is_counted = True
                    item.counted_at = timezone.now()
                    item.counted_by = request.user
                    item.notes = f'Imported via stock take batch {batch.id}'
                    item.save()
                    applied_rows += len(rows_in_group)
                except Exception as exc:
                    failed_rows += len(rows_in_group)
                    apply_errors.append({
                        'group_key': group_key,
                        'error': str(exc),
                        'row_numbers': [row.row_number for row in rows_in_group],
                    })

            processing_time_ms = int((timezone.now() - start_time).total_seconds() * 1000)
            total_rows = batch.rows.count()
            rejected_rows = batch.rows.filter(status=ImportRowResult.STATUS_INVALID).count()
            duplicate_rows = batch.rows.filter(status=ImportRowResult.STATUS_WARNING).count()
            apply_summary = {
                'imported': applied_rows,
                'failed': failed_rows,
                'total_rows': total_rows,
                'accepted_rows': total_rows - rejected_rows,
                'rejected_rows': rejected_rows,
                'duplicate_rows': duplicate_rows,
                'processing_time_ms': processing_time_ms,
                'errors': apply_errors,
            }

            batch.status = ImportBatch.STATUS_APPLIED if failed_rows == 0 else ImportBatch.STATUS_FAILED
            batch.applied_rows = applied_rows
            batch.applied_at = timezone.now() if failed_rows == 0 else None
            batch.apply_summary = apply_summary
            batch.save(update_fields=['status', 'applied_rows', 'applied_at', 'apply_summary', 'updated_at'])

            ImportAuditEvent.objects.create(
                batch=batch,
                event_type='stock_take_apply_completed' if failed_rows == 0 else 'stock_take_apply_completed_with_errors',
                message='Stock take import applied' if failed_rows == 0 else 'Stock take import applied with errors',
                metadata=apply_summary,
                created_by=request.user,
            )

        return Response({
            'batch_id': str(batch.id),
            'status': batch.status,
            'apply_summary': batch.apply_summary,
        }, status=status.HTTP_200_OK if failed_rows == 0 else status.HTTP_207_MULTI_STATUS)
