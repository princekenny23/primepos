import io
import logging
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Tuple

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
from apps.products.views import ProductViewSet
from apps.tenants.permissions import HasTenantModuleAccess
from .models import ImportApplyError, ImportAuditEvent, ImportBatch, ImportRowResult
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
    SYNC_STRATEGY_CHOICES = {
        SYNC_STRATEGY_UPDATE_EXISTING,
        SYNC_STRATEGY_CREATE_NEW,
        SYNC_STRATEGY_STOCK_ONLY,
        SYNC_STRATEGY_PRICES_ONLY,
        SYNC_STRATEGY_FULL_SYNC,
    }

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
                action = ImportRowResult.ACTION_UPDATE

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

    def _apply_inventory_sync_batch(self, request, batch: ImportBatch, sync_strategy: str):
        valid_rows_qs = batch.rows.filter(status__in=[ImportRowResult.STATUS_VALID, ImportRowResult.STATUS_WARNING]).exclude(action=ImportRowResult.ACTION_SKIP).order_by('row_number')
        valid_rows = list(valid_rows_qs.values('row_number', 'raw_data', 'normalized_data'))
        if not valid_rows:
            return Response({'detail': 'No staged rows available for apply.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            batch.apply_errors.all().delete()
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
        }
        apply_price_updates = sync_strategy in {
            self.SYNC_STRATEGY_FULL_SYNC,
            self.SYNC_STRATEGY_UPDATE_EXISTING,
            self.SYNC_STRATEGY_PRICES_ONLY,
        }
        apply_stock_updates = sync_strategy in {
            self.SYNC_STRATEGY_FULL_SYNC,
            self.SYNC_STRATEGY_UPDATE_EXISTING,
            self.SYNC_STRATEGY_STOCK_ONLY,
        }
        allow_create = sync_strategy in {
            self.SYNC_STRATEGY_FULL_SYNC,
            self.SYNC_STRATEGY_CREATE_NEW,
        }
        allow_update = sync_strategy in {
            self.SYNC_STRATEGY_FULL_SYNC,
            self.SYNC_STRATEGY_UPDATE_EXISTING,
            self.SYNC_STRATEGY_STOCK_ONLY,
            self.SYNC_STRATEGY_PRICES_ONLY,
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
                    if cost_price is not None and cost_price != product.cost:
                        product.cost = cost_price
                        changed = True
                    if wholesale_price is not None and wholesale_price != product.wholesale_price:
                        product.wholesale_price = wholesale_price
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
                    adjust_stock(
                        product=product,
                        outlet=outlet,
                        new_quantity=target_stock,
                        user=request.user,
                        reason=f'Inventory sync import row {row_number}',
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
                    warnings.append('Duplicate row detected in file')
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
                    action = ImportRowResult.ACTION_UPDATE

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

            with transaction.atomic():
                batch = ImportBatch.objects.create(
                    tenant=tenant,
                    outlet=outlet,
                    entity_type=ImportBatch.ENTITY_PRODUCTS,
                    sync_mode=batch_sync_mode,
                    status=ImportBatch.STATUS_PREVIEW_READY,
                    source_filename=uploaded_file.name,
                    source_file=uploaded_file,
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

        if batch.status != ImportBatch.STATUS_PREVIEW_READY:
            return Response({'detail': f'Batch is not ready to apply (status={batch.status})'}, status=status.HTTP_409_CONFLICT)

        if batch.valid_rows <= 0:
            return Response({'detail': 'No valid rows to apply'}, status=status.HTTP_400_BAD_REQUEST)

        if not batch.is_approved:
            return Response({'detail': 'Batch must be approved before apply.'}, status=status.HTTP_409_CONFLICT)

        if batch.sync_mode == ImportBatch.MODE_INVENTORY_SYNC:
            try:
                default_strategy = (batch.preview_summary or {}).get('sync_strategy')
                sync_strategy = self._resolve_sync_strategy(request, default=default_strategy)
            except ValueError as exc:
                return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            return self._apply_inventory_sync_batch(request, batch, sync_strategy)

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

            total_imported = 0
            total_failed = 0
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
                        chunk_imported = int(response_data.get('imported', 0)) if isinstance(response_data, dict) else 0

                        # Enforce all-or-nothing semantics per chunk.
                        if chunk_failed > 0:
                            raise RuntimeError(f"Chunk validation failed: {response_data}")

                        total_imported += chunk_imported
                        chunk_reports.append({
                            'chunk_index': chunk_index,
                            'rows': len(chunk_rows),
                            'imported': chunk_imported,
                            'failed': chunk_failed,
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
                        'failed': len(chunk_rows),
                        'row_numbers': row_numbers,
                        'error': str(chunk_exc),
                    })

                    if not continue_on_error:
                        break

            final_status = ImportBatch.STATUS_APPLIED if total_failed == 0 else ImportBatch.STATUS_FAILED
            response_data = {
                'success': total_failed == 0,
                'imported': total_imported,
                'failed': total_failed,
                'total_rows': len(valid_rows),
                'chunks': chunk_reports,
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
            page_size = max(1, min(int(request.query_params.get('page_size', 10)), 100))
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
            elif batch.status == ImportBatch.STATUS_APPLIED and row.action != ImportRowResult.ACTION_SKIP:
                display_status = 'Imported'
            elif batch.is_approved and row.action != ImportRowResult.ACTION_SKIP:
                display_status = 'Ready'
            elif row.status == ImportRowResult.STATUS_WARNING:
                display_status = 'Warning'
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

        if batch.status not in [ImportBatch.STATUS_PREVIEW_READY, ImportBatch.STATUS_FAILED]:
            return Response({'detail': f'Batch cannot be approved in current status: {batch.status}'}, status=status.HTTP_409_CONFLICT)

        # Failed batches need to be moved back to preview_ready for a new apply attempt.
        if batch.status == ImportBatch.STATUS_FAILED:
            batch.status = ImportBatch.STATUS_PREVIEW_READY

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
