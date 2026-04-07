# Deployment Runbook

## Environments
- Local Development
- Staging
- Production

## Typical Stack
- Frontend deploy: Vercel or Node host
- Backend deploy: Render/Docker or equivalent
- Database: managed Postgres

## Pre-Deployment Checklist
- [ ] Tests pass (backend and frontend)
- [ ] Migrations reviewed
- [ ] Environment variables confirmed
- [ ] Release notes drafted
- [ ] Rollback plan ready

## Backend Deployment Steps
1. Pull latest code.
2. Install dependencies.
3. Run migrations.
4. Restart backend service.
5. Validate health and auth endpoints.

## Frontend Deployment Steps
1. Pull latest code.
2. Install dependencies.
3. Build app.
4. Deploy and verify storefront and dashboard routes.

## Post-Deployment Validation
- Login works
- POS sale flow works
- Inventory update works
- Storefront product list loads
- Storefront create-order works
- Dashboard orders reflects new storefront orders

## Rollback Strategy
- Keep previous stable backend image/build.
- Rollback frontend deployment if critical UI regression.
- Re-run smoke tests after rollback.

## Incident Escalation
- Critical production outage -> immediate incident channel + owner assignment
- Capture timeline, impact, root cause, and fix in incident log
