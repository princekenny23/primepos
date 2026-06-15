from django.urls import path

from .views import (
    AdminSyncHealthView,
    AdminSyncRejectedEventsView,
    AdminSyncRequeueView,
    SyncStatusView,
    SyncPushBatchView,
    SyncPullChangesView,
    AdminPendingEventsView,
    AdminEventDetailView,
    AdminBatchApplyView,
    AdminBatchDeleteView,
)

urlpatterns = [
    path("sync/status/", SyncStatusView.as_view(), name="sync-status"),
    path("sync/push-batch/", SyncPushBatchView.as_view(), name="sync-push-batch"),
    path("sync/pull-changes/", SyncPullChangesView.as_view(), name="sync-pull-changes"),
    path("admin/sync/health/", AdminSyncHealthView.as_view(), name="admin-sync-health"),
    path("admin/sync/rejected-events/", AdminSyncRejectedEventsView.as_view(), name="admin-sync-rejected-events"),
    path("admin/sync/requeue/", AdminSyncRequeueView.as_view(), name="admin-sync-requeue"),
    path("admin/sync/pending/", AdminPendingEventsView.as_view(), name="admin-sync-pending"),
    path("admin/sync/event/<int:event_id>/", AdminEventDetailView.as_view(), name="admin-sync-event-detail"),
    path("admin/sync/batch-apply/", AdminBatchApplyView.as_view(), name="admin-sync-batch-apply"),
    path("admin/sync/batch-delete/", AdminBatchDeleteView.as_view(), name="admin-sync-batch-delete"),
]
