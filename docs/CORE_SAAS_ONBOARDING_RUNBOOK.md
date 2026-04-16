# PrimePOS Core SaaS Onboarding Runbook

Date: 2026-04-12
Scope: Core modules only, excluding Distribution and Storefront

## 1. Executive Decision

Status: Ready for controlled onboarding now.

Recommended go-live mode:
- Pilot onboarding for first paying tenants on core modules.
- Keep Distribution disabled.
- Keep Storefront disabled.

Why this is a GO for core modules:
- Frontend production build is passing.
- Tenant onboarding flow exists in product onboarding.
- Tenant-aware access controls and module gating are present.
- Printer setup, cloud connector pairing, and print queue flows are implemented.

Operational caveat:
- Treat this as controlled production rollout, not mass-scale onboarding, until your first wave is stable and monitored.

## 2. What Is In Scope For Onboarding

Enable these modules for each tenant/outlet:
- POS
- Sales
- Inventory
- Office
- Settings

Disable these modules for each tenant/outlet:
- has_distribution = false
- allow_storefront = false

## 3. Database Capacity Recommendation (GB)

Use PostgreSQL.

Starting recommendation:
- Minimum for live onboarding: 20 GB
- Safer production baseline: 50 GB
- Growth-ready baseline: 100 GB

Practical sizing by tenant count:
- Up to 25 active tenants: 20 to 30 GB
- 25 to 100 active tenants: 50 GB
- 100 to 300 active tenants: 100 GB
- 300+ active tenants: 200 GB and storage auto-scale policy

Storage budget split guideline:
- 40 percent transactional data (sales, payments, inventory movements)
- 30 percent receipts and print payload history
- 20 percent indexes and bloat headroom
- 10 percent safety margin

Retention advice:
- Keep print job logs for 90 days hot, then archive.
- Keep detailed audit logs for at least 180 days.

## 4. Production Setup Order

1. Provision infrastructure
- Backend on Render
- Frontend on Vercel
- Managed PostgreSQL with daily backups and point-in-time recovery

2. Set production environment
- Ensure production env validation is satisfied before first traffic.
- Confirm health endpoints respond successfully.

3. Create platform admin
- Use backend admin creation script for first SaaS admin account.

4. Verify auth and tenant isolation
- Login as tenant A and tenant B and confirm no cross-tenant visibility.

5. Enable only core modules per tenant/outlet
- Keep Distribution and Storefront disabled.

6. Complete printer setup per outlet
- Pair connector, assign default printer, run test print.

7. Execute onboarding smoke test
- Create product, sell item, print receipt, run end-of-day report.

## 5. Tenant Onboarding SOP (Per New Tenant)

Step A: Create tenant/business
- Use in-app onboarding setup business flow.
- Set business type and POS type.
- Confirm currency and tax defaults.

Step B: Create first outlet
- Set outlet details and business mode.
- Confirm outlet settings and module permissions.

Step C: Configure tenant permissions
- Core modules true: sales, pos, inventory, office, settings.
- Non-core modules false: has_distribution, allow_storefront.

Step D: Create staff and roles
- Create manager and cashier accounts.
- Assign least-privilege roles.

Step E: Seed master data
- Categories, products, units, taxes, opening stock.

Step F: Financial and document setup
- Receipt header and footer.
- Tax settings.
- Payment methods.

Step G: Printer setup per outlet
- Complete printer flow in settings.
- Save outlet default printer.
- Validate with test print.

Step H: Go-live signoff
- 5 successful sales in a row.
- 1 refund or void flow tested.
- End-of-day report matches expected totals.

## 6. Printer and Connector Setup (Per Outlet)

Goal: Reliable receipt printing for each outlet.

1. Open cloud printing setup in settings.
2. Click Connect.
3. Pair cloud connector using 6-digit pairing code if on cloud host.
4. Search printers for this outlet.
5. Select target printer.
6. Assign printer to this outlet as default.
7. Run test print.
8. Repeat for next outlet.

Channel guidance:
- Auto: recommended default.
- Agent only: fixed workstation deployments.
- Bluetooth USB Thermal Printer Plus: Android/mobile fallback.

Failure playbook:
- If connector not linked: re-run pairing claim for outlet.
- If printer not found: add manual printer identifier and re-scan.
- If test print fails: verify connector heartbeat and outlet assignment.

## 7. Core Go-Live Checklist

- Backend health endpoint returns healthy.
- Frontend build deployed and serving.
- Production env variables complete.
- Backup schedule configured and tested restore once.
- Tenant isolation test passed.
- Module gating confirmed for each tenant and outlet.
- Default printer assigned for every active outlet.
- Sales and receipt print tested.
- Alerts and logs monitored for first 72 hours.

## 8. First-Week Operating Plan

Day 0 to Day 2:
- Monitor auth failures, print failures, and queue backlogs every 2 hours.

Day 3 to Day 7:
- Review database growth trend daily.
- Tune indexes only if slow query signs appear.
- Keep onboarding to controlled batch size.

## 9. Scale Triggers

Upgrade database tier when any two happen:
- Storage usage above 65 percent.
- CPU above 70 percent sustained during peak.
- Query latency p95 above 200 ms on core sales endpoints.
- Print job queue delay above 30 seconds at peak.

## 10. Final Recommendation

You can onboard now for core operations if you keep Distribution and Storefront disabled, start with a controlled tenant batch, and launch with at least 20 GB database storage, preferably 50 GB for safer headroom.
