from django.urls import path

from .views import (
    ProductImportApproveView,
    ProductImportApplyView,
    ProductImportErrorsView,
    ProductImportHistoryView,
    ProductImportMissingProductsView,
    ProductImportPreviewView,
    ProductImportRecoverView,
    ProductImportRowUpdateView,
    ProductImportRowsView,
    ProductImportSourceDownloadView,
    ProductImportStatusView,
)

urlpatterns = [
    path('imports/products/history/', ProductImportHistoryView.as_view(), name='imports-products-history'),
    path('imports/products/preview/', ProductImportPreviewView.as_view(), name='imports-products-preview'),
    path('imports/products/<uuid:batch_id>/approve/', ProductImportApproveView.as_view(), name='imports-products-approve'),
    path('imports/products/<uuid:batch_id>/recover/', ProductImportRecoverView.as_view(), name='imports-products-recover'),
    path('imports/products/<uuid:batch_id>/apply/', ProductImportApplyView.as_view(), name='imports-products-apply'),
    path('imports/products/<uuid:batch_id>/status/', ProductImportStatusView.as_view(), name='imports-products-status'),
    path('imports/products/<uuid:batch_id>/errors/', ProductImportErrorsView.as_view(), name='imports-products-errors'),
    path('imports/products/<uuid:batch_id>/rows/', ProductImportRowsView.as_view(), name='imports-products-rows'),
    path('imports/products/<uuid:batch_id>/rows/<int:row_number>/', ProductImportRowUpdateView.as_view(), name='imports-products-row-update'),
    path('imports/products/<uuid:batch_id>/missing/', ProductImportMissingProductsView.as_view(), name='imports-products-missing'),
    path('imports/products/<uuid:batch_id>/source/', ProductImportSourceDownloadView.as_view(), name='imports-products-source-download'),
]
