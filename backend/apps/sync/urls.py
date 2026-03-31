from django.urls import path

from .views import (
    AdminSyncHealthView,
    AdminSyncRejectedEventsView,
    AdminSyncRequeueView,
    SyncStatusView,
    SyncPushBatchView,
    SyncPullChangesView,
)

urlpatterns = [
    path("sync/status/", SyncStatusView.as_view(), name="sync-status"),
    path("sync/push-batch/", SyncPushBatchView.as_view(), name="sync-push-batch"),
    path("sync/pull-changes/", SyncPullChangesView.as_view(), name="sync-pull-changes"),
    path("admin/sync/health/", AdminSyncHealthView.as_view(), name="admin-sync-health"),
    path("admin/sync/rejected-events/", AdminSyncRejectedEventsView.as_view(), name="admin-sync-rejected-events"),
    path("admin/sync/requeue/", AdminSyncRequeueView.as_view(), name="admin-sync-requeue"),
]
