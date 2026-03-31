# Offline Mode Production Readiness Guide

## Purpose
This guide defines a production-ready approach to implement offline mode in PrimePOS as a SaaS, multi-tenant POS platform.

Goal: keep checkout operations running during internet outages while preserving data integrity, tenant isolation, and auditability.

## Current Implementation Status (Mar 30, 2026)
Implemented safely with feature flags and default-off behavior:

- Phase 0 complete:
  - frontend offline config + status store
  - frontend offline bootstrap (online/offline listeners)
  - backend sync app scaffold with `/api/v1/sync/status/`, `/api/v1/sync/push-batch/`, `/api/v1/sync/pull-changes/`
  - backend flags `OFFLINE_MODE_ENABLED` and `OFFLINE_MODE_PHASE`
- Phase 1 complete:
  - service worker registration when offline feature is enabled
  - read-cache strategy skeleton for products/customers/settings endpoints
  - dashboard offline status pill (visible only when feature enabled)
- Phase 2 foundation complete:
  - write requests can be queued to IndexedDB outbox when offline (feature-flagged)
  - periodic online flush loop pushes pending events to backend
  - backend persists events with tenant-scoped idempotency (`tenant + client_event_id`)
  - backend exposes cursor-based delta feed from sync change log
  - backend processor currently maps core sales events for replay:
    - `post:/sales/`
    - `post:/sales/checkout-cash/`
    - `post:/sales/initiate-payment/`
    - `post:/sales/{id}/finalize-payment/`
    - `post:/sales/{id}/void-transaction/`
  - client outbox now applies retry caps and promotes permanently failing events to dead-letter state for operator review
  - backend sync status exposes tenant-scoped aggregate health counters

Default behavior remains unchanged until flags are enabled.

## Offline Strategy (Recommended)
Use an offline-first + outbox sync architecture.

- Frontend continues working from local data (IndexedDB).
- Writes are stored as immutable local events.
- On reconnect, events are pushed to backend with idempotency keys.
- Backend returns per-event status (accepted/conflict/rejected).
- Client pulls server changes by cursor and reconciles local state.

Do not rely on cache-only offline support; POS needs durable local writes and deterministic sync.

## Scope by Domain
### Safe for Offline (Phase 1/2)
- POS cart operations
- Sales submission
- Payments capture
- Customer lookup (cached)
- Product and pricing lookup (cached)

### Add Carefully (Phase 3)
- Shift open/close
- Stock movement and adjustments
- Purchase receiving

### Keep Online-Only Initially
- User/role management
- Tax config changes
- Tenant-level settings
- Cross-outlet admin operations

## Frontend Implementation (Next.js)
### 1) Local Database
Use IndexedDB via Dexie.

Suggested tables:
- `products_cache`
- `customers_cache`
- `settings_cache`
- `active_cart`
- `outbox_events`
- `sync_state`

Minimum fields for `outbox_events`:
- `id` (local auto ID)
- `client_event_id` (UUID)
- `tenant_id`
- `outlet_id`
- `user_id`
- `event_type` (sale_created, payment_captured, etc.)
- `payload` (JSON)
- `created_at_local`
- `retry_count`
- `last_error`
- `status` (pending, syncing, failed)

### 2) PWA + Service Worker
Use Workbox or next-pwa.

Cache strategy:
- App shell/static assets: cache-first
- API GET for reference data: stale-while-revalidate
- API writes: never cache; route through outbox when offline

### 3) Offline UX
Add a global status indicator in dashboard layout:
- Online
- Offline
- Syncing
- Sync Error

Also show:
- pending outbox count
- last successful sync timestamp
- button to force sync

### 4) API Client Fallback
In `frontend/lib/api.ts`, detect offline (`navigator.onLine === false`) for write requests.

Behavior:
- enqueue event locally
- return optimistic local success object to UI
- do not drop user action

## Backend Implementation (Django/DRF)
### 1) Sync Endpoints
Add endpoints under `/api/v1/sync/`:
- `POST /push-batch/`
- `GET /pull-changes/?cursor=...`
- `GET /status/` (optional health + sync metadata)

