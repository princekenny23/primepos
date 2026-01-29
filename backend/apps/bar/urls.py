"""
Bar Management URL Configuration
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import BarTableViewSet, TabViewSet

router = DefaultRouter()
router.register(r'tables', BarTableViewSet, basename='bar-table')
router.register(r'tabs', TabViewSet, basename='tab')

urlpatterns = [
    path('', include(router.urls)),
]
