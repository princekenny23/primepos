from django.contrib import admin
from django.core.exceptions import ValidationError
from .models import Category, Product, ProductUnit


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'tenant', 'created_at')
    list_filter = ('tenant', 'created_at')
    search_fields = ('name',)
    
    def get_queryset(self, request):
        """Filter categories by tenant"""
        queryset = super().get_queryset(request)
        user = request.user
        
        # Ensure user.tenant is loaded from database
        if not hasattr(user, '_tenant_loaded'):
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.select_related('tenant').get(pk=user.pk)
                request.user = user
                user._tenant_loaded = True
            except User.DoesNotExist:
                pass
        
        # SaaS admins can see all categories
        if getattr(user, 'is_saas_admin', False):
            return queryset
        
        # Regular users only see their tenant's categories
        if hasattr(user, 'tenant') and user.tenant:
            return queryset.filter(tenant=user.tenant)
        
        return queryset.none()
    
    def save_model(self, request, obj, form, change):
        """Ensure tenant is set for new categories"""
        if not change and not obj.tenant_id:
            # For new categories, set tenant from user
            if hasattr(request.user, 'tenant') and request.user.tenant:
                obj.tenant = request.user.tenant
        super().save_model(request, obj, form, change)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'sku', 'tenant', 'outlet', 'category', 'price', 'stock', 'is_active', 'created_at')
    list_filter = ('tenant', 'outlet', 'category', 'is_active', 'created_at')
    search_fields = ('name', 'sku', 'barcode')
    readonly_fields = ('created_at', 'updated_at')
    
    def get_queryset(self, request):
        """Filter products by tenant and outlet"""
        queryset = super().get_queryset(request).select_related('tenant', 'outlet', 'category')
        user = request.user
        
        # Ensure user.tenant is loaded from database
        if not hasattr(user, '_tenant_loaded'):
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.select_related('tenant').get(pk=user.pk)
                request.user = user
                user._tenant_loaded = True
            except User.DoesNotExist:
                pass
        
        # SaaS admins can see all products
        if getattr(user, 'is_saas_admin', False):
            return queryset
        
        # Regular users only see their tenant's products
        if hasattr(user, 'tenant') and user.tenant:
            return queryset.filter(tenant=user.tenant)
        
        return queryset.none()
    
    def save_model(self, request, obj, form, change):
        """Ensure tenant and outlet are set correctly"""
        user = request.user
        
        # For new products, set tenant from user if not set
        if not change and not obj.tenant_id:
            if hasattr(user, 'tenant') and user.tenant:
                obj.tenant = user.tenant
        
        # Validate outlet belongs to tenant
        if obj.outlet_id and obj.tenant_id:
            if obj.outlet.tenant_id != obj.tenant_id:
                raise ValidationError(
                    f"Outlet '{obj.outlet.name}' does not belong to tenant '{obj.tenant.name}'. "
                    "Please select an outlet that belongs to your tenant."
                )
        
        super().save_model(request, obj, form, change)
    
    def get_form(self, request, obj=None, **kwargs):
        """Limit outlet choices to user's tenant outlets"""
        form = super().get_form(request, obj, **kwargs)
        user = request.user
        
        # Ensure user.tenant is loaded from database
        if not hasattr(user, '_tenant_loaded'):
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.select_related('tenant').get(pk=user.pk)
                request.user = user
                user._tenant_loaded = True
            except User.DoesNotExist:
                pass
        
        # If not SaaS admin, limit outlet choices to user's tenant
        if not getattr(user, 'is_saas_admin', False) and hasattr(user, 'tenant') and user.tenant:
            from apps.outlets.models import Outlet
            form.base_fields['outlet'].queryset = Outlet.objects.filter(tenant=user.tenant)
            form.base_fields['category'].queryset = form.base_fields['category'].queryset.filter(tenant=user.tenant)
        
        return form


# Register ProductUnit for admin visibility (ItemVariation removed - UNITS ONLY ARCHITECTURE)
@admin.register(ProductUnit)
class ProductUnitAdmin(admin.ModelAdmin):
    list_display = ('product', 'unit_name', 'conversion_factor', 'retail_price', 'wholesale_price', 'is_active', 'sort_order', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('unit_name', 'product__name')
    ordering = ('product', 'sort_order', 'unit_name')
    
    def get_queryset(self, request):
        """Filter units by tenant through product relationship"""
        queryset = super().get_queryset(request).select_related('product__tenant', 'product__outlet')
        user = request.user
        
        # Ensure user.tenant is loaded from database
        if not hasattr(user, '_tenant_loaded'):
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.select_related('tenant').get(pk=user.pk)
                request.user = user
                user._tenant_loaded = True
            except User.DoesNotExist:
                pass
        
        # SaaS admins can see all units
        if getattr(user, 'is_saas_admin', False):
            return queryset
        
        # Regular users only see units for their tenant's products
        if hasattr(user, 'tenant') and user.tenant:
            return queryset.filter(product__tenant=user.tenant)
        
        return queryset.none()
    
    def get_form(self, request, obj=None, **kwargs):
        """Limit product choices to user's tenant products"""
        form = super().get_form(request, obj, **kwargs)
        user = request.user
        
        # Ensure user.tenant is loaded from database
        if not hasattr(user, '_tenant_loaded'):
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.select_related('tenant').get(pk=user.pk)
                request.user = user
                user._tenant_loaded = True
            except User.DoesNotExist:
                pass
        
        # If not SaaS admin, limit product choices to user's tenant
        if not getattr(user, 'is_saas_admin', False) and hasattr(user, 'tenant') and user.tenant:
            form.base_fields['product'].queryset = Product.objects.filter(tenant=user.tenant)
        
        return form

