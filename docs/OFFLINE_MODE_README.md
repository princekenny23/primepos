# Offline Mode README

## Purpose
This document explains:
- what Offline Mode has already implemented in PrimePOS
- how to test it safely in local/staging before production rollout

Offline mode is feature-flagged and default-off, so existing logic remains unchanged until explicitly enabled.

## What Is Implemented

### Phase 0 (Foundation)
Implemented:
- Frontend offline feature flags
- Frontend offline status store + bootstrap listeners for online/offline transitions
- Backend sync app scaffold and routes
- Backend offline feature flags

Key backend routes:
- `GET /api/v1/sync/status/`
- `POST /api/v1/sync/push-batch/`
- `GET /api/v1/sync/pull-changes/`

### Phase 1 (Read Offline Foundation)
Implemented:
- Service worker registration (feature-gated)
- Read-cache skeleton for selected GET endpoints
- Dashboard offline status indicator (feature-gated)

### Phase 2 (Transactional Offline Foundation)
Implemented:
- IndexedDB outbox for write event queueing when offline
- Retry pipeline and dead-letter promotion for permanently failing events
- Periodic push/pull sync loop on reconnect
- Tenant-scoped idempotency on backend (`tenant_id + client_event_id`)
- Cursor-based pull change feed
- Event processor mapping for core sales replay paths

Mapped sales events include:
- `post:/sales/`
- `post:/sales/checkout-cash/`
- `post:/sales/initiate-payment/`
- `post:/sales/{id}/finalize-payment/`
- `post:/sales/{id}/void-transaction/`

### Admin Monitoring + Requeue (Operational Controls)
Implemented:
- Admin sync health endpoint
- Admin rejected-events endpoint with tenant filter and pagination (`limit`, `offset`)
- Admin requeue endpoint for failed events
- Frontend admin monitor page with tenant filter, search, pagination, and bulk requeue

Admin endpoints:
- `GET /api/v1/admin/sync/health/`
- `GET /api/v1/admin/sync/rejected-events/`
- `POST /api/v1/admin/sync/requeue/`

Admin UI:
- `/admin/sync`

## Feature Flags

### Frontend (.env)
- `NEXT_PUBLIC_OFFLINE_MODE_ENABLED=true`
- `NEXT_PUBLIC_OFFLINE_MODE_PHASE=2`

### Backend (.env / settings)
- `OFFLINE_MODE_ENABLED=true`
- `OFFLINE_MODE_PHASE=2`

Recommended for first validation:
- Start with `phase=1` to verify read/offline indicators
- Move to `phase=2` to verify outbox write sync

## Test Setup
1. Start backend
- `cd backend`
- `python manage.py migrate`
- `python manage.py runserver`

2. Start frontend
- `cd frontend`
- `npm install`
- `npm run dev`

3. Confirm flags are loaded
- Open app and verify offline status indicator appears only when offline mode is enabled.

## Test Scenarios

### A) Baseline Safety (Flags Off)
Goal: confirm no behavior regression.
1. Set offline flags to disabled.
2. Restart backend/frontend.
3. Execute normal POS flow online.
Expected:
- Existing business logic behaves exactly as before.
- No offline queue/sync behavior is active.

### B) Read Offline Foundation (Phase 1)
Goal: confirm service worker + UI state handling.
1. Enable phase 1 flags.
2. Load dashboard and key pages online once.
3. Disconnect network (browser devtools offline mode or disable internet).
Expected:
- Offline status indicator shows offline state.
- Previously cached read pages/data remain available where implemented.
- No write sync processing is attempted yet.

### C) Transactional Offline Queue (Phase 2)
Goal: verify outbox queue and replay.
1. Enable phase 2 flags.
2. Go offline.
3. Perform supported sales actions.
4. Return online.
Expected:
- Writes are queued while offline.
- On reconnect, queued events are pushed and processed.
- Sync status updates to reflect accepted/duplicate/rejected outcomes.

### D) Idempotency Verification
Goal: ensure duplicate replay protection.
1. Trigger same `client_event_id` replay (or resend same event from queue scenario).
Expected:
- Backend records duplicate safely without double-applying transaction.
- No duplicate business transaction is created.

### E) Rejected Event Monitoring + Requeue
Goal: validate operational recovery path.
1. Create/identify rejected events (invalid payload/path scenario).
2. Open `/admin/sync` as SaaS admin.
3. Apply tenant filter if needed.
4. Select rejected events and click requeue.
Expected:
- Health cards and rejected list load.
- Pagination and tenant filtering work.
- Requeue updates status and retry counters.

### F) Multi-Tenant Isolation
Goal: confirm tenant safety.
1. Produce events under Tenant A.
2. Query health/rejected events under Tenant B context.
Expected:
- Tenant B does not see Tenant A events unless explicit SaaS admin tenant query is used.

## Quick API Checks (Optional)
Use these examples for smoke tests:

1. Sync status
- `GET /api/v1/sync/status/`

2. Rejected events paged
- `GET /api/v1/admin/sync/rejected-events/?tenant_id=<TENANT_ID>&limit=50&offset=0`

3. Requeue events
- `POST /api/v1/admin/sync/requeue/`
- body:
```json
{
  "event_ids": [101, 102]
}
```

## Known Current Gaps
- Conflict resolution UI beyond basic rejected-event handling is still evolving.
- Broader domain coverage (inventory/shift flows) is planned for later phases.
- Full chaos/performance test pack is not yet finalized.

## Rollout Recommendation
1. Pilot with one low-risk tenant in phase 1.
2. Promote pilot to phase 2 with controlled cashier users.
3. Monitor admin sync health and rejected-event trends daily.
4. Expand tenant cohort only after stable sync success and low reject rate.

## Related Docs
- `docs/OFFLINE_MODE_PRODUCTION_READINESS.md`
- `docs/END_TO_END_TESTING_GUIDE.md`
- `README.md`
