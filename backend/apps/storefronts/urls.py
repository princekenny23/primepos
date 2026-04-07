from django.urls import path

from .views import (
    StorefrontAdminDetailView,
    StorefrontAdminListView,
    StorefrontCatalogRuleDeleteView,
    StorefrontCatalogRulesView,
    StorefrontCategoriesView,
    StorefrontCheckoutCreateOrderView,
    StorefrontCheckoutValidateView,
    StorefrontConfigView,
    StorefrontDomainDeleteView,
    StorefrontDomainListCreateView,
    StorefrontEventIngestView,
    StorefrontAnalyticsView,
    StorefrontOrderDetailView,
    StorefrontOrderListView,
    StorefrontOrderUpdateStatusView,
    StorefrontProductDetailView,
    StorefrontProductsView,
    StorefrontResolveView,
)

urlpatterns = [
    # Admin / authenticated endpoints (fixed literal paths first to avoid slug collision)
    path('storefronts/', StorefrontAdminListView.as_view(), name='storefront-admin-list'),
    path('storefronts/resolve/', StorefrontResolveView.as_view(), name='storefront-resolve'),
    path('storefronts/orders/', StorefrontOrderListView.as_view(), name='storefront-order-list'),
    path('storefronts/orders/<str:public_order_ref>/status/', StorefrontOrderUpdateStatusView.as_view(), name='storefront-order-update-status'),
    # Admin storefront detail by numeric ID (must come before <slug:slug> patterns)
    path('storefronts/<int:sf_id>/', StorefrontAdminDetailView.as_view(), name='storefront-admin-detail'),
    path('storefronts/<int:sf_id>/rules/', StorefrontCatalogRulesView.as_view(), name='storefront-catalog-rules'),
    path('storefronts/<int:sf_id>/rules/<int:rule_id>/', StorefrontCatalogRuleDeleteView.as_view(), name='storefront-catalog-rule-delete'),
    path('storefronts/<int:sf_id>/domains/', StorefrontDomainListCreateView.as_view(), name='storefront-domain-list-create'),
    path('storefronts/<int:sf_id>/domains/<int:domain_id>/', StorefrontDomainDeleteView.as_view(), name='storefront-domain-delete'),
    path('storefronts/<int:sf_id>/analytics/', StorefrontAnalyticsView.as_view(), name='storefront-analytics'),
    # Public endpoints (slug-based)
    path('storefronts/<slug:slug>/config/', StorefrontConfigView.as_view(), name='storefront-config'),
    path('storefronts/<slug:slug>/categories/', StorefrontCategoriesView.as_view(), name='storefront-categories'),
    path('storefronts/<slug:slug>/products/', StorefrontProductsView.as_view(), name='storefront-products'),
    path('storefronts/<slug:slug>/products/<int:product_id>/', StorefrontProductDetailView.as_view(), name='storefront-product-detail'),
    path('storefronts/<slug:slug>/checkout/validate/', StorefrontCheckoutValidateView.as_view(), name='storefront-checkout-validate'),
    path('storefronts/<slug:slug>/checkout/create-order/', StorefrontCheckoutCreateOrderView.as_view(), name='storefront-checkout-create-order'),
    path('storefronts/<slug:slug>/orders/<str:public_order_ref>/', StorefrontOrderDetailView.as_view(), name='storefront-order-detail'),
    path('storefronts/<slug:slug>/events/', StorefrontEventIngestView.as_view(), name='storefront-events-ingest'),
]
