from datetime import timedelta
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from apps.products.models import Category, Product, ProductUnit

from .models import Storefront, StorefrontCatalogRule, StorefrontDomain, StorefrontEvent, StorefrontOrder


class PublicStorefrontConfigSerializer(serializers.ModelSerializer):
    currency = serializers.SerializerMethodField()

    class Meta:
        model = Storefront
        fields = (
            'name',
            'slug',
            'currency',
            'whatsapp_number',
            'theme_settings',
            'checkout_settings',
            'seo_settings',
        )

    def get_currency(self, obj):
        return obj.currency_override or obj.tenant.currency


class PublicCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ('id', 'name', 'description')


class PublicProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    image_url = serializers.SerializerMethodField()
    display_price = serializers.SerializerMethodField()
    is_new_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            'id',
            'name',
            'description',
            'category',
            'category_name',
            'retail_price',
            'display_price',
            'stock',
            'unit',
            'image_url',
            'created_at',
            'is_new_stock',
        )

    def get_image_url(self, obj):
        request = self.context.get('request')
        if not obj.image:
            return ''
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url

    def get_display_price(self, obj):
        active_unit = obj.selling_units.filter(is_active=True).order_by('conversion_factor', 'id').first()
        if active_unit:
            return active_unit.retail_price
        return obj.retail_price

    def get_is_new_stock(self, obj):
        now = timezone.now()
        override_until = obj.new_stock_override_until

        # Manual override takes priority while valid.
        if obj.new_stock_override is not None and (
            override_until is None or override_until >= now
        ):
            return bool(obj.new_stock_override)

        new_stock_days = int(self.context.get('new_stock_days', 30))
        cutoff = now - timedelta(days=max(1, new_stock_days))
        created_recently = obj.created_at >= cutoff

        restock_ids = self.context.get('recent_restock_product_ids')
        if isinstance(restock_ids, set):
            restocked_recently = obj.id in restock_ids
        else:
            restocked_recently = False

        return created_recently or restocked_recently


class CheckoutItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    unit_id = serializers.IntegerField(required=False, allow_null=True)
    quantity = serializers.IntegerField(min_value=1)


class WhatsAppCheckoutSerializer(serializers.Serializer):
    customer_name = serializers.CharField(max_length=255)
    customer_phone = serializers.CharField(max_length=32, required=False, allow_blank=True)
    customer_address = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    items = CheckoutItemSerializer(many=True, min_length=1)


class StorefrontOrderSerializer(serializers.ModelSerializer):
    sale_id = serializers.IntegerField(source='sale.id', read_only=True)
    receipt_number = serializers.CharField(source='sale.receipt_number', read_only=True)
    total = serializers.DecimalField(source='sale.total', max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = StorefrontOrder
        fields = (
            'public_order_ref',
            'channel',
            'payment_method',
            'status',
            'customer_name',
            'customer_phone',
            'sale_id',
            'receipt_number',
            'total',
            'created_at',
        )



class StorefrontAdminSerializer(serializers.ModelSerializer):
    outlet_name = serializers.CharField(source='default_outlet.name', read_only=True)

    class Meta:
        model = Storefront
        fields = (
            'id', 'name', 'slug', 'default_outlet', 'outlet_name',
            'whatsapp_number', 'currency_override', 'is_active',
            'theme_settings', 'checkout_settings', 'seo_settings',
        )
        read_only_fields = ('id', 'outlet_name')


class CatalogRuleSerializer(serializers.ModelSerializer):
    category_name = serializers.SerializerMethodField()
    product_name = serializers.SerializerMethodField()

    class Meta:
        model = StorefrontCatalogRule
        fields = ('id', 'rule_type', 'category', 'category_name', 'product', 'product_name', 'created_at')
        read_only_fields = ('id', 'category_name', 'product_name', 'created_at')

    def get_category_name(self, obj):
        return obj.category.name if obj.category_id else None

    def get_product_name(self, obj):
        return obj.product.name if obj.product_id else None

    def validate(self, attrs):
        if not attrs.get('category') and not attrs.get('product'):
            raise serializers.ValidationError("Either category or product must be specified.")
        if attrs.get('category') and attrs.get('product'):
            raise serializers.ValidationError("Specify only one of category or product, not both.")
        return attrs


class StorefrontDomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = StorefrontDomain
        fields = ('id', 'domain', 'is_primary', 'is_verified', 'ssl_status', 'created_at')
        read_only_fields = ('id', 'is_verified', 'ssl_status', 'created_at')


class StorefrontEventIngestSerializer(serializers.Serializer):
    event_name = serializers.CharField(max_length=64)
    session_id = serializers.CharField(max_length=64, required=False, allow_blank=True)
    metadata = serializers.JSONField(required=False)

    def validate_event_name(self, value):
        allowed = {
            'storefront_add_to_cart',
            'storefront_checkout_success',
            'storefront_checkout_failed',
            'storefront_copy_whatsapp_preview',
            'storefront_open_whatsapp_chat',
            'storefront_view_product',
        }
        if value not in allowed:
            raise serializers.ValidationError('Unsupported event name.')
        return value


def apply_catalog_rules(storefront: Storefront, products_qs):
    rules = StorefrontCatalogRule.objects.filter(storefront=storefront)
    includes = rules.filter(rule_type='include')
    excludes = rules.filter(rule_type='exclude')

    include_product_ids = list(includes.exclude(product_id=None).values_list('product_id', flat=True))
    include_category_ids = list(includes.exclude(category_id=None).values_list('category_id', flat=True))
    exclude_product_ids = list(excludes.exclude(product_id=None).values_list('product_id', flat=True))
    exclude_category_ids = list(excludes.exclude(category_id=None).values_list('category_id', flat=True))

    # Only explicitly included products/categories are visible in storefront catalog.
    if not include_product_ids and not include_category_ids:
        return products_qs.none()

    products_qs = products_qs.filter(
        Q(id__in=include_product_ids) |
        Q(category_id__in=include_category_ids)
    )

    if exclude_product_ids:
        products_qs = products_qs.exclude(id__in=exclude_product_ids)
    if exclude_category_ids:
        products_qs = products_qs.exclude(category_id__in=exclude_category_ids)

    return products_qs
