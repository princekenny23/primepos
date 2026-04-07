from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.products.models import Category, Product
from apps.inventory.models import StockMovement

from .models import Storefront, StorefrontCatalogRule, StorefrontDomain, StorefrontEvent, StorefrontOrder
from .serializers import (
    CatalogRuleSerializer,
    StorefrontAdminSerializer,
    StorefrontDomainSerializer,
    StorefrontEventIngestSerializer,
    PublicCategorySerializer,
    PublicProductSerializer,
    PublicStorefrontConfigSerializer,
    StorefrontOrderSerializer,
    WhatsAppCheckoutSerializer,
    apply_catalog_rules,
)
from .services import create_whatsapp_order


class StorefrontResolverMixin:
    def get_storefront_by_slug(self, slug: str):
        return Storefront.objects.select_related('tenant', 'default_outlet').filter(slug=slug, is_active=True).first()

    def get_allowed_products_queryset(self, storefront: Storefront):
        qs = Product.objects.filter(
            tenant=storefront.tenant,
            outlet=storefront.default_outlet,
            is_active=True,
        )
        return apply_catalog_rules(storefront, qs)

    def validate_checkout_items(self, storefront: Storefront, items: list):
        allowed_products_qs = self.get_allowed_products_queryset(storefront)
        allowed_ids = set(allowed_products_qs.values_list('id', flat=True))

        for index, item in enumerate(items):
            product = Product.objects.filter(
                id=item['product_id'],
                tenant=storefront.tenant,
                outlet=storefront.default_outlet,
                is_active=True,
            ).first()
            if not product or product.id not in allowed_ids:
                return Response({'detail': f'Item {index + 1}: invalid product.'}, status=status.HTTP_400_BAD_REQUEST)

            unit = None
            requested = item['quantity']
            if item.get('unit_id'):
                unit = product.selling_units.filter(id=item['unit_id'], is_active=True).first()
                if not unit:
                    return Response({'detail': f'Item {index + 1}: invalid unit.'}, status=status.HTTP_400_BAD_REQUEST)
                requested = unit.convert_to_base_units(item['quantity'])

            if product.stock < requested:
                return Response(
                    {'detail': f'Item {index + 1}: insufficient stock for {product.name}.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        return None


class StorefrontResolveView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        host = (request.query_params.get('host') or request.get_host() or '').split(':')[0].strip().lower()
        slug = (request.query_params.get('slug') or '').strip().lower()

        storefront = None
        if host:
            domain = StorefrontDomain.objects.select_related('storefront', 'storefront__tenant', 'storefront__default_outlet').filter(
                domain__iexact=host,
                storefront__is_active=True,
            ).first()
            storefront = domain.storefront if domain else None

        if not storefront and slug:
            storefront = Storefront.objects.select_related('tenant', 'default_outlet').filter(slug=slug, is_active=True).first()

        if not storefront:
            return Response({'detail': 'Storefront not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'slug': storefront.slug,
            'name': storefront.name,
            'currency': storefront.currency_override or storefront.tenant.currency,
            'has_whatsapp_checkout': True,
        })


class StorefrontConfigView(APIView, StorefrontResolverMixin):
    permission_classes = [AllowAny]

    def get(self, request, slug: str):
        storefront = self.get_storefront_by_slug(slug)
        if not storefront:
            return Response({'detail': 'Storefront not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(PublicStorefrontConfigSerializer(storefront).data)


class StorefrontCategoriesView(APIView, StorefrontResolverMixin):
    permission_classes = [AllowAny]

    def get(self, request, slug: str):
        storefront = self.get_storefront_by_slug(slug)
        if not storefront:
            return Response({'detail': 'Storefront not found.'}, status=status.HTTP_404_NOT_FOUND)

        products_qs = Product.objects.filter(
            tenant=storefront.tenant,
            outlet=storefront.default_outlet,
            is_active=True,
        )
        products_qs = apply_catalog_rules(storefront, products_qs)
        category_ids = products_qs.exclude(category_id=None).values_list('category_id', flat=True).distinct()

        categories = Category.objects.filter(id__in=category_ids, tenant=storefront.tenant).order_by('name')
        return Response(PublicCategorySerializer(categories, many=True).data)


class StorefrontProductsView(APIView, StorefrontResolverMixin):
    permission_classes = [AllowAny]

    def get(self, request, slug: str):
        storefront = self.get_storefront_by_slug(slug)
        if not storefront:
            return Response({'detail': 'Storefront not found.'}, status=status.HTTP_404_NOT_FOUND)

        qs = Product.objects.select_related('category').prefetch_related('selling_units').filter(
            tenant=storefront.tenant,
            outlet=storefront.default_outlet,
            is_active=True,
        )
        category_id = request.query_params.get('category_id')
        if category_id:
            qs = qs.filter(category_id=category_id)

        search = (request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(description__icontains=search))

        in_stock = (request.query_params.get('in_stock') or '').strip().lower()
        if in_stock in {'1', 'true', 'yes', 'on'}:
            qs = qs.filter(stock__gt=0)

        sort = (request.query_params.get('sort') or '').strip().lower()
        if sort == 'newest':
            qs = qs.order_by('-created_at', 'name')
        else:
            qs = qs.order_by('name')

        new_stock_days_raw = request.query_params.get('new_stock_days')
        try:
            new_stock_days = int(new_stock_days_raw) if new_stock_days_raw else 30
        except (TypeError, ValueError):
            new_stock_days = 30
        new_stock_days = max(1, min(new_stock_days, 365))

        limit_raw = request.query_params.get('limit')
        limit = None
        if limit_raw:
            try:
                limit = max(1, min(int(limit_raw), 100))
            except (TypeError, ValueError):
                limit = None

        qs = apply_catalog_rules(storefront, qs)
        if limit is not None:
            qs = qs[:limit]

        product_ids = list(qs.values_list('id', flat=True))
        cutoff = timezone.now() - timedelta(days=new_stock_days)
        recent_restock_product_ids = set(
            StockMovement.objects.filter(
                tenant=storefront.tenant,
                outlet=storefront.default_outlet,
                movement_type__in=['purchase', 'transfer_in', 'return', 'adjustment'],
                created_at__gte=cutoff,
                product_id__in=product_ids,
            )
            .values_list('product_id', flat=True)
            .distinct()
        )

        serializer = PublicProductSerializer(
            qs,
            many=True,
            context={
                'request': request,
                'new_stock_days': new_stock_days,
                'recent_restock_product_ids': recent_restock_product_ids,
            }
        )
        return Response(serializer.data)


class StorefrontProductDetailView(APIView, StorefrontResolverMixin):
    permission_classes = [AllowAny]

    def get(self, request, slug: str, product_id: int):
        storefront = self.get_storefront_by_slug(slug)
        if not storefront:
            return Response({'detail': 'Storefront not found.'}, status=status.HTTP_404_NOT_FOUND)

        qs = Product.objects.select_related('category').prefetch_related('selling_units').filter(
            tenant=storefront.tenant,
            outlet=storefront.default_outlet,
            is_active=True,
            id=product_id,
        )
        qs = apply_catalog_rules(storefront, qs)
        product = qs.first()
        if not product:
            return Response({'detail': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(PublicProductSerializer(product, context={'request': request}).data)


class StorefrontCheckoutValidateView(APIView, StorefrontResolverMixin):
    permission_classes = [AllowAny]

    def post(self, request, slug: str):
        storefront = self.get_storefront_by_slug(slug)
        if not storefront:
            return Response({'detail': 'Storefront not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = WhatsAppCheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validation_error = self.validate_checkout_items(storefront, serializer.validated_data['items'])
        if validation_error:
            return validation_error

        return Response({'valid': True})


class StorefrontCheckoutCreateOrderView(APIView, StorefrontResolverMixin):
    permission_classes = [AllowAny]

    def post(self, request, slug: str):
        storefront = self.get_storefront_by_slug(slug)
        if not storefront:
            return Response({'detail': 'Storefront not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = WhatsAppCheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validation_error = self.validate_checkout_items(storefront, serializer.validated_data['items'])
        if validation_error:
            return validation_error

        try:
            order, whatsapp_url = create_whatsapp_order(storefront, serializer.validated_data)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                'order': StorefrontOrderSerializer(order).data,
                'whatsapp_url': whatsapp_url,
            },
            status=status.HTTP_201_CREATED,
        )


class StorefrontOrderDetailView(APIView, StorefrontResolverMixin):
    permission_classes = [AllowAny]

    def get(self, request, slug: str, public_order_ref: str):
        storefront = self.get_storefront_by_slug(slug)
        if not storefront:
            return Response({'detail': 'Storefront not found.'}, status=status.HTTP_404_NOT_FOUND)

        order = StorefrontOrder.objects.select_related('sale').filter(
            storefront=storefront,
            public_order_ref=public_order_ref,
        ).first()
        if not order:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(StorefrontOrderSerializer(order).data)


class StorefrontEventIngestView(APIView, StorefrontResolverMixin):
    permission_classes = [AllowAny]

    def post(self, request, slug: str):
        storefront = self.get_storefront_by_slug(slug)
        if not storefront:
            return Response({'detail': 'Storefront not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = StorefrontEventIngestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        StorefrontEvent.objects.create(
            storefront=storefront,
            event_name=serializer.validated_data['event_name'],
            session_id=serializer.validated_data.get('session_id', ''),
            metadata=serializer.validated_data.get('metadata', {}),
        )
        return Response({'ok': True}, status=status.HTTP_201_CREATED)


class StorefrontOrderListView(APIView):
    """Authenticated endpoint for dashboard: list all orders for tenant's storefronts."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        tenant = getattr(request, 'tenant', None) or getattr(user, 'tenant', None)
        if not tenant:
            return Response({'detail': 'Tenant not resolved.'}, status=status.HTTP_400_BAD_REQUEST)

        slug = request.query_params.get('slug')
        qs = StorefrontOrder.objects.select_related('sale', 'storefront').filter(
            storefront__tenant=tenant,
        )
        if slug:
            qs = qs.filter(storefront__slug=slug)
        qs = qs.order_by('-created_at')
        return Response(StorefrontOrderSerializer(qs, many=True).data)


class StorefrontAdminListView(APIView):
    """Authenticated endpoint: list all storefronts for the current tenant."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        tenant = getattr(request, 'tenant', None) or getattr(user, 'tenant', None)
        if not tenant:
            return Response({'detail': 'Tenant not resolved.'}, status=status.HTTP_400_BAD_REQUEST)

        storefronts = Storefront.objects.select_related('default_outlet').filter(tenant=tenant).order_by('name')
        return Response(StorefrontAdminSerializer(storefronts, many=True).data)

    def post(self, request):
        user = request.user
        tenant = getattr(request, 'tenant', None) or getattr(user, 'tenant', None)
        if not tenant:
            return Response({'detail': 'Tenant not resolved.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = StorefrontAdminSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        outlet = serializer.validated_data.get('default_outlet')
        if outlet and outlet.tenant_id != tenant.id:
            return Response({'detail': 'Outlet does not belong to your tenant.'}, status=status.HTTP_403_FORBIDDEN)
        instance = serializer.save(tenant=tenant)
        return Response(StorefrontAdminSerializer(instance).data, status=status.HTTP_201_CREATED)


class StorefrontAdminDetailView(APIView):
    """Authenticated GET/PATCH for a specific storefront by database ID."""
    permission_classes = [IsAuthenticated]

    def _get(self, request, sf_id):
        user = request.user
        tenant = getattr(request, 'tenant', None) or getattr(user, 'tenant', None)
        if not tenant:
            return None, Response({'detail': 'Tenant not resolved.'}, status=status.HTTP_400_BAD_REQUEST)
        sf = Storefront.objects.select_related('default_outlet').filter(id=sf_id, tenant=tenant).first()
        if not sf:
            return None, Response({'detail': 'Storefront not found.'}, status=status.HTTP_404_NOT_FOUND)
        return sf, None

    def get(self, request, sf_id):
        sf, err = self._get(request, sf_id)
        if err:
            return err
        return Response(StorefrontAdminSerializer(sf).data)

    def patch(self, request, sf_id):
        sf, err = self._get(request, sf_id)
        if err:
            return err
        serializer = StorefrontAdminSerializer(sf, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = request.user
        tenant = getattr(request, 'tenant', None) or getattr(user, 'tenant', None)
        outlet = serializer.validated_data.get('default_outlet')
        if outlet and outlet.tenant_id != tenant.id:
            return Response({'detail': 'Outlet does not belong to your tenant.'}, status=status.HTTP_403_FORBIDDEN)
        serializer.save()
        return Response(StorefrontAdminSerializer(sf).data)


class StorefrontCatalogRulesView(APIView):
    """Authenticated GET/POST for catalog rules of a storefront."""
    permission_classes = [IsAuthenticated]

    def _get_sf(self, request, sf_id):
        user = request.user
        tenant = getattr(request, 'tenant', None) or getattr(user, 'tenant', None)
        if not tenant:
            return None, Response({'detail': 'Tenant not resolved.'}, status=status.HTTP_400_BAD_REQUEST)
        sf = Storefront.objects.filter(id=sf_id, tenant=tenant).first()
        if not sf:
            return None, Response({'detail': 'Storefront not found.'}, status=status.HTTP_404_NOT_FOUND)
        return sf, None

    def get(self, request, sf_id):
        sf, err = self._get_sf(request, sf_id)
        if err:
            return err
        rules = StorefrontCatalogRule.objects.select_related('category', 'product').filter(storefront=sf)
        return Response(CatalogRuleSerializer(rules, many=True).data)

    def post(self, request, sf_id):
        sf, err = self._get_sf(request, sf_id)
        if err:
            return err
        serializer = CatalogRuleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rule = serializer.save(storefront=sf)
        return Response(CatalogRuleSerializer(rule).data, status=status.HTTP_201_CREATED)


class StorefrontCatalogRuleDeleteView(APIView):
    """Authenticated DELETE for a specific catalog rule."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, sf_id, rule_id):
        user = request.user
        tenant = getattr(request, 'tenant', None) or getattr(user, 'tenant', None)
        rule = StorefrontCatalogRule.objects.select_related('storefront').filter(
            id=rule_id, storefront__id=sf_id, storefront__tenant=tenant
        ).first()
        if not rule:
            return Response({'detail': 'Rule not found.'}, status=status.HTTP_404_NOT_FOUND)
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StorefrontDomainListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_sf(self, request, sf_id):
        user = request.user
        tenant = getattr(request, 'tenant', None) or getattr(user, 'tenant', None)
        if not tenant:
            return None, Response({'detail': 'Tenant not resolved.'}, status=status.HTTP_400_BAD_REQUEST)
        sf = Storefront.objects.filter(id=sf_id, tenant=tenant).first()
        if not sf:
            return None, Response({'detail': 'Storefront not found.'}, status=status.HTTP_404_NOT_FOUND)
        return sf, None

    def get(self, request, sf_id):
        sf, err = self._get_sf(request, sf_id)
        if err:
            return err
        domains = StorefrontDomain.objects.filter(storefront=sf).order_by('-is_primary', 'domain')
        return Response(StorefrontDomainSerializer(domains, many=True).data)

    def post(self, request, sf_id):
        sf, err = self._get_sf(request, sf_id)
        if err:
            return err

        serializer = StorefrontDomainSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(storefront=sf)
        if instance.is_primary:
            StorefrontDomain.objects.filter(storefront=sf).exclude(id=instance.id).update(is_primary=False)
        return Response(StorefrontDomainSerializer(instance).data, status=status.HTTP_201_CREATED)


class StorefrontDomainDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, sf_id, domain_id):
        user = request.user
        tenant = getattr(request, 'tenant', None) or getattr(user, 'tenant', None)
        domain = StorefrontDomain.objects.select_related('storefront').filter(
            id=domain_id,
            storefront__id=sf_id,
            storefront__tenant=tenant,
        ).first()
        if not domain:
            return Response({'detail': 'Domain not found.'}, status=status.HTTP_404_NOT_FOUND)
        domain.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StorefrontAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, sf_id):
        user = request.user
        tenant = getattr(request, 'tenant', None) or getattr(user, 'tenant', None)
        sf = Storefront.objects.filter(id=sf_id, tenant=tenant).first()
        if not sf:
            return Response({'detail': 'Storefront not found.'}, status=status.HTTP_404_NOT_FOUND)

        since = timezone.now() - timedelta(days=30)
        events = StorefrontEvent.objects.filter(storefront=sf, created_at__gte=since)
        orders = StorefrontOrder.objects.filter(storefront=sf, created_at__gte=since)

        payload = {
            'period_days': 30,
            'events': {
                'add_to_cart': events.filter(event_name='storefront_add_to_cart').count(),
                'checkout_success': events.filter(event_name='storefront_checkout_success').count(),
                'checkout_failed': events.filter(event_name='storefront_checkout_failed').count(),
                'open_whatsapp_chat': events.filter(event_name='storefront_open_whatsapp_chat').count(),
                'copy_whatsapp_preview': events.filter(event_name='storefront_copy_whatsapp_preview').count(),
                'view_product': events.filter(event_name='storefront_view_product').count(),
            },
            'orders': {
                'total': orders.count(),
                'pending': orders.filter(status='pending').count(),
                'confirmed': orders.filter(status='confirmed').count(),
                'cancelled': orders.filter(status='cancelled').count(),
            },
        }
        return Response(payload)


class StorefrontOrderUpdateStatusView(APIView):
    """Authenticated PATCH to update the status of a storefront order."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, public_order_ref):
        user = request.user
        tenant = getattr(request, 'tenant', None) or getattr(user, 'tenant', None)
        order = StorefrontOrder.objects.filter(
            public_order_ref=public_order_ref,
            storefront__tenant=tenant,
        ).first()
        if not order:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)
        valid_statuses = [s for s, _ in StorefrontOrder.STATUS_CHOICES]
        new_status = request.data.get('status')
        if new_status not in valid_statuses:
            return Response(
                {'detail': f"Invalid status. Valid choices: {valid_statuses}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        order.status = new_status
        order.save(update_fields=['status'])
        return Response(StorefrontOrderSerializer(order).data)
