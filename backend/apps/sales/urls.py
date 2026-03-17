from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SaleViewSet, ReceiptViewSet, ReceiptTemplateViewSet, PrintJobViewSet, DeviceViewSet, PrinterViewSet

router = DefaultRouter()
router.register(r'sales', SaleViewSet, basename='sale')
router.register(r'receipts', ReceiptViewSet, basename='receipt')
router.register(r'receipt-templates', ReceiptTemplateViewSet, basename='receipttemplate')
router.register(r'print-jobs', PrintJobViewSet, basename='print-job')
router.register(r'devices', DeviceViewSet, basename='print-device')
router.register(r'cloud-printers', PrinterViewSet, basename='cloud-printer')

urlpatterns = [
    path('', include(router.urls)),
]

