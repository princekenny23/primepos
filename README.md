# PrimePOS - Professional SaaS Multi-Tenant POS System

Maturity Level: Production Ready (MVP+)  
Version: 1.2.0  
Last Updated: April 29, 2026  
Target Users: Retail stores, restaurants, bars, wholesale businesses (Africa/Global)  
Deployment: Render (Backend) + Vercel (Frontend)

## Project Overview
PrimePOS is a full-stack, multi-tenant SaaS POS platform for small and medium businesses. It supports retail, restaurant, bar, and wholesale operations from one codebase with tenant isolation, outlet-aware operations, and role-based access control.

## Current System Status (April 2026)
- Multi-tenant architecture is active and enforced across API requests.
- Core POS flows are stable for cash and credit/tab sales.
- Inventory remains outlet-scoped with movement tracking and stock controls.
- Reporting stack is operational with outlet-based filtering by default.
- Offline rollout foundation is implemented (feature-flag controlled, disabled by default).
- Production deployment structure is ready (Render backend + Vercel frontend).

## Recent Progress (April 2026)
- Reports optimization:
  - Added pagination for report endpoints (default page_size: 10).
  - Removed N+1 query pattern from product performance report.
  - Added composite DB indexes for report-heavy sale filters.
- Performance and reliability:
  - Added tenant lookup caching in middleware.
  - Reduced repeated localStorage JSON parsing in frontend API client.
  - Optimized business store persistence to avoid persisting large outlet/till arrays.
- UX/operational improvements:
  - Profit & Loss page data loader stabilized with memoized callback.
  - Report settings modal changed to conditional mount.
  - Non-blocking receipt printing behavior improved in bar POS flow.
  - Local print health endpoint now responds gracefully when agent is unreachable.
- Dashboard/report defaults:
  - Date range defaults aligned to today for key dashboard flows.

## Key Capabilities
- Multi-tenant SaaS isolation per tenant/business.
- Multi-outlet support with outlet-level business type behavior.
- POS checkout for retail/restaurant/bar contexts.
- Inventory management with stock movement and stock take support.
- Customer management and credit tracking.
- Shift and cash reconciliation workflows.
- Reporting and exports (sales, product, customer, P&L, inventory valuation, etc.).
- Role-based access with permission-driven screens and APIs.

## Offline Mode Rollout Status
Implemented (disabled by default unless enabled via environment flags):
- Phase 0: feature flags and offline status plumbing.
- Phase 1: service worker registration and read cache skeleton.
- Phase 2 foundation: outbox queue and backend sync scaffolding.

Offline docs:
- docs/OFFLINE_MODE_README.md

Enable when ready:
- Frontend:
  - NEXT_PUBLIC_OFFLINE_MODE_ENABLED=true
  - NEXT_PUBLIC_OFFLINE_MODE_PHASE=1
- Backend:
  - OFFLINE_MODE_ENABLED=true
  - OFFLINE_MODE_PHASE=1

Phase values:
- 0: disabled (default)
- 1: read-only offline foundation
- 2+: transactional sync rollout

## Tech Stack

### Backend
- Django + Django REST Framework
- PostgreSQL (production)
- JWT auth (djangorestframework-simplejwt)
- Pandas/OpenPyXL for export/report processing

### Frontend
- Next.js 14 (React 18)
- TypeScript
- Tailwind CSS + Radix UI
- Zustand for state management
- Recharts for dashboards/reports

## Architecture (High-Level)
- Frontend (Next.js) calls REST APIs.
- Backend (Django/DRF) enforces auth, tenant context, permissions, and business logic.
- PostgreSQL stores tenant-isolated data with outlet-level operations.

Request path:
1. Request enters middleware.
2. Tenant context is resolved.
3. Permission checks are applied.
4. View/service logic executes.
5. Query is tenant-filtered.
6. Serialized response is returned.

## Production Readiness Snapshot
- Health endpoints available.
- Startup/env validation in place.
- Tenant middleware active.
- JWT auth and refresh in place.
- CORS configured.
- Logging and activity tracking active.
- Deployment configs present for backend/frontend.

## Known Gaps (Active Roadmap)
High priority:
- Card/mobile money payment integrations.
- Receipt PDF/printing hardening and expansion.
- Broader backend RBAC enforcement audit.
- Centralized exception format standardization.

Medium priority:
- Celery/Redis async workload expansion.
- Email notifications and invoicing workflows.
- Expanded analytics.
- Barcode scanner integration improvements.

## Development Quick Start

### Backend
1. cd backend
2. python -m venv env
3. Activate virtual environment
4. pip install -r requirements.txt
5. Configure .env
6. python manage.py migrate
7. python manage.py runserver

### Frontend
1. cd frontend
2. npm install
3. Configure .env.local
4. npm run dev

## API Notes
- Base API path: /api/v1
- Authentication: Bearer JWT
- Tenant context is resolved server-side and reinforced by request headers where required.
- Most report flows are outlet-scoped and now support pagination controls.

## Documentation
- System user training guide:
  - docs/SYSTEM_USER_GUIDE_AND_TRAINING_PLAYBOOK.md
- Offline rollout/testing guide:
  - docs/OFFLINE_MODE_README.md
- Additional implementation/deployment docs:
  - docs/

## Recommended Next Operator Steps
1. Run backend migrations in each target environment.
2. Validate report pagination and dashboard date presets with production-like data.
3. Confirm payment/receipt roadmap priorities for next sprint.
4. Keep this README updated at each release boundary.

Maintained By: PrimePOS Development Team
