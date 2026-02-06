"""
URL configuration for primepos project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from apps.products.views import ProductViewSet
from django.views.decorators.http import require_http_methods
from .api_root import api_root

@require_http_methods(["GET"])
def root_view(request):
    """Root URL - redirects to API documentation"""
    return JsonResponse({
        'message': 'Welcome to PrimePOS API',
        'version': '1.0.0',
        'documentation': {
            'api_root': '/api/v1/',
            'admin': '/admin/',
            'authentication': '/api/v1/auth/login/',
        },
        'info': 'Visit /api/v1/ for complete API endpoint listing'
    })

urlpatterns = [
    path('', root_view, name='root'),
    path('admin/', admin.site.urls),
    path('', include('apps.health.urls')),
    path('api/v1/', api_root, name='api-root'),
    path('api/v1/products/bulk-import/', ProductViewSet.as_view({'post': 'bulk_import'}), name='product-bulk-import'),
    path('api/v1/products/bulk-export/', ProductViewSet.as_view({'get': 'bulk_export'}), name='product-bulk-export'),
    path('api/v1/', include('apps.accounts.urls')),
    path('api/v1/', include('apps.tenants.urls')),
    path('api/v1/', include('apps.outlets.urls')),
    path('api/v1/', include('apps.products.urls')),
    path('api/v1/', include('apps.inventory.urls')),
    path('api/v1/', include('apps.sales.urls')),
    path('api/v1/', include('apps.customers.urls')),
    # path('api/v1/', include('apps.payments.urls')),  # Removed - new implementation pending
    path('api/v1/', include('apps.staff.urls')),
    path('api/v1/', include('apps.suppliers.urls')),
    path('api/v1/', include('apps.shifts.urls')),
    path('api/v1/', include('apps.restaurant.urls')),
    path('api/v1/', include('apps.reports.urls')),
    path('api/v1/', include('apps.activity_logs.urls')),
    path('api/v1/', include('apps.notifications.urls')),
    path('api/v1/', include('apps.expenses.urls')),
    path('api/v1/', include('apps.admin.urls')),
    path('api/v1/', include('apps.quotations.urls')),
    path('api/v1/bar/', include('apps.bar.urls')),
    
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