### 2) Idempotency
Every event must include `client_event_id`.

Backend requirement:
- unique constraint on `(tenant_id, client_event_id)`
- duplicate replays return previous result (idempotent)

### 3) Change Feed / Cursor
Maintain append-only change log for syncable entities.

Each change record:
- `tenant_id`
- `outlet_id` (nullable if global to tenant)
- `entity_type`
- `entity_id`
- `operation` (create/update/delete)
- `server_timestamp`
- `cursor`

Client pulls deltas after `last_cursor`.

### 4) Validation and Security
- Enforce tenant/outlet from auth context, not client claims only
- Validate user permissions for each event
- Reject cross-tenant/outlet operations
- Log all sync requests for audit

## Conflict Handling Policy
### Transactional events (sales/payments)
- Prefer append-only
- Avoid updates to historical transactions
- If duplicate: idempotent accept

### Mutable records (customer/profile/price)
- Last-write-wins with server timestamp
- keep audit trail
- optionally flag high-risk conflicts for manual review

### Inventory-sensitive actions
- Accept movement events in order
- If order is invalid or stock negative by policy:
  - mark conflict
  - return explicit reason
  - require reconciliation flow

## Multi-Tenant Production Controls
- Partition local data by tenant and outlet in key design
- Clear local cache on logout and tenant switch
- Enforce short offline auth TTL (policy-based)
- Block offline usage when auth token is expired beyond grace window
- Encrypt sensitive local payloads if policy requires

## Observability and SRE
Track metrics:
- outbox queue depth
- sync success rate
- mean sync latency
- conflict rate by event type
- replay/duplicate rate

Add alerts:
- sustained sync failure > N minutes
- outbox growth beyond threshold
- conflict spikes

Log correlation IDs:
- include `client_event_id` in frontend logs and backend logs

## Testing Matrix (Must Pass Before Production)
### Functional
- Create sales offline and sync later
- Mixed online/offline transitions mid-shift
- Duplicate event replay safety

### Failure
- Network flapping
- Partial batch acceptance
- 401 token expiry during sync
- 429 throttle and retry backoff

### Data Integrity
- No cross-tenant leakage
- No duplicate transactions
- Totals/reports match after reconciliation

### Performance
- 10k cached products on low-end device
- offline checkout response time acceptable (<300ms target local actions)

## Rollout Plan
### Phase 0 (Preparation)
- Add feature flag: `offline_mode_enabled`
- Add telemetry and sync logs

### Phase 1 (Read-only offline)
- cache catalog, customers, settings
- offline browsing only

### Phase 2 (Offline transactional core)
- outbox for sales + payments
- push/pull sync with idempotency

### Phase 3 (Inventory + shift)
- add stock and shift events
- conflict dashboard for admins

### Phase 4 (Hardening)
- chaos testing
- playbooks and training
- staged rollout by tenant cohort

## Go-Live Checklist
- [ ] Sync endpoints deployed and load-tested
- [ ] Idempotency constraint verified in production DB
- [ ] Outbox retry/backoff implemented
- [ ] Conflict UI and operator SOP documented
- [ ] Tenant isolation tests passed
- [ ] Monitoring dashboards and alerts active
- [ ] Rollback plan documented
- [ ] Pilot tenant sign-off completed

## Recommended Initial File Targets in This Repo
Frontend:
- `frontend/lib/api.ts`
- `frontend/components/layouts/dashboard-layout.tsx`
- `frontend/lib/services/` (add sync service)
- `frontend/stores/` (offline/sync state store)

Backend:
- `backend/apps/` (new sync app or module)
- DRF views/serializers for `sync/push-batch` and `sync/pull-changes`
- model for processed client events and change log

## Definition of Done (Production Readiness)
Offline mode is production-ready when:
- Cashier can complete core sale/payment flow without internet
- Reconnect sync is idempotent and auditable
- Conflicts are explicit and recoverable
- Tenant isolation is enforced online and offline
- Operational monitoring can detect and triage sync issues quickly
