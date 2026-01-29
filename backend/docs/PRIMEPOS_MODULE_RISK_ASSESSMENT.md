# PrimePOS Module Risk Assessment & Refactor Strategy

This document identifies the highest-risk module to audit/refactor first to minimize contradictions, regressions, and performance risk. It ranks modules, recommends a starting point, and outlines safe boundaries for refactoring.

---

## Module Risk Ranking

| Priority | Module | Risk Level | Coupling Score | Data Integrity Impact | Performance Sensitivity | Justification |
|----------|--------|------------|----------------|------------------------|--------------------------|---------------|
| 1 | Inventory | CRITICAL | 9/10 | CATASTROPHIC | HIGH | Single source of truth for stock; affects sales, purchases, reports, and consistency across system |
| 2 | Sales | CRITICAL | 8/10 | CATASTROPHIC | VERY HIGH | Core transaction module with atomic operations; calls inventory; affects shifts, reports, customers, restaurant |
| 3 | Products | HIGH | 7/10 | SEVERE | MEDIUM | Central data; referenced by sales, inventory, quotations, bar, restaurant; variations add complexity |
| 4 | Tenants + Outlets | HIGH | 9/10 | CATASTROPHIC | LOW | Root of multi-tenant isolation; a bug can cause data exposure across tenants/modules |
| 5 | Shifts | MEDIUM | 6/10 | HIGH | LOW | Cash reconciliation; impacts sales integrity |
| 6 | Customers | MEDIUM | 5/10 | MEDIUM | LOW | Credit tracking; affects sales and reports |
| 7 | Restaurant | MEDIUM | 6/10 | MEDIUM | MEDIUM | Extends Sales with tables/KOT; complex state |
| 8 | Bar | MEDIUM | 6/10 | MEDIUM | MEDIUM | Tab-based sales; separate flow |
| 9 | Suppliers | LOW | 4/10 | MEDIUM | LOW | Purchase orders; affects inventory; partial implementation |
| 10 | Reports | LOW | 5/10 | LOW | HIGH | Read-only aggregation; depends on sales/inventory but doesn't modify |
| 11 | Staff + Accounts | LOW | 5/10 | MEDIUM | LOW | Authentication/roles; stable pattern |
| 12 | Notifications | LOW | 2/10 | LOW | LOW | Event-driven; loose coupling |

---

## Recommended Starting Module: Inventory

Start with Inventory to stabilize the single source of truth for stock, enforce batch/expiry logic, and ensure performance in hot paths.

- Single source of truth: batches (`Batch`), location stocks (`LocationStock`), and immutable stock movements (`StockMovement`).
- Sales depend on inventory calls (`get_available_stock`, `deduct_stock`, `add_stock`); fixing inventory first prevents cascading contradictions.
- Batch expiry and FEFO (First Expiry First Out) must be enforced consistently.

Why not Sales first?
- Sales depends on Inventory correctness; refactoring Sales first risks double-work and contradictions until Inventory APIs are stable.

Why not Products first?
- Products mostly hold data; Inventory’s algorithms (batches, expiry, FEFO) are more complex and impact correctness/performance broadly.

Why not Tenants first?
- Multi-tenant isolation is structurally sound; Inventory carries more risk due to algorithmic complexity and dual stock state.

---

## Safe Refactor Boundaries

Treat the following modules as read-only until Inventory is stabilized:

- Absolute no-touch:
  - Products – Inventory queries `ItemVariation.batches`; changing Product/Variation structure invalidates Inventory logic.
  - Outlets – Inventory uses per-outlet stock; changing schema breaks `LocationStock` relationships.
  - Tenants – Foundational `tenant` FK exists on all models.

- Conditional read-only:
  - Sales – Calls Inventory deduction; changing now creates contradictions.
  - StockMovement – Immutable audit ledger; keep consistent while stabilizing logic.
  - Shifts – Ties sales to cash reconciliation; avoid cross-module regressions.

- Safe to change:
  - Customers – Reads sales; no inventory writes.
  - Reports – Aggregates only; no writes.
  - Notifications – Decoupled events.
  - Staff/Accounts – No inventory coupling.

---

## Key Contradictions to Resolve in Inventory First

1. Dual stock state:
   - Legacy `Product.stock` vs new `Batch.quantity` and `LocationStock`.
   - Ensure all reads/writes use batch/location APIs; deprecate direct `Product.stock` mutations.

2. Batch expiry enforcement:
   - Guarantee `is_expired()` exclusion in all stock calculations and deductions.

3. StockMovement consistency:
   - Every stock change must record a movement with a `reference_id` to ensure auditability and idempotency.

4. FEFO correctness:
   - Deduction must consume the earliest-expiring non-expired batches first, with transactional safety.

---

## Recommended Refactor Sequence

Phase 1: Inventory Stabilization
- Audit inventory reads/writes; consolidate via `get_available_stock`, `deduct_stock`, `add_stock`.
- Enforce batch expiry in all queries.
- Validate FEFO logic; add unit tests for multi-batch scenarios and edge cases.
- Migration: backfill from batches to replace `Product.stock`; mark deprecated.

Phase 2: Sales Integration
- Refactor Sales to exclusively use stable Inventory APIs in atomic transactions.
- Remove any direct product stock manipulations.
- Add robust insufficient-stock error handling.

Phase 3: Products Cleanup
- Deprecate `Product.stock`; enforce variation-based sales.
- Ensure `get_total_stock()` only uses batch-aware calculations.

Phase 4: Cascade to Other Modules
- Restaurant/Bar – Verify Sales → Inventory flow.
- Suppliers – Ensure purchases add stock to batches/location.
- Reports – Aggregate from movements/batches, not legacy fields.

---

## Performance Risks & Optimizations

- Minimize N+1 in `get_available_stock` using batched queries/aggregation.
- Cache non-expired batch sets per outlet; invalidate on purchase/stock updates.
- Partition or archive `StockMovement` for scalability.

---

## Data Integrity Safeguards

- Use `@transaction.atomic` for multi-step stock changes.
- Apply `select_for_update` on batch rows during deductions to prevent race conditions.
- Ensure idempotency via `reference_id` checks on movements.
- Snapshot/backup critical tables before structural changes.

---

## Success Criteria Before Leaving Inventory

- All stock reads route through inventory helpers (no direct `Product.stock`).
- All stock writes use `deduct_stock`/`add_stock` with movement records.
- Expired batches excluded from availability.
- FEFO validated by tests.
- Concurrency-safe with `select_for_update` and atomic transactions.
- Performance acceptable under realistic sale concurrency.

---

## Why This Minimizes Risk

- Fixes the foundation (Inventory) first to prevent silent corruption and double refactors.
- Stabilizes the hottest path used by Sales, Restaurant, and Bar flows.
- Establishes clear API boundaries for downstream modules.

