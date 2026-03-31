from django.conf import settings
from django.db import models


class ProcessedClientEvent(models.Model):
    STATUS_CHOICES = [
        ("accepted", "Accepted"),
        ("duplicate", "Duplicate"),
        ("rejected", "Rejected"),
    ]

    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.CASCADE, related_name="processed_sync_events")
    outlet = models.ForeignKey("outlets.Outlet", on_delete=models.SET_NULL, null=True, blank=True, related_name="processed_sync_events")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="processed_sync_events")

    client_event_id = models.CharField(max_length=128)
    event_type = models.CharField(max_length=120)
    payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="accepted")
    detail = models.TextField(blank=True)
    retry_count = models.IntegerField(default=0)
    last_error = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sync_processed_client_event"
        verbose_name = "Processed Client Event"
        verbose_name_plural = "Processed Client Events"
        ordering = ["-created_at"]
        unique_together = (("tenant", "client_event_id"),)
        indexes = [
            models.Index(fields=["tenant", "client_event_id"]),
            models.Index(fields=["tenant", "created_at"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.tenant_id}:{self.client_event_id} ({self.status})"


class SyncChangeLog(models.Model):
    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.CASCADE, related_name="sync_change_logs")
    outlet = models.ForeignKey("outlets.Outlet", on_delete=models.SET_NULL, null=True, blank=True, related_name="sync_change_logs")

    entity_type = models.CharField(max_length=120)
    entity_id = models.CharField(max_length=128)
    operation = models.CharField(max_length=40)
    payload = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "sync_change_log"
        verbose_name = "Sync Change Log"
        verbose_name_plural = "Sync Change Logs"
        ordering = ["id"]
        indexes = [
            models.Index(fields=["tenant", "id"]),
            models.Index(fields=["tenant", "created_at"]),
            models.Index(fields=["entity_type", "entity_id"]),
        ]

    def __str__(self):
        return f"{self.tenant_id}:{self.operation}:{self.entity_type}:{self.entity_id}"
