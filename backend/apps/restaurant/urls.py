from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TableViewSet, KitchenOrderTicketViewSet, RestaurantOrderViewSet

router = DefaultRouter()
router.register(r'tables', TableViewSet, basename='restaurant-table')
router.register(r'kitchen-orders', KitchenOrderTicketViewSet, basename='kitchen-order')
router.register(r'orders', RestaurantOrderViewSet, basename='restaurant-order')

urlpatterns = [
    path('', include(router.urls)),
]

