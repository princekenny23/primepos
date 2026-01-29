from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Product, Category, ProductUnit
from .serializers import ProductSerializer, CategorySerializer, ProductUnitSerializer
from apps.tenants.permissions import TenantFilterMixin
from django.db import transaction
from decimal import Decimal
import logging
import pandas as pd
import io
import csv
from datetime import datetime

logger = logging.getLogger(__name__)


class CategoryViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Category ViewSet"""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['tenant']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    def get_queryset(self):
        """Ensure tenant filtering is applied correctly"""
        from django.db.models import Count
        
        # Ensure user.tenant is loaded
        user = self.request.user
        if not hasattr(user, '_tenant_loaded'):
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.select_related('tenant').get(pk=user.pk)
                self.request.user = user
                user._tenant_loaded = True
            except User.DoesNotExist:
                pass
        
        is_saas_admin = getattr(user, 'is_saas_admin', False)
        request_tenant = getattr(self.request, 'tenant', None)
        user_tenant = getattr(user, 'tenant', None)
        tenant = request_tenant or user_tenant
        
        # Get base queryset with prefetched product count to avoid N+1 queries
        queryset = Category.objects.annotate(_products_count=Count('products'))
        
        # Apply tenant filter - CRITICAL for security
        if not is_saas_admin:
            if tenant:
                queryset = queryset.filter(tenant=tenant)
            else:
                return queryset.none()
        
        return queryset
    
    def perform_create(self, serializer):
        # Tenant is read-only, so always set it from request context
        # SaaS admins can provide tenant_id in request data
        tenant = self.get_tenant_for_request(self.request)
        if not tenant and not self.request.user.is_saas_admin:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Tenant is required. Please ensure you are authenticated and have a tenant assigned.")
        if not tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Tenant is required. Please provide tenant_id in request data.")
        serializer.save(tenant=tenant)
    
    def update(self, request, *args, **kwargs):
        """Override update to ensure tenant matches"""
        instance = self.get_object()
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        
        # Verify tenant matches (unless SaaS admin or tenant admin)
        from apps.tenants.permissions import is_admin_user
        if not is_admin_user(request.user) and tenant and instance.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to update this category."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """Override destroy to ensure tenant matches"""
        instance = self.get_object()
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        
        # Verify tenant matches (unless SaaS admin or tenant admin)
        from apps.tenants.permissions import is_admin_user
        if not is_admin_user(request.user) and tenant and instance.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to delete this category."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().destroy(request, *args, **kwargs)


class ProductViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Product ViewSet - outlet-specific products"""
    queryset = Product.objects.select_related('category', 'tenant', 'outlet')
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['tenant', 'outlet', 'category', 'is_active']
    search_fields = ['name', 'sku', 'barcode', 'description']
    ordering_fields = ['name', 'retail_price', 'wholesale_price', 'price', 'stock', 'created_at']
    ordering = ['name']
    
    def get_queryset(self):
        """Override to ensure tenant filtering is applied correctly"""
        # Ensure user.tenant is loaded
        user = self.request.user
        if not hasattr(user, '_tenant_loaded'):
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.select_related('tenant').get(pk=user.pk)
                self.request.user = user
                user._tenant_loaded = True
            except User.DoesNotExist:
                pass
        
        is_saas_admin = getattr(user, 'is_saas_admin', False)
        request_tenant = getattr(self.request, 'tenant', None)
        user_tenant = getattr(user, 'tenant', None)
        
        # Use request.tenant first (set by middleware), then fall back to user.tenant
        tenant = request_tenant or user_tenant
        
        logger.info(f"ProductViewSet.get_queryset - User: {user.email}, is_saas_admin: {is_saas_admin}, user_tenant_id: {user_tenant.id if user_tenant else None}, request_tenant_id: {request_tenant.id if request_tenant else None}")
        
        # Get base queryset with optimized prefetching to avoid N+1 queries
        # Note: 'unit' is a CharField, not a ForeignKey, so we can't prefetch it
        # UNITS ONLY ARCHITECTURE: Removed 'variations' prefetch (ItemVariation model deleted)
        queryset = Product.objects.select_related('category', 'tenant', 'outlet').prefetch_related(
            'selling_units'
        ).all()
        
        # Apply tenant filter - CRITICAL for security
        if not is_saas_admin:
            if tenant:
                queryset = queryset.filter(tenant=tenant)
                count = queryset.count()
                logger.info(f"Applied tenant filter: {tenant.id} ({tenant.name}) - {count} products found")
            else:
                logger.error(f"CRITICAL: No tenant found for user {user.email} (ID: {user.id}). User must have a tenant assigned to view products.")
                logger.error(f"User tenant: {user_tenant}, Request tenant: {request_tenant}")
                # Return empty queryset for security
                return queryset.none()
        
        # Apply outlet filter - Products are outlet-specific
        # SaaS admins can see all products, regular users need outlet filter
        if not is_saas_admin:
            outlet = self.get_outlet_for_request(self.request)
            if outlet:
                queryset = queryset.filter(outlet=outlet)
                logger.info(f"Applied outlet filter: {outlet.id} ({outlet.name}) - {queryset.count()} products found")
            else:
                # If no outlet specified, return empty queryset (products require outlet)
                logger.warning(f"No outlet specified in request - returning empty queryset")
                return queryset.none()
        else:
            # SaaS admin can optionally filter by outlet if provided
            outlet = self.get_outlet_for_request(self.request)
            if outlet:
                queryset = queryset.filter(outlet=outlet)
                logger.info(f"SaaS admin - Applied outlet filter: {outlet.id} ({outlet.name}) - {queryset.count()} products found")
        
        return queryset
    
    def update(self, request, *args, **kwargs):
        """Override update to ensure tenant and outlet match"""
        instance = self.get_object()
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        
        # Verify tenant matches (unless SaaS admin or tenant admin)
        from apps.tenants.permissions import is_admin_user
        if not is_admin_user(request.user) and tenant and instance.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to update this product."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify outlet matches (products are outlet-specific)
        outlet = self.get_outlet_for_request(request)
        if outlet and instance.outlet != outlet:
            return Response(
                {"detail": "You can only update products for the current outlet."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Call parent update method
        response = super().update(request, *args, **kwargs)
        
        # Ensure we return the updated instance with all fields
        if response.status_code == status.HTTP_200_OK:
            # Refresh instance from database to get latest data, including related objects
            instance.refresh_from_db()
            # Prefetch related objects for serializer (units replace variations)
            from django.db.models import Prefetch
            from apps.products.models import ProductUnit
            instance = Product.objects.select_related('category', 'tenant', 'outlet').prefetch_related(
                Prefetch('selling_units', queryset=ProductUnit.objects.select_related('product').order_by('sort_order', 'unit_name'))
            ).get(pk=instance.pk)
            # Re-serialize with updated data
            serializer = self.get_serializer(instance)
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        return response
    
    def perform_update(self, serializer):
        """Handle stock updates when updating a product"""
        # Get the stock value from validated data before saving
        new_stock = serializer.validated_data.get('stock', None)
        
        # Save the product (this will update Product.stock)
        product = serializer.save()
        
        # Update stock using batch-aware system if stock was provided
        if new_stock is not None:
            from apps.inventory.models import LocationStock
            from apps.inventory.stock_helpers import adjust_stock, get_available_stock
            
            # UNITS ONLY ARCHITECTURE: No variations, work directly with product
            outlet = self.get_outlet_for_request(self.request)
            if outlet:
                # Get current available stock
                current_stock = get_available_stock(product, outlet)
                
                # Adjust to the target stock using batch-aware helper
                if new_stock != current_stock:
                    adjust_stock(
                        product=product,
                        outlet=outlet,
                        new_quantity=new_stock,
                        user=self.request.user,
                        reason=f"Product update via API - set stock to {new_stock} (was {current_stock})"
                    )
                    logger.info(
                        f"Adjusted stock for product {product.id}, outlet {outlet.id}: {current_stock} -> {new_stock}"
                    )
                
                # Also update LocationStock.quantity for backward compatibility
                LocationStock.objects.update_or_create(
                    tenant=product.tenant,
                    product=product,
                    outlet=outlet,
                    defaults={'quantity': new_stock}
                )
    
    def destroy(self, request, *args, **kwargs):
        """Override destroy to ensure tenant and outlet match"""
        instance = self.get_object()
        tenant = getattr(request, 'tenant', None) or request.user.tenant
        
        # Verify tenant matches (unless SaaS admin or tenant admin)
        from apps.tenants.permissions import is_admin_user
        if not is_admin_user(request.user) and tenant and instance.tenant != tenant:
            return Response(
                {"detail": "You do not have permission to delete this product."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify outlet matches (products are outlet-specific)
        outlet = self.get_outlet_for_request(request)
        if outlet and instance.outlet != outlet:
            return Response(
                {"detail": "You can only delete products for the current outlet."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='lookup')
    def lookup(self, request):
        """Lookup products and variations by barcode.

        Returns JSON with 'variations' and/or 'products' arrays when matches are found.
        Respects tenant and outlet scoping via TenantFilterMixin/get_queryset.
        """
        barcode = request.query_params.get('barcode')
        if not barcode:
            return Response({"detail": "barcode query parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        barcode_val = str(barcode).strip()
        outlet = self.get_outlet_for_request(request)
        tenant = getattr(request, 'tenant', None) or (request.user.tenant if hasattr(request.user, 'tenant') else None)

        results: dict = {}

        # UNITS ONLY ARCHITECTURE: Variations removed, search only by products
        # Try exact match on products
        prod_qs = self.get_queryset().filter(barcode__iexact=barcode_val)
        if prod_qs.exists():
            serializer = self.get_serializer(prod_qs, many=True, context={'request': request, 'outlet': outlet})
            results['products'] = serializer.data

        # If nothing exact, try contains (useful for prefix matches or partial scans)
        if not results:
            prod_cont = self.get_queryset().filter(barcode__icontains=barcode_val)
            if prod_cont.exists():
                results['products'] = self.get_serializer(prod_cont, many=True, context={'request': request, 'outlet': outlet}).data

        # Return structured results (empty dict if no matches)
        return Response(results, status=status.HTTP_200_OK)
    
    def get_serializer_context(self):
        """Add request and outlet to serializer context"""
        context = super().get_serializer_context()
        context['request'] = self.request
        
        # Add outlet to context if provided (for stock calculations)
        # Check query params first, then headers (X-Outlet-ID)
        outlet_id = self.request.query_params.get('outlet') or self.request.query_params.get('outlet_id')
        
        # Check headers if not in query params
        if not outlet_id:
            outlet_id = self.request.headers.get('X-Outlet-ID')
        
        if outlet_id:
            from apps.outlets.models import Outlet
            tenant = getattr(self.request, 'tenant', None) or (self.request.user.tenant if hasattr(self.request, 'user') and self.request.user.is_authenticated else None)
            if tenant:
                try:
                    outlet = Outlet.objects.get(id=outlet_id, tenant=tenant)
                    context['outlet'] = outlet
                except (Outlet.DoesNotExist, ValueError, TypeError):
                    pass
        
        return context
    
    @action(detail=False, methods=['get'])
    def count(self, request):
        """Get product count - optimized endpoint to avoid loading all products"""
        queryset = self.filter_queryset(self.get_queryset())
        count = queryset.count()
        return Response({'count': count})
    
    def create(self, request, *args, **kwargs):
        """Override create to log validation errors"""
        logger.info(f"Creating product with data: {request.data}")
        logger.info(f"User: {request.user}, Tenant: {getattr(request.user, 'tenant', None)}")
        
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            logger.error(f"Validation errors: {serializer.errors}")
            # Return detailed error message
            error_detail = serializer.errors
            if isinstance(error_detail, dict):
                # Format errors nicely
                error_messages = []
                for field, errors in error_detail.items():
                    if isinstance(errors, list):
                        error_messages.extend([f"{field}: {error}" for error in errors])
                    else:
                        error_messages.append(f"{field}: {errors}")
                error_detail = {'detail': '; '.join(error_messages), 'errors': serializer.errors}
            return Response(error_detail, status=status.HTTP_400_BAD_REQUEST)
        
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def perform_create(self, serializer):
        # Get tenant from request context
        tenant = None
        if hasattr(self.request, 'tenant') and self.request.tenant:
            tenant = self.request.tenant
        elif self.request.user.tenant:
            tenant = self.request.user.tenant
        
        if not tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Tenant is required. Please ensure you are authenticated and have a tenant assigned.")
        
        # Get outlet from request (header, query param, or request data)
        outlet = self.get_outlet_for_request(self.request)
        if not outlet:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Outlet is required. Please specify an outlet in the request header (X-Outlet-ID), query parameter (?outlet=id), or request data.")
        
        # Verify outlet belongs to tenant
        if outlet.tenant != tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Outlet does not belong to your tenant.")
        
        # Save with both tenant and outlet
        product = serializer.save(tenant=tenant, outlet=outlet)
        
        # UNITS ONLY ARCHITECTURE - No variations
        # Units will be created separately via ProductUnitViewSet
        # Products are created without any initial units; units are added explicitly via /api/v1/units/
    
    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Get products with low stock - checks both product level and variation level"""
        from apps.inventory.models import LocationStock
        from apps.outlets.models import Outlet
        
        queryset = self.filter_queryset(self.get_queryset())
        tenant = getattr(request, 'tenant', None) or (request.user.tenant if hasattr(request, 'user') and request.user.is_authenticated else None)
        
        if not tenant:
            return Response(
                {'error': 'Unable to determine tenant'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get outlet from query params if provided
        outlet_id = request.query_params.get('outlet')
        outlet = None
        if outlet_id:
            try:
                outlet = Outlet.objects.get(id=outlet_id, tenant=tenant)
            except Outlet.DoesNotExist:
                pass
        
        low_stock_products = []
        
        for product in queryset:
            is_low = False
            
            # Check product-level stock (legacy)
            if product.low_stock_threshold > 0:
                total_stock = product.get_total_stock(outlet=outlet)
                if total_stock <= product.low_stock_threshold:
                    is_low = True
            
            # Check variation-level stock (preferred)
            if not is_low:
                variations = product.variations.filter(is_active=True, track_inventory=True)
                for variation in variations:
                    if variation.low_stock_threshold > 0:
                        var_stock = variation.get_total_stock(outlet=outlet)
                        if var_stock <= variation.low_stock_threshold:
                            is_low = True
                            break
            
            if is_low:
                low_stock_products.append(product)
        
        page = self.paginate_queryset(low_stock_products)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(low_stock_products, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='generate-sku')
    def generate_sku_preview(self, request):
        """Generate a preview SKU for the current tenant"""
        tenant = getattr(request, 'tenant', None) or (request.user.tenant if hasattr(request, 'user') and request.user.is_authenticated else None)
        if not tenant:
            return Response({'error': 'Unable to determine tenant.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Use the serializer's generate_sku method
        serializer = self.get_serializer()
        preview_sku = serializer.generate_sku(tenant)
        
        return Response({'sku': preview_sku})
    
    def destroy(self, request, *args, **kwargs):
        """
        Delete a product
        Ensures tenant filtering and proper logging
        """
        instance = self.get_object()
        
        # Get tenant for logging
        tenant = getattr(request, 'tenant', None) or (request.user.tenant if hasattr(request, 'user') and request.user.is_authenticated else None)
        
        # Verify the product belongs to the user's tenant (unless SaaS admin or tenant admin)
        user = request.user
        from apps.tenants.permissions import is_admin_user
        
        if not is_admin_user(user) and tenant:
            if instance.tenant != tenant:
                logger.warning(f"User {user.email} attempted to delete product {instance.id} from different tenant")
                return Response(
                    {'error': 'You do not have permission to delete this product.'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        product_name = instance.name
        product_id = instance.id
        
        logger.info(f"Deleting product: {product_name} (ID: {product_id}) by user: {user.email}")
        
        try:
            self.perform_destroy(instance)
            logger.info(f"Product {product_name} (ID: {product_id}) deleted successfully")
            return Response(
                {'message': f'Product "{product_name}" has been deleted successfully.'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.error(f"Error deleting product {product_id}: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Failed to delete product: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'], url_path='bulk-delete')
    def bulk_delete(self, request):
        """
        Bulk delete multiple products
        Expects a list of product IDs in the request body
        """
        tenant = getattr(request, 'tenant', None) or (request.user.tenant if hasattr(request, 'user') and request.user.is_authenticated else None)
        if not tenant:
            return Response(
                {'error': 'Unable to determine tenant. Please ensure you are authenticated and have a tenant assigned.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        product_ids = request.data.get('product_ids', [])
        
        if not product_ids or not isinstance(product_ids, list):
            return Response(
                {'error': 'Please provide a list of product IDs to delete.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(product_ids) == 0:
            return Response(
                {'error': 'No product IDs provided.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = request.user
        is_saas_admin = getattr(user, 'is_saas_admin', False)
        
        # Get products that belong to the tenant
        queryset = Product.objects.filter(id__in=product_ids)
        
        if not is_saas_admin:
            queryset = queryset.filter(tenant=tenant)
        
        products_to_delete = list(queryset)
        products_not_found = set(product_ids) - {p.id for p in products_to_delete}
        
        if not products_to_delete:
            return Response(
                {'error': 'No products found to delete. They may not exist or belong to a different tenant.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Delete products
        deleted_count = 0
        deleted_names = []
        
        try:
            with transaction.atomic():
                for product in products_to_delete:
                    product_name = product.name
                    product.delete()
                    deleted_count += 1
                    deleted_names.append(product_name)
                    logger.info(f"Bulk deleted product: {product_name} (ID: {product.id}) by user: {user.email}")
        except Exception as e:
            logger.error(f"Error during bulk delete: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Failed to delete products: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        response_data = {
            'success': True,
            'deleted_count': deleted_count,
            'deleted_products': deleted_names,
        }
        
        if products_not_found:
            response_data['not_found'] = list(products_not_found)
            response_data['warning'] = f'{len(products_not_found)} product(s) were not found or do not belong to your tenant.'
        
        return Response(response_data, status=status.HTTP_200_OK)
    
    def resolve_categories(self, category_names, tenant):
        """
        Resolve category names to category IDs
        Creates categories if they don't exist
        
        Returns: dict {category_name: category_id}
        """
        category_map = {}
        
        for category_name in category_names:
            if not category_name or (isinstance(category_name, str) and category_name.strip() == ""):
                continue
            
            # Normalize for lookup (case-insensitive)
            normalized = str(category_name).strip()
            
            # Check if exists (case-insensitive match)
            category = Category.objects.filter(
                tenant=tenant,
                name__iexact=normalized
            ).first()
            
            if category:
                # Use existing category
                category_map[category_name] = category.id
            else:
                # Create new category
                new_category = Category.objects.create(
                    tenant=tenant,
                    name=normalized,  # Use original case
                    description=""
                )
                category_map[category_name] = new_category.id
                logger.info(f"Auto-created category: {normalized} for tenant {tenant.name}")
        
        return category_map
    
    @action(detail=False, methods=['post'], url_path='bulk-import')
    def bulk_import(self, request):
        """
        Bulk import products from Excel/CSV file
        Auto-creates categories if they don't exist
        """
        logger.info(f"Bulk import request received. User: {request.user.email if hasattr(request, 'user') else 'Unknown'}")
        logger.info(f"Request FILES keys: {list(request.FILES.keys()) if request.FILES else 'No FILES'}")
        logger.info(f"Request content type: {request.content_type}")
        logger.info(f"Request method: {request.method}")
        
        # Get tenant
        tenant = getattr(request, 'tenant', None) or (request.user.tenant if hasattr(request, 'user') and request.user.is_authenticated else None)
        if not tenant:
            logger.error("Bulk import failed: No tenant found")
            return Response(
                {'error': 'Unable to determine tenant. Please ensure you are authenticated and have a tenant assigned.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        logger.info(f"Bulk import for tenant: {tenant.name} (ID: {tenant.id})")
        
        # Check if file was uploaded
        if 'file' not in request.FILES:
            logger.error("Bulk import failed: No file in request.FILES")
            logger.info(f"Available FILES keys: {list(request.FILES.keys())}")
            return Response(
                {'error': 'No file uploaded. Please select a file to import.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        uploaded_file = request.FILES['file']
        file_name = uploaded_file.name.lower()
        logger.info(f"File received: {uploaded_file.name}, size: {uploaded_file.size} bytes")
        
        # Validate file type
        if not (file_name.endswith('.xlsx') or file_name.endswith('.xls') or file_name.endswith('.csv')):
            return Response(
                {'error': 'Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check for outlet early - before processing file
        # Try header first, then query param, then request data
        outlet_id = request.headers.get('X-Outlet-ID') or request.query_params.get('outlet') or request.data.get('outlet')
        
        if not outlet_id:
            # Return structured response with tenant outlets
            from apps.outlets.models import Outlet
            tenant_outlets = Outlet.objects.filter(tenant=tenant, is_active=True).order_by('name')
            outlets_list = [{'id': outlet.id, 'name': outlet.name} for outlet in tenant_outlets]
            
            logger.info(f"Bulk import requires outlet selection. Tenant has {len(outlets_list)} outlets.")
            return Response(
                {
                    'requires_outlet': True,
                    'message': 'Please select an outlet for this import',
                    'outlets': outlets_list
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate outlet belongs to tenant
        from apps.outlets.models import Outlet
        try:
            outlet = Outlet.objects.get(id=outlet_id, tenant=tenant)
        except (Outlet.DoesNotExist, ValueError, TypeError):
            # Return structured response with tenant outlets
            tenant_outlets = Outlet.objects.filter(tenant=tenant, is_active=True).order_by('name')
            outlets_list = [{'id': outlet.id, 'name': outlet.name} for outlet in tenant_outlets]
            
            logger.warning(f"Invalid outlet ID {outlet_id} for tenant {tenant.id}")
            return Response(
                {
                    'requires_outlet': True,
                    'message': f'Outlet with ID {outlet_id} not found or does not belong to your business. Please select a valid outlet.',
                    'outlets': outlets_list
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        results = {
            'success': False,
            'total_rows': 0,
            'imported': 0,
            'failed': 0,
            'categories_created': 0,
            'categories_existing': 0,
            'errors': [],
            'warnings': []
        }
        
        try:
            # Read file
            if file_name.endswith('.csv'):
                # Read CSV
                file_content = uploaded_file.read().decode('utf-8')
                df = pd.read_csv(io.StringIO(file_content))
            else:
                # Read Excel
                df = pd.read_excel(uploaded_file, engine='openpyxl')
            
            # Normalize column names (case-insensitive, strip whitespace, replace spaces with underscores)
            df.columns = df.columns.str.strip()
            column_mapping = {col.lower().replace(' ', '_'): col for col in df.columns}
            
            # Check required columns - support both "name" and "product_name" for backward compatibility
            product_name_col = None
            if 'product_name' in column_mapping:
                product_name_col = column_mapping['product_name']
            elif 'name' in column_mapping:
                product_name_col = column_mapping['name']
            else:
                return Response(
                    {'error': 'Required column "Name" or "product_name" not found in file.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check for price column (can be "price", "retail price", or "retail_price")
            price_col_key = None
            if 'retail price' in column_mapping or 'retail_price' in column_mapping:
                price_col_key = 'retail price' if 'retail price' in column_mapping else 'retail_price'
            elif 'price' in column_mapping:
                price_col_key = 'price'
            
            if not price_col_key:
                return Response(
                    {'error': 'Required column "Price", "Retail Price", or "retail_price" not found in file.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Extract unique category names
            category_column = column_mapping.get('category', None)
            category_names = set()
            if category_column:
                category_names = set(df[category_column].dropna().astype(str).str.strip())
                category_names = {c for c in category_names if c and c.lower() != 'nan'}
            
            # Resolve/create categories
            category_map = {}
            if category_names:
                category_map = self.resolve_categories(category_names, tenant)
                # Count created vs existing
                for cat_name in category_names:
                    normalized = str(cat_name).strip()
                    existing = Category.objects.filter(tenant=tenant, name__iexact=normalized).exists()
                    if existing:
                        results['categories_existing'] += 1
                    else:
                        results['categories_created'] += 1
            
            # Group rows by product_name for variation support
            # Process products and their variations together
            from collections import defaultdict
            product_groups = defaultdict(list)
            
            for idx, row in df.iterrows():
                product_name = str(row[product_name_col]).strip() if pd.notna(row[product_name_col]) else ""
                if product_name:
                    product_groups[product_name].append((idx, row))
            
            results['total_rows'] = len(df)
            
            # Process each product group
            for product_name, rows in product_groups.items():
                try:
                    # Get first row for product-level data
                    first_idx, first_row = rows[0]
                    row_num = first_idx + 2  # Excel row number
                    
                    # Extract product-level data from first row
                    price_col = column_mapping[price_col_key]
                    
                    name = str(first_row[product_name_col]).strip() if pd.notna(first_row[product_name_col]) else product_name
                    price_str = str(first_row[price_col]).strip() if pd.notna(first_row[price_col]) else "0"
                    
                    # Validate required fields
                    if not name:
                        results['errors'].append({
                            'row': row_num,
                            'product_name': 'Unknown',
                            'error': 'Name is required'
                        })
                        results['failed'] += 1
                        continue
                    
                    try:
                        price = float(price_str)
                        if price < 0.01:
                            results['errors'].append({
                                'row': row_num,
                                'product_name': name,
                                'error': 'Price must be greater than 0.01'
                            })
                            results['failed'] += 1
                            continue
                    except (ValueError, TypeError):
                        results['errors'].append({
                            'row': row_num,
                            'product_name': name,
                            'error': f'Invalid price value: {price_str}'
                        })
                        results['failed'] += 1
                        continue
                    
                    # Get optional fields from first row (product-level)
                    stock = 0
                    if 'stock' in column_mapping:
                        stock_val = first_row[column_mapping['stock']]
                        if pd.notna(stock_val):
                            try:
                                stock = int(float(stock_val))
                            except (ValueError, TypeError):
                                stock = 0
                    
                    unit = 'pcs'
                    if 'unit' in column_mapping:
                        unit_val = first_row[column_mapping['unit']]
                        if pd.notna(unit_val):
                            unit = str(unit_val).strip() or 'pcs'
                    
                    sku = None
                    if 'sku' in column_mapping:
                        sku_val = first_row[column_mapping['sku']]
                        if pd.notna(sku_val):
                            sku = str(sku_val).strip()
                            if not sku:
                                sku = None
                    
                    category_id = None
                    if category_column:
                        category_name = first_row[category_column]
                        if pd.notna(category_name):
                            cat_name_str = str(category_name).strip()
                            if cat_name_str and cat_name_str.lower() != 'nan':
                                category_id = category_map.get(cat_name_str)
                                if not category_id:
                                    results['warnings'].append({
                                        'row': row_num,
                                        'product_name': name,
                                        'warning': f'Category "{cat_name_str}" not found, product created without category'
                                    })
                    
                    barcode = None
                    if 'barcode' in column_mapping:
                        barcode_val = first_row[column_mapping['barcode']]
                        if pd.notna(barcode_val):
                            barcode = str(barcode_val).strip() or None
                    
                    cost = None
                    if 'cost' in column_mapping:
                        cost_val = first_row[column_mapping['cost']]
                        if pd.notna(cost_val):
                            try:
                                cost = float(cost_val)
                                if cost < 0:
                                    cost = 0
                            except (ValueError, TypeError):
                                cost = None
                    
                    description = ""
                    if 'description' in column_mapping:
                        desc_val = first_row[column_mapping['description']]
                        if pd.notna(desc_val):
                            description = str(desc_val).strip()
                    
                    # Handle business-specific fields (add to product description)
                    business_specific_info = []
                    
                    # Bar-specific fields (from first row, applies to product)
                    if 'volume_ml' in column_mapping:
                        volume_val = first_row[column_mapping['volume_ml']]
                        if pd.notna(volume_val):
                            try:
                                volume_ml = int(float(volume_val))
                                if volume_ml > 0:
                                    business_specific_info.append(f"Volume: {volume_ml}ml")
                            except (ValueError, TypeError):
                                pass
                    
                    if 'alcohol_percentage' in column_mapping:
                        alcohol_val = first_row[column_mapping['alcohol_percentage']]
                        if pd.notna(alcohol_val):
                            try:
                                alcohol_pct = float(alcohol_val)
                                if alcohol_pct >= 0:
                                    business_specific_info.append(f"Alcohol: {alcohol_pct}%")
                            except (ValueError, TypeError):
                                pass
                    
                    # Restaurant-specific fields
                    if 'preparation_time' in column_mapping:
                        prep_val = first_row[column_mapping['preparation_time']]
                        if pd.notna(prep_val):
                            try:
                                prep_time = int(float(prep_val))
                                if prep_time >= 0:
                                    business_specific_info.append(f"Prep time: {prep_time} min")
                            except (ValueError, TypeError):
                                pass
                    
                    # Append business-specific info to description
                    if business_specific_info:
                        if description:
                            description += " | " + " | ".join(business_specific_info)
                        else:
                            description = " | ".join(business_specific_info)
                    
                    low_stock_threshold = 0
                    if 'low_stock_threshold' in column_mapping:
                        threshold_col = column_mapping['low_stock_threshold']
                        threshold_val = first_row[threshold_col]
                        if pd.notna(threshold_val):
                            try:
                                low_stock_threshold = int(float(threshold_val))
                            except (ValueError, TypeError):
                                low_stock_threshold = 0
                    
                    is_active = True
                    if 'is_active' in column_mapping:
                        active_col = column_mapping['is_active']
                        active_val = first_row[active_col]
                        if pd.notna(active_val):
                            active_str = str(active_val).strip().lower()
                            is_active = active_str in ('yes', 'true', '1', 'y')
                    
                    # Prepare product data
                    product_data = {
                        'name': name,
                        'retail_price': str(price),  # Use retail_price instead of price
                        'stock': stock,
                        'unit': unit,
                        'description': description,
                        'low_stock_threshold': low_stock_threshold,
                        'is_active': is_active,
                    }
                    
                    # Only include SKU if provided (not None or empty)
                    if sku and sku.strip():
                        product_data['sku'] = sku.strip()
                    # If sku is None or empty, don't include it (will be NULL in database)
                    
                    if category_id:
                        product_data['category_id'] = category_id
                    
                    if barcode:
                        product_data['barcode'] = barcode
                    
                    if cost is not None:
                        product_data['cost'] = str(cost)
                    
                    # Handle cost_price column (backward compatibility)
                    if 'cost_price' in column_mapping:
                        cost_price_col = column_mapping['cost_price']
                        cost_price_val = first_row[cost_price_col]
                        if pd.notna(cost_price_val):
                            try:
                                cost_price = float(cost_price_val)
                                if cost_price >= 0:
                                    product_data['cost'] = str(cost_price)
                            except (ValueError, TypeError):
                                pass  # Invalid cost_price, skip it
                    
                    # Handle wholesale pricing
                    wholesale_price = None
                    wholesale_enabled = False
                    if 'wholesale_price' in column_mapping:
                        wholesale_col = column_mapping['wholesale_price']
                        wholesale_val = first_row[wholesale_col]
                        if pd.notna(wholesale_val):
                            try:
                                wholesale_price = float(wholesale_val)
                                if wholesale_price > 0:
                                    wholesale_enabled = True
                                    product_data['wholesale_price'] = str(wholesale_price)
                                    product_data['wholesale_enabled'] = True
                                    # Set minimum wholesale quantity (default 1, or from column if exists)
                                    if 'minimum_wholesale_quantity' in column_mapping:
                                        min_qty_col = column_mapping['minimum_wholesale_quantity']
                                        min_qty_val = first_row[min_qty_col]
                                        if pd.notna(min_qty_val):
                                            try:
                                                min_qty = int(float(min_qty_val))
                                                if min_qty > 0:
                                                    product_data['minimum_wholesale_quantity'] = min_qty
                                            except (ValueError, TypeError):
                                                product_data['minimum_wholesale_quantity'] = 1
                                    else:
                                        product_data['minimum_wholesale_quantity'] = 1
                            except (ValueError, TypeError):
                                pass  # Invalid wholesale price, skip it
                    
                    # Outlet is already validated earlier, use it directly
                    # outlet_id and outlet are already set above
                    
                    # Create or update product (outlet-specific)
                    product, product_created = Product.objects.get_or_create(
                        tenant=tenant,
                        outlet=outlet,
                        name=name,
                        defaults=product_data
                    )
                    
                    if not product_created:
                        # Update existing product
                        for key, value in product_data.items():
                            if key != 'name':  # Don't update name
                                setattr(product, key, value)
                        product.save()
                    
                    # Now process variations for this product
                    from apps.inventory.models import LocationStock
                    from apps.outlets.models import Outlet
                    
                    for var_idx, (row_idx, row) in enumerate(rows):
                        var_row_num = row_idx + 2
                        try:
                            # Get variation name (empty = default)
                            variation_name_col = column_mapping.get('variation_name')
                            if variation_name_col:
                                variation_name = str(row[variation_name_col]).strip() if pd.notna(row[variation_name_col]) else ""
                            else:
                                variation_name = ""
                            
                            if not variation_name:
                                variation_name = "Default"
                            
                            # Get variation price (required)
                            var_price_str = str(row[price_col]).strip() if pd.notna(row[price_col]) else "0"
                            try:
                                var_price = float(var_price_str)
                                if var_price < 0.01:
                                    results['errors'].append({
                                        'row': var_row_num,
                                        'product_name': name,
                                        'variation_name': variation_name,
                                        'error': 'Variation price must be greater than 0.01'
                                    })
                                    results['failed'] += 1
                                    continue
                            except (ValueError, TypeError):
                                results['errors'].append({
                                    'row': var_row_num,
                                    'product_name': name,
                                    'variation_name': variation_name,
                                    'error': f'Invalid variation price: {var_price_str}'
                                })
                                results['failed'] += 1
                                continue
                            
                            # Get variation fields
                            var_cost = None
                            if 'cost' in column_mapping:
                                var_cost_val = row[column_mapping['cost']]
                                if pd.notna(var_cost_val):
                                    try:
                                        var_cost = float(var_cost_val)
                                        if var_cost < 0:
                                            var_cost = 0
                                    except (ValueError, TypeError):
                                        var_cost = None
                            
                            var_sku = ""
                            if 'variation_sku' in column_mapping:
                                var_sku_val = row[column_mapping['variation_sku']]
                                if pd.notna(var_sku_val):
                                    var_sku = str(var_sku_val).strip()
                            
                            var_barcode = ""
                            if 'variation_barcode' in column_mapping:
                                var_barcode_val = row[column_mapping['variation_barcode']]
                                if pd.notna(var_barcode_val):
                                    var_barcode = str(var_barcode_val).strip()
                            
                            var_track_inventory = True
                            if 'track_inventory' in column_mapping:
                                track_val = row[column_mapping['track_inventory']]
                                if pd.notna(track_val):
                                    track_str = str(track_val).strip().lower()
                                    var_track_inventory = track_str in ('yes', 'true', '1', 'y')
                            
                            var_unit = unit  # Default to product unit
                            if 'unit' in column_mapping:
                                var_unit_val = row[column_mapping['unit']]
                                if pd.notna(var_unit_val):
                                    var_unit = str(var_unit_val).strip() or unit
                            
                            var_low_stock = 0
                            if 'low_stock_threshold' in column_mapping:
                                var_low_val = row[column_mapping['low_stock_threshold']]
                                if pd.notna(var_low_val):
                                    try:
                                        var_low_stock = int(float(var_low_val))
                                    except (ValueError, TypeError):
                                        var_low_stock = 0
                            
                            var_sort_order = var_idx
                            if 'sort_order' in column_mapping:
                                var_sort_val = row[column_mapping['sort_order']]
                                if pd.notna(var_sort_val):
                                    try:
                                        var_sort_order = int(float(var_sort_val))
                                    except (ValueError, TypeError):
                                        var_sort_order = var_idx
                            
                            var_is_active = True
                            if 'is_active' in column_mapping:
                                var_active_val = row[column_mapping['is_active']]
                                if pd.notna(var_active_val):
                                    var_active_str = str(var_active_val).strip().lower()
                                    var_is_active = var_active_str in ('yes', 'true', '1', 'y')
                            
                            # Handle restaurant-specific is_menu_item field (affects track_inventory)
                            if 'is_menu_item' in column_mapping:
                                menu_val = row[column_mapping['is_menu_item']]
                                if pd.notna(menu_val):
                                    menu_str = str(menu_val).strip().lower()
                                    is_menu = menu_str in ('yes', 'true', '1', 'y')
                                    # If is_menu_item=No, typically don't track inventory
                                    if not is_menu:
                                        var_track_inventory = False
                            
                            # Note: Business-specific fields (volume_ml, alcohol_percentage, preparation_time)
                            # are added to the product description at product level (from first row)
                            # Variation-level business-specific info would go here if needed in the future
                            
                            # UNITS ONLY ARCHITECTURE: Variations removed from imports
                            # Skip variation creation as the ItemVariation model has been deleted
                        
                        except Exception as e:
                            logger.error(f"Error processing variation row {var_row_num}: {str(e)}", exc_info=True)
                            results['errors'].append({
                                'row': var_row_num,
                                'product_name': name,
                                'variation_name': variation_name if 'variation_name' in locals() else 'Unknown',
                                'error': str(e)
                            })
                            results['failed'] += 1
                    
                    results['imported'] += 1
                
                except Exception as e:
                    logger.error(f"Error processing product {product_name}: {str(e)}", exc_info=True)
                    results['errors'].append({
                        'row': row_num,
                        'product_name': product_name,
                        'error': str(e)
                    })
                    results['failed'] += 1
            
            results['success'] = True
            
            return Response(results, status=status.HTTP_200_OK)
        
        except pd.errors.EmptyDataError:
            return Response(
                {'error': 'The uploaded file is empty.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Bulk import error: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Error processing file: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], url_path='bulk-export')
    def bulk_export(self, request):
        """
        Bulk export products to Excel/CSV file
        Exports retail_price and wholesale_price columns
        """
        tenant = getattr(request, 'tenant', None) or (request.user.tenant if hasattr(request, 'user') and request.user.is_authenticated else None)
        if not tenant:
            return Response(
                {'error': 'Unable to determine tenant. Please ensure you are authenticated and have a tenant assigned.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get format (default: xlsx)
        export_format = request.query_params.get('format', 'xlsx').lower()
        if export_format not in ['xlsx', 'csv']:
            export_format = 'xlsx'
        
        # Get queryset with tenant and outlet filtering
        queryset = self.get_queryset()
        
        # Get all products
        products = list(queryset.select_related('category', 'outlet').order_by('name'))
        
        if not products:
            return Response(
                {'error': 'No products found to export.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            # Prepare data for export
            export_data = []
            for product in products:
                row = {
                    'Name': product.name,
                    'Description': product.description or '',
                    'SKU': product.sku or '',
                    'Barcode': product.barcode or '',
                    'Category': product.category.name if product.category else '',
                    'Outlet': product.outlet.name if product.outlet else '',
                    'Retail Price': float(product.retail_price),
                    'Wholesale Price': float(product.wholesale_price) if product.wholesale_price else '',
                    'Cost Price': float(product.cost) if product.cost else '',
                    'Stock': product.stock,
                    'Low Stock Threshold': product.low_stock_threshold,
                    'Unit': product.unit,
                    'Wholesale Enabled': 'Yes' if product.wholesale_enabled else 'No',
                    'Minimum Wholesale Quantity': product.minimum_wholesale_quantity if product.wholesale_enabled else '',
                    'Is Active': 'Yes' if product.is_active else 'No',
                }
                export_data.append(row)
            
            # Create DataFrame
            df = pd.DataFrame(export_data)
            
            # Create response
            if export_format == 'csv':
                # CSV export
                output = io.StringIO()
                df.to_csv(output, index=False)
                output.seek(0)
                
                from django.http import HttpResponse
                response = HttpResponse(output.getvalue(), content_type='text/csv')
                response['Content-Disposition'] = f'attachment; filename="products_export_{tenant.id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv"'
                return response
            else:
                # Excel export
                output = io.BytesIO()
                with pd.ExcelWriter(output, engine='openpyxl') as writer:
                    df.to_excel(writer, index=False, sheet_name='Products')
                
                output.seek(0)
                
                from django.http import HttpResponse
                response = HttpResponse(
                    output.getvalue(),
                    content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                )
                response['Content-Disposition'] = f'attachment; filename="products_export_{tenant.id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx"'
                return response
        
        except Exception as e:
            logger.error(f"Bulk export error: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Error exporting products: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )




class ProductUnitViewSet(viewsets.ModelViewSet, TenantFilterMixin):
    """Product Unit ViewSet for multi-unit selling - UNITS ONLY ARCHITECTURE"""
    queryset = ProductUnit.objects.select_related('product', 'product__tenant', 'product__outlet')
    serializer_class = ProductUnitSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['product', 'is_active']
    search_fields = ['unit_name', 'product__name']
    ordering_fields = ['sort_order', 'unit_name', 'created_at']
    ordering = ['sort_order', 'unit_name']
    
    def get_queryset(self):
        """Filter by tenant through product and outlet"""
        user = self.request.user
        is_saas_admin = getattr(user, 'is_saas_admin', False)
        request_tenant = getattr(self.request, 'tenant', None)
        user_tenant = getattr(user, 'tenant', None)
        tenant = request_tenant or user_tenant
        
        queryset = ProductUnit.objects.select_related('product', 'product__tenant', 'product__outlet').all()
        
        # Apply tenant filter through product
        if not is_saas_admin:
            if tenant:
                queryset = queryset.filter(product__tenant=tenant)
            else:
                return queryset.none()
        
        # Filter by product if provided
        product_id = self.request.query_params.get('product')
        if product_id:
            queryset = queryset.filter(product_id=product_id)
        
        # Filter by outlet through product
        outlet = self.get_outlet_for_request(self.request)
        if outlet:
            queryset = queryset.filter(product__outlet=outlet)
        
        return queryset
    
    def get_serializer_context(self):
        """Add outlet context for stock calculations"""
        context = super().get_serializer_context()
        
        # Check query params first, then headers (X-Outlet-ID)
        outlet_id = self.request.query_params.get('outlet') or self.request.query_params.get('outlet_id')
        if not outlet_id:
            outlet_id = self.request.headers.get('X-Outlet-ID')
        
        if outlet_id:
            try:
                from apps.outlets.models import Outlet
                outlet = Outlet.objects.get(id=outlet_id)
                context['outlet'] = outlet
            except Outlet.DoesNotExist:
                pass
        
        return context
    
    def perform_create(self, serializer):
        """Set product and validate it belongs to tenant"""
        product_id = self.request.data.get('product')
        if not product_id:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Product is required.")
        
        tenant = getattr(self.request, 'tenant', None) or self.request.user.tenant
        if not tenant:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Tenant is required.")
        
        try:
            product = Product.objects.get(id=product_id, tenant=tenant)
        except Product.DoesNotExist:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Product not found or does not belong to your tenant.")
        
        serializer.save(product=product)

