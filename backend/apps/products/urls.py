from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProductViewSet, CategoryViewSet, ProductUnitViewSet, export_products_csv

router = DefaultRouter()
router.register(r'products', ProductViewSet, basename='product')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'units', ProductUnitViewSet, basename='unit')
urlpatterns = [
    path('products/bulk-import/', ProductViewSet.as_view({'post': 'bulk_import'}), name='product-bulk-import'),
    path('products/bulk-export/', export_products_csv, name='product-bulk-export'),
    path('', include(router.urls)),
]

