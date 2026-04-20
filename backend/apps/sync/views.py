from django.conf import settings
from django.db import IntegrityError
from django.db.models import Count
from apps.outlets.models import Outlet
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ProcessedClientEvent, SyncChangeLog
from .processors import process_supported_event
from .serializers import (
    AdminSyncEventSerializer,
    AdminSyncRequeueSerializer,
    SyncPushBatchSerializer,
)
from apps.tenants.permissions import IsSaaSAdmin


class SyncBaseView(APIView):
    permission_classes = [IsAuthenticated]

    def _ensure_enabled(self):
        if not getattr(settings, "OFFLINE_MODE_ENABLED", False):
            return Response(
                {
                    "detail": "Offline sync is disabled.",
                    "offline_mode_enabled": False,
                    "phase": getattr(settings, "OFFLINE_MODE_PHASE", 0),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return None

    def _ensure_phase(self, minimum_phase: int):
        current_phase = int(getattr(settings, "OFFLINE_MODE_PHASE", 0) or 0)
        if current_phase < minimum_phase:
            return Response(
                {
                    "detail": f"Offline sync phase {minimum_phase} is required.",
                    "offline_mode_enabled": bool(getattr(settings, "OFFLINE_MODE_ENABLED", False)),
                    "phase": current_phase,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return None

    def _resolve_tenant(self, request):
        if getattr(request.user, "is_saas_admin", False):
            return request.query_params.get("tenant_id") or request.headers.get("X-Tenant-ID")
        if getattr(request.user, "tenant_id", None):
            return str(request.user.tenant_id)
        return str(getattr(getattr(request, "tenant", None), "id", "") or "")


class SyncStatusView(SyncBaseView):
    def get(self, request):
        tenant_id = self._resolve_tenant(request)
        metrics = {
            "accepted_events": 0,
            "duplicate_events": 0,
            "rejected_events": 0,
            "change_log_count": 0,
            "latest_cursor": 0,
        }

        if tenant_id:
            processed = ProcessedClientEvent.objects.filter(tenant_id=tenant_id)
            metrics = {
                "accepted_events": processed.filter(status="accepted").count(),
                "duplicate_events": processed.filter(status="duplicate").count(),
                "rejected_events": processed.filter(status="rejected").count(),
                "change_log_count": SyncChangeLog.objects.filter(tenant_id=tenant_id).count(),
                "latest_cursor": int(
                    SyncChangeLog.objects.filter(tenant_id=tenant_id).order_by("-id").values_list("id", flat=True).first() or 0
                ),
            }

        return Response(
            {
                "offline_mode_enabled": getattr(settings, "OFFLINE_MODE_ENABLED", False),
                "phase": getattr(settings, "OFFLINE_MODE_PHASE", 0),
                "status": "ready" if getattr(settings, "OFFLINE_MODE_ENABLED", False) else "disabled",
                "tenant_id": tenant_id,
                "metrics": metrics,
                "note": "Sync status includes tenant-scoped aggregate health counters.",
            }
        )


class SyncPushBatchView(SyncBaseView):
    def post(self, request):
        gate = self._ensure_enabled()
        if gate:
            return gate

        phase_gate = self._ensure_phase(2)
        if phase_gate:
            return phase_gate

        serializer = SyncPushBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        events = serializer.validated_data.get("events", [])

        tenant_id = self._resolve_tenant(request)
        user_id = str(getattr(request.user, "id", "") or "")
        if not tenant_id:
            return Response({"detail": "User must have a tenant."}, status=status.HTTP_400_BAD_REQUEST)

        accepted = 0
        conflicts = 0
        rejected = 0

        results = []
        for event in events:
            client_event_id = str(event.get("client_event_id", "") or "")
            event_tenant_id = str(event.get("tenant_id", "") or "")
            event_user_id = str(event.get("user_id", "") or "")
            event_outlet_id = str(event.get("outlet_id", "") or "")

            if event_tenant_id != tenant_id:
                rejected += 1
                results.append(
                    {
                        "client_event_id": client_event_id,
                        "status": "rejected",
                        "detail": "Tenant mismatch in sync event.",
                    }
                )
                continue

            if event_user_id and event_user_id != user_id and not getattr(request.user, "is_saas_admin", False):
                rejected += 1
                results.append(
                    {
                        "client_event_id": client_event_id,
                        "status": "rejected",
                        "detail": "User mismatch in sync event.",
                    }
                )
                continue

            outlet_obj = None
            if event_outlet_id:
                outlet_obj = Outlet.objects.filter(id=event_outlet_id, tenant_id=tenant_id).first()
                if not outlet_obj:
                    rejected += 1
                    results.append(
                        {
                            "client_event_id": client_event_id,
                            "status": "rejected",
                            "detail": "Invalid outlet for tenant.",
                        }
                    )
                    continue

            payload = event.get("payload") or {}

            try:
                processor_result = process_supported_event(
                    user=request.user,
                    tenant_id=str(tenant_id),
                    outlet_id=str(event_outlet_id or ""),
                    event_type=event.get("event_type", "unknown"),
                    payload=payload,
                )

                processed_status = "accepted"
                processed_detail = "Event accepted and stored for Phase 2 processing."
                operation = "accepted"

                if processor_result.get("handled"):
                    if processor_result.get("status") == "accepted":
                        processed_status = "accepted"
                        processed_detail = str(processor_result.get("detail") or "Event applied.")
                        operation = "applied"
                    elif processor_result.get("status") == "rejected":
                        processed_status = "rejected"
                        processed_detail = str(processor_result.get("detail") or "Event rejected by mapped processor.")
                        operation = "rejected"

                created = ProcessedClientEvent.objects.create(
                    tenant_id=tenant_id,
                    outlet=outlet_obj,
                    user=request.user,
                    client_event_id=client_event_id,
                    event_type=event.get("event_type", "unknown"),
                    payload=payload,
                    status=processed_status,
                    detail=processed_detail,
                )
                SyncChangeLog.objects.create(
                    tenant_id=tenant_id,
                    outlet=outlet_obj,
                    entity_type="sync_event",
                    entity_id=client_event_id,
                    operation=operation,
                    payload={
                        "event_type": created.event_type,
                        "processed_event_id": created.id,
                        "status": processed_status,
                        "processor": {
                            "handled": bool(processor_result.get("handled")),
                            "status": processor_result.get("status"),
                            "status_code": processor_result.get("status_code"),
                        },
                    },
                )
                if processed_status == "accepted":
                    accepted += 1
                    results.append(
                        {
                            "client_event_id": client_event_id,
                            "status": "accepted",
                            "detail": processed_detail,
                        }
                    )
                else:
                    rejected += 1
                    results.append(
                        {
                            "client_event_id": client_event_id,
                            "status": "rejected",
                            "detail": processed_detail,
                        }
                    )
            except IntegrityError:
                existing = ProcessedClientEvent.objects.filter(
                    tenant_id=tenant_id,
                    client_event_id=client_event_id,
                ).first()
                conflicts += 1
                results.append(
                    {
                        "client_event_id": client_event_id,
                        "status": "duplicate",
                        "detail": existing.detail if existing else "Duplicate client_event_id.",
                    }
                )

        return Response(
            {
                "phase": getattr(settings, "OFFLINE_MODE_PHASE", 0),
                "accepted": accepted,
                "conflicts": conflicts,
                "rejected": rejected,
                "results": results,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class SyncPullChangesView(SyncBaseView):
    def get(self, request):
        gate = self._ensure_enabled()
        if gate:
            return gate

        phase_gate = self._ensure_phase(2)
        if phase_gate:
            return phase_gate

        tenant_id = self._resolve_tenant(request)
        if not tenant_id:
            if getattr(request.user, "is_saas_admin", False):
                return Response(
                    {
                        "phase": getattr(settings, "OFFLINE_MODE_PHASE", 0),
                        "cursor_in": 0,
                        "cursor_out": 0,
                        "changes": [],
                        "detail": "No tenant context provided for SaaS admin; returning empty delta feed.",
                    }
                )
            return Response({"detail": "User must have a tenant."}, status=status.HTTP_400_BAD_REQUEST)

        cursor_raw = request.query_params.get("cursor")
        try:
            cursor = int(cursor_raw) if cursor_raw is not None else 0
        except ValueError:
            return Response({"detail": "cursor must be an integer."}, status=status.HTTP_400_BAD_REQUEST)

        qs = SyncChangeLog.objects.filter(tenant_id=tenant_id, id__gt=cursor).order_by("id")

        outlet_id = request.query_params.get("outlet_id") or request.headers.get("X-Outlet-ID")
        if outlet_id:
            qs = qs.filter(outlet_id=outlet_id)

        changes = []
        last_id = cursor
        for change in qs[:200]:
            changes.append(
                {
                    "cursor": change.id,
                    "operation": change.operation,
                    "entity_type": change.entity_type,
                    "entity_id": change.entity_id,
                    "payload": change.payload,
                    "created_at": change.created_at,
                }
            )
            last_id = change.id

        return Response(
            {
                "phase": getattr(settings, "OFFLINE_MODE_PHASE", 0),
                "cursor_in": cursor,
                "cursor_out": last_id,
                "changes": changes,
                "detail": "Delta feed delivered.",
            }
        )


class AdminSyncHealthView(APIView):
    permission_classes = [IsAuthenticated, IsSaaSAdmin]

    def get(self, request):
        tenant_id = request.query_params.get("tenant_id")
        base_qs = ProcessedClientEvent.objects.all()
        change_qs = SyncChangeLog.objects.all()

        if tenant_id:
            base_qs = base_qs.filter(tenant_id=tenant_id)
            change_qs = change_qs.filter(tenant_id=tenant_id)

        status_counts = {
            row["status"]: row["count"]
            for row in base_qs.values("status").annotate(count=Count("id"))
        }

        latest_cursor = int(change_qs.order_by("-id").values_list("id", flat=True).first() or 0)

        return Response(
            {
                "tenant_id": tenant_id,
                "metrics": {
                    "accepted_events": int(status_counts.get("accepted", 0)),
                    "duplicate_events": int(status_counts.get("duplicate", 0)),
                    "rejected_events": int(status_counts.get("rejected", 0)),
                    "change_log_count": int(change_qs.count()),
                    "latest_cursor": latest_cursor,
                },
            }
        )


class AdminSyncRejectedEventsView(APIView):
    permission_classes = [IsAuthenticated, IsSaaSAdmin]

    def get(self, request):
        tenant_id = request.query_params.get("tenant_id")
        limit_raw = request.query_params.get("limit")
        offset_raw = request.query_params.get("offset")
        try:
            limit = max(1, min(int(limit_raw or 100), 500))
        except ValueError:
            limit = 100
        try:
            offset = max(0, int(offset_raw or 0))
        except ValueError:
            offset = 0

        qs = ProcessedClientEvent.objects.select_related("tenant", "outlet").filter(status="rejected").order_by("-created_at")
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)

        total = qs.count()
        events = qs[offset : offset + limit]
        serializer = AdminSyncEventSerializer(events, many=True)
        return Response(
            {
                "count": total,
                "limit": limit,
                "offset": offset,
                "has_next": (offset + limit) < total,
                "results": serializer.data,
            }
        )


class AdminSyncRequeueView(APIView):
    permission_classes = [IsAuthenticated, IsSaaSAdmin]

    def post(self, request):
        serializer = AdminSyncRequeueSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event_ids = serializer.validated_data["event_ids"]

        events = ProcessedClientEvent.objects.select_related("tenant", "outlet").filter(id__in=event_ids)
        event_map = {event.id: event for event in events}

        requeued = 0
        rejected = 0
        results = []

        for event_id in event_ids:
            event = event_map.get(event_id)
            if not event:
                results.append({"event_id": event_id, "status": "missing", "detail": "Event not found."})
                rejected += 1
                continue

            outlet_id = str(event.outlet_id or "")
            processor_result = process_supported_event(
                user=request.user,
                tenant_id=str(event.tenant_id),
                outlet_id=outlet_id,
                event_type=event.event_type,
                payload=event.payload,
            )

            if processor_result.get("status") == "accepted":
                event.status = "accepted"
                event.detail = str(processor_result.get("detail") or "Requeue applied successfully.")
                event.last_error = ""
                event.retry_count = int(event.retry_count or 0) + 1
                event.save(update_fields=["status", "detail", "last_error", "retry_count", "processed_at"])

                SyncChangeLog.objects.create(
                    tenant_id=event.tenant_id,
                    outlet_id=event.outlet_id,
                    entity_type="sync_event",
                    entity_id=event.client_event_id,
                    operation="requeue_applied",
                    payload={
                        "processed_event_id": event.id,
                        "status": event.status,
                        "retry_count": event.retry_count,
                    },
                )

                requeued += 1
                results.append({"event_id": event_id, "status": "accepted", "detail": event.detail})
            else:
                event.status = "rejected"
                event.retry_count = int(event.retry_count or 0) + 1
                event.last_error = str(processor_result.get("detail") or "Requeue failed")
                event.detail = event.last_error
                event.save(update_fields=["status", "detail", "last_error", "retry_count", "processed_at"])

                SyncChangeLog.objects.create(
                    tenant_id=event.tenant_id,
                    outlet_id=event.outlet_id,
                    entity_type="sync_event",
                    entity_id=event.client_event_id,
                    operation="requeue_failed",
                    payload={
                        "processed_event_id": event.id,
                        "status": event.status,
                        "retry_count": event.retry_count,
                        "last_error": event.last_error,
                    },
                )

                rejected += 1
                results.append({"event_id": event_id, "status": "rejected", "detail": event.detail})

        return Response(
            {
                "requested": len(event_ids),
                "requeued": requeued,
                "rejected": rejected,
                "results": results,
            }
        )
