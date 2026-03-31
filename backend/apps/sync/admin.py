from django.contrib import admin

from .models import ProcessedClientEvent, SyncChangeLog


@admin.register(ProcessedClientEvent)
class ProcessedClientEventAdmin(admin.ModelAdmin):
    list_display = ("id", "tenant", "outlet", "client_event_id", "event_type", "status", "created_at")
    list_filter = ("status", "event_type", "tenant")
    search_fields = ("client_event_id", "event_type", "tenant__name")
    readonly_fields = ("created_at", "processed_at")


@admin.register(SyncChangeLog)
class SyncChangeLogAdmin(admin.ModelAdmin):
    list_display = ("id", "tenant", "outlet", "operation", "entity_type", "entity_id", "created_at")
    list_filter = ("operation", "entity_type", "tenant")
    search_fields = ("entity_id", "tenant__name", "entity_type")
    readonly_fields = ("created_at",)
