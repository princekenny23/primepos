from rest_framework import serializers

from .models import ProcessedClientEvent


class SyncEventSerializer(serializers.Serializer):
    client_event_id = serializers.CharField(max_length=128)
    event_type = serializers.CharField(max_length=120)
    payload = serializers.JSONField(required=False)
    tenant_id = serializers.CharField(max_length=64)
    outlet_id = serializers.CharField(max_length=64)
    user_id = serializers.CharField(max_length=64)


class SyncPushBatchSerializer(serializers.Serializer):
    events = SyncEventSerializer(many=True)


class AdminSyncEventSerializer(serializers.ModelSerializer):
    tenant_name = serializers.SerializerMethodField()
    outlet_name = serializers.SerializerMethodField()

    class Meta:
        model = ProcessedClientEvent
        fields = (
            "id",
            "tenant_id",
            "tenant_name",
            "outlet_id",
            "outlet_name",
            "user_id",
            "client_event_id",
            "event_type",
            "status",
            "detail",
            "retry_count",
            "last_error",
            "created_at",
            "processed_at",
        )

    def get_tenant_name(self, obj):
        tenant = getattr(obj, "tenant", None)
        return tenant.name if tenant else None

    def get_outlet_name(self, obj):
        outlet = getattr(obj, "outlet", None)
        return outlet.name if outlet else None


class AdminSyncRequeueSerializer(serializers.Serializer):
    event_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )
