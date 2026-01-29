# PrimePOS: Module Risk & Refactor Strategy Analysis
**Date**: January 25, 2026  
**Status Level**: 80% Complete MVP  
**Analysis Type**: Pre-Production Dependency & Risk Assessment

---

## Executive Summary

After auditing the system architecture, dependency graph, and data flows, **INVENTORY** is the single highest-risk module that must be refactored FIRST. It is the foundation upon which SALES, REPORTS, SHIFTS, and CUSTOMERS depend. Stabilizing INVENTORY eliminates cascading failures in every other revenue-critical system.

**If you refactor SALES first without fixing INVENTORY, you risk:**
- Silent stock corruption (balances diverge from reality)
- Unauditable stock movements
- Cascading failures in reports (garbage in → garbage out)
- Recursive issues forcing you to re-refactor multiple times

---

## Module Risk Ranking

### 🔴 CRITICAL RISK (Must Stabilize First)

#### **1. INVENTORY** — Risk Score: 9.5/10
**Impact Radius**: SALES, SHIFTS, CUSTOMERS, REPORTS (all depend on it)

| Criterion | Details |
|-----------|---------|
| **Data Coupling** | ✅ HIGH: 15+ foreign references (Sales, StockMovement, Batch, LocationStock, Shifts) |
| **Business Criticality** | ✅ CRITICAL: All revenue/analytics depend on correct stock counts |
| **Performance Sensitivity** | ✅ HOT PATH: Every sale queries stock → batch → location_stock → product tables |
| **Data Integrity Impact** | ✅ IRREVERSIBLE: Wrong stock = wrong P&L, cascades to all reports |
| **Current Issues** | ❌ Multiple structural problems identified (see below) |

**Why INVENTORY is the foundation:**
```
User creates Sale
  └─ Calls deduct_stock(variation, outlet, quantity)
      ├─ Queries Batch (FIFO deduction)
      ├─ Updates Batch.quantity
      ├─ Creates StockMovement (immutable ledger)
      ├─ Updates LocationStock (summary cache)
      └─ Returns available_stock for validation

Later, Reports query:
  ├─ Sales → Items → Product → Stock (for P&L)
  ├─ StockMovement (for audit trail)
  ├─ LocationStock (for reorder alerts)
  └─ Batch (for FEFO/expiry handling)
```

**Critical Issues Found:**
1. **Dual source of truth**: Both `LocationStock` and `Batch` track quantities
   - Can diverge if logic is applied inconsistently
   - Audit trail (StockMovement) may not reconcile with either
2. **FIFO deduction logic**: In `deduct_stock()` but inventory adjustment UI may not use it consistently
3. **Expired batch handling**: `mark_expired_batches()` called manually, not on every query
4. **No stock snapshot at sale time**: Can't audit "what was available when sale was created"
5. **Batch number collisions**: Multiple sources generate batch numbers (sale, manual movement, import)

---

### 🟠 HIGH RISK (Stabilize After INVENTORY)

#### **2. SALES** — Risk Score: 8.0/10
**Impact Radius**: SHIFTS, CUSTOMERS, REPORTS (depend on it)

| Criterion | Details |
|-----------|---------|
| **Data Coupling** | ✅ HIGH: Depends on Inventory, links to Shifts, Customers, Discounts, Payments |
| **Business Criticality** | ✅ CRITICAL: Core revenue transaction |
| **Performance Sensitivity** | ✅ HOT PATH: POS checkout is user-facing latency-critical |
| **Data Integrity Impact** | ✅ IRREVERSIBLE: Wrong sale totals = financial disaster |
| **Current Issues** | ❌ Discounts UI-only, Stock auto-deduction timing unclear |

**Why SALES depends on INVENTORY:**
- Cannot validate `SaleItem` quantity without checking available stock
- Stock deduction must be atomic with Sale creation
- If INVENTORY is wrong, SALES calculations are meaningless

**Will be fixed during INVENTORY refactor** (through atomic transactions).

---

#### **3. SHIFTS & CASH MANAGEMENT** — Risk Score: 7.5/10
**Impact Radius**: REPORTS, CUSTOMERS (depend on shift context)

| Criterion | Details |
|-----------|---------|
| **Data Coupling** | ✅ HIGH: Connects to Sales, Till, User, outlets |
| **Business Criticality** | ✅ HIGH: Financial audit trail, reconciliation |
| **Performance Sensitivity** | ⚠️ MEDIUM: End-of-day report (not real-time) |
| **Data Integrity Impact** | ✅ IRREVERSIBLE: Wrong cash balance = audit failure |
| **Current Issues** | ⚠️ Status enum doesn't prevent multi-opening, no Z-Report generation |

**Why stable after INVENTORY:**
- Shifts summarize sales for reconciliation
- Must know SALES are atomic before trusting shift totals
- Petty cash tracking depends on Sale amounts being correct

---

### 🟡 MEDIUM RISK (Stabilize After SALES & SHIFTS)

#### **4. PRODUCTS & CATEGORIES** — Risk Score: 5.5/10
**Impact Radius**: SALES, INVENTORY, REPORTS

| Criterion | Details |
|-----------|---------|
| **Data Coupling** | ✅ MEDIUM: Referenced by Sales, Inventory, Variations |
| **Business Criticality** | ✅ HIGH: Product master data affects all transactions |
| **Performance Sensitivity** | ✅ HOT PATH: Barcode lookups in POS (real-time) |
| **Data Integrity Impact** | ⚠️ MODERATE: Wrong product = wrong pricing, but recalculation possible |
| **Current Issues** | ⚠️ Product-outlet relationship needs clarification, SKU uniqueness enforcement |

**Why after INVENTORY:**
- Products create stock availability questions
- Wait until inventory stock logic is stable, then lock down product identity

---

#### **5. CUSTOMERS & CREDIT** — Risk Score: 5.0/10
**Impact Radius**: SALES, REPORTS

| Criterion | Details |
|-----------|---------|
| **Data Coupling** | ✅ MEDIUM: Referenced by Sales, used in credit validation |
| **Business Criticality** | ✅ MEDIUM: Credit sales must be auditable |
| **Performance Sensitivity** | ⚠️ LOW: Credit lookup not on hot path |
| **Data Integrity Impact** | ⚠️ MODERATE: Incorrect balance = dispute, but reversible |
| **Current Issues** | ⚠️ Credit status transitions not enforced, balance calculation O(n) |

**Why after INVENTORY & SALES:**
- Credit sales depend on sale transactions being correct
- Customer balance calculations depend on sales being immutable
- Can optimize queries once sales audit is complete

---

#### **6. REPORTS** — Risk Score: 6.0/10
**Impact Radius**: NONE (reports depend on everything)

| Criterion | Details |
|-----------|---------|
| **Data Coupling** | ✅ VERY HIGH: Aggregates from Sales, Inventory, Customers, Shifts |
| **Business Criticality** | ✅ CRITICAL: Business decisions based on reports |
| **Performance Sensitivity** | ⚠️ MEDIUM: Bulk queries (not real-time) |
| **Data Integrity Impact** | ⚠️ LOW: Bad data exposes itself, doesn't corrupt source |
| **Current Issues** | ❌ Multiple empty implementations, outlet isolation missing |

**Why LAST (not first):**
- "Garbage in → garbage out"
- Cannot fix reports until SALES, INVENTORY, SHIFTS are stable
- Reports are diagnostic, not transactional
- Current issues are missing implementations, not corruption

---

### 🟢 LOW RISK (Can work in parallel after foundation)

#### **7. ACCOUNTS & TENANTS** — Risk Score: 2.0/10
**Impact Radius**: Everything (foundational, but stable)

| Criterion | Details |
|-----------|---------|
| **Data Coupling** | ✅ LOW: Foreign keys on every table, but rarely changes |
| **Business Criticality** | ✅ CRITICAL: Multi-tenant isolation |
| **Performance Sensitivity** | ✅ HOT PATH: Every request filters by tenant |
| **Data Integrity Impact** | ✅ IRREVERSIBLE: But impossible to get wrong (FK constraints) |
| **Current Issues** | ✅ NONE FOUND: Solid implementation |

**Why low risk:**
- Tenant isolation already enforced at DB level (FK constraints)
- No complex logic, pure identity tables
- Already working correctly in practice

---

#### **8. OUTLETS & TILLS** — Risk Score: 2.5/10
**Impact Radius**: All (but stable)

| Criterion | Details |
|-----------|---------|
| **Data Coupling** | ✅ LOW: Foreign keys used everywhere, but static |
| **Business Criticality** | ✅ HIGH: Outlet isolation critical |
| **Performance Sensitivity** | ✅ HOT PATH: Every transaction filtered by outlet |
| **Data Integrity Impact** | ✅ MODERATE: Outlet misconfiguration = data leakage |
| **Current Issues** | ✅ NONE FOUND: Working correctly |

**Why low risk:**
- Already enforced by permissions
- Outlet creation is infrequent admin task
- No complex interdependencies

---

#### **9. SUPPLIERS & QUOTATIONS** — Risk Score: 1.0/10
**Impact Radius**: NONE (internal tools)

| Criterion | Details |
|-----------|---------|
| **Data Coupling** | ✅ ISOLATED: No dependencies from critical path |
| **Business Criticality** | ⚠️ LOW: Not in revenue path |
| **Performance Sensitivity** | ⚠️ LOW: Infrequent admin operations |
| **Data Integrity Impact** | ✅ LOW: Isolated data, doesn't affect transactions |
| **Current Issues** | ⚠️ Minimal implementation |

**Can refactor anytime** (lowest risk, lowest impact).

---

#### **10. RESTAURANT FEATURES (Tables, KOT, KDS)** — Risk Score: 3.5/10
**Impact Radius**: SALES (depends on)

| Criterion | Details |
|-----------|---------|
| **Data Coupling** | ✅ MEDIUM: Tables referenced by Sales, KOT from Orders |
| **Business Criticality** | ⚠️ MEDIUM: Restaurant-specific, not all businesses use |
| **Performance Sensitivity** | ⚠️ MEDIUM: KDS real-time, but restaurant-only |
| **Data Integrity Impact** | ⚠️ MODERATE: Wrong KOT = food waste, but recoverable |
| **Current Issues** | ⚠️ KDS WebSocket not fully implemented |

**Why after SALES:**
- Table orders reference Sales
- Can wait until core POS is stable
- Restaurant-specific features won't affect retail/wholesale

---

#### **11. NOTIFICATIONS & ACTIVITY LOGS** — Risk Score: 0.5/10
**Impact Radius**: NONE (observability, not transactional)

| Criterion | Details |
|-----------|---------|
| **Data Coupling** | ✅ ZERO: Logging/observability tables |
| **Business Criticality** | ⚠️ LOW: Nice-to-have audit trail |
| **Performance Sensitivity** | ⚠️ LOW: Async writes |
| **Data Integrity Impact** | ✅ NONE: Logs don't affect transactions |
| **Current Issues** | ✅ NONE FOUND |

**Lowest priority** (can be added after system is stable).

---

## Recommended Starting Module: INVENTORY

### Why INVENTORY First?

**1. Breadth of Coupling**
```
INVENTORY is depended on by:
  ├─ SALES (stock validation, deduction)
  ├─ SHIFTS (stock at shift open/close)
  ├─ CUSTOMERS (order fulfillment)
  └─ REPORTS (P&L stock valuation, variance analysis)

If INVENTORY is wrong, ALL downstream modules are corrupted.
If SALES is wrong but INVENTORY is right, only SALES needs fixing.
```

**2. Data Integrity is Irreversible**
- Wrong stock count cascades to financial statements
- Can't "undo" a bad inventory count (P&L is already wrong)
- Reports based on wrong stock mislead business decisions
- Unlike a single bad sale (which can be refunded), bad stock affects EVERY future transaction

**3. Foundation for Atomic Transactions**
```
Current issue: Stock deduction timing unclear in Sales creation
Solution: Stabilize INVENTORY's deduction logic FIRST
Then: Wrap SALES + INVENTORY deduction in single @transaction.atomic
Result: Can't have sale without stock deduction, can't have stock without audit trail
```

**4. Performance Bottleneck**
- Every sale queries: Product → ItemVariation → Batch → LocationStock
- N+1 query problems will cascade if not fixed early
- Better to optimize INVENTORY queries once than 5x across all modules

---

## Justification: Why NOT Starting with SALES, REPORTS, or PAYMENTS

### ❌ Why NOT SALES First
**Problem**: Sales depends on INVENTORY being correct
```
If you refactor Sales to be atomic & perfect, but INVENTORY is broken:
├─ Sales will dutifully deduct broken stock
├─ Stock ledger will show reconciliation failures
├─ You'll think Sales is broken (it's not, INVENTORY is)
└─ You'll refactor Sales again unnecessarily
```
**Result**: Wasted effort, false fixes, technical debt.

---

### ❌ Why NOT REPORTS First
**Problem**: Reports are diagnostic, not transactional
```
Reports depend on:
├─ INVENTORY (stock counts are accurate)
├─ SALES (transaction totals are immutable)
├─ SHIFTS (reconciliation is locked)
└─ CUSTOMERS (credit limits enforced)

If any upstream module is wrong, reports WILL expose it.
But fixing reports won't fix the upstream problem.
```
**Result**: Visible symptoms, not root cause.

---

### ❌ Why NOT PAYMENTS First
**Problem**: Payments are only 60% implemented, low coupling
```
Payments today: Cash only (working)
Missing: Card/Mobile money (integrations)

This is a separate concern:
├─ Don't block inventory audit on payment processor APIs
├─ Payment integrations are orthogonal to transaction audit
└─ Can be added after core transactions are solid
```
**Result**: Distraction from core issues.

---

## Safe Refactor Boundaries

### Read-Only Modules Until INVENTORY is Stabilized
These modules can be read, analyzed, but NOT changed until INVENTORY is complete:

| Module | Why | Impact if Changed |
|--------|-----|------------------|
| **SALES** | Depends on inventory deduction | Might refactor stock deduction twice |
| **SHIFTS** | Summarizes sales for reconciliation | Shift totals will be wrong if inventory is wrong |
| **CUSTOMERS** | Credit limit depends on sales totals | Credit limits will be meaningless if sales are corrupted |
| **REPORTS** | Aggregates from inventory | Reports will be garbage if source data is wrong |
| **RESTAURANT** | Table orders reference sales | KOT system will be unreliable if inventory is wrong |

### Modules Safe to Work on Simultaneously with INVENTORY Refactor

| Module | Why |
|--------|-----|
| **ACCOUNTS & TENANTS** | Pure identity, no dependencies, stable |
| **OUTLETS & TILLS** | Configuration tables, no business logic changes needed |
| **SUPPLIERS** | Isolated from critical path |
| **NOTIFICATIONS** | Observability layer, doesn't affect transactions |
| **QUOTATIONS** | Internal tool, can evolve independently |

---

## INVENTORY Refactor Scope (What Must be Fixed)

### Structural Issues to Resolve

**1. Reconcile Dual Source of Truth**
```python
# Current problem:
class LocationStock(models.Model):
    outlet = ForeignKey(Outlet)
    variation = ForeignKey(ItemVariation)
    quantity = IntegerField  # Summary cache

class Batch(models.Model):
    outlet = ForeignKey(Outlet)
    variation = ForeignKey(ItemVariation)
    quantity = IntegerField  # Per-batch
    expiry_date = DateField  # FIFO ordering

# Issue: LocationStock.quantity might not equal sum(Batch.quantity)
# Fix: Make Batch the source of truth, calculate LocationStock.quantity from batches
```

**2. Enforce Batch Number Uniqueness**
```python
# Current: Multiple places generate batch numbers
# - Sale deduction: "SALE-20260125-123"
# - Manual import: User-provided
# - Stock adjustment: Auto-generated

# Fix: Central BatchNumberGenerator service
#      Format: {outlet_id}-{business_type}-{date}-{sequence}
#      Guarantee uniqueness + audit trail
```

**3. Snapshot Stock at Transaction Time**
```python
# Add to SaleItem:
stock_available_at_sale = IntegerField  # Stock when sale was created
# Enables: "Why did we sell 100 units when stock was only 50?"
```

**4. Automatic Expiry Handling**
```python
# Current: mark_expired_batches() called manually
# Fix: Run on every stock query automatically
#      Don't let expired batches inflate available_stock
```

**5. Audit Trail Completeness**
```python
# Ensure StockMovement is immutable and complete:
# - Can't update after creation
# - Every batch change creates a movement
# - Movements sum to LocationStock.quantity
```

---

## Implementation Order (Within INVENTORY)

1. **Phase 1: Add foundation** (1 week)
   - Add stock snapshot fields to Sale/SaleItem
   - Create BatchNumberGenerator service
   - Add immutability constraints to StockMovement

2. **Phase 2: Refactor deduction logic** (1.5 weeks)
   - Rewrite `deduct_stock()` to use Batch as source of truth
   - Rewrite `add_stock()` for consistency
   - Update all callers (Sales, Manual Adjustments, Transfers)

3. **Phase 3: Data migration & validation** (1 week)
   - Reconcile existing Batches vs LocationStock
   - Create correction movements for discrepancies
   - Add data validation tests

4. **Phase 4: Audit reports** (1 week)
   - Build variance reports (LocationStock vs Batch)
   - Build expiry/FEFO audit
   - Create stock reconciliation dashboard

---

## Success Criteria: INVENTORY is Stable When...

- [ ] All stock movements are logged immutably
- [ ] `StockMovement.sum() == LocationStock.quantity` for every outlet+variation
- [ ] Expired batches don't inflate available stock
- [ ] Every sale has `stock_available_at_sale` recorded
- [ ] No circular logic between Batch and LocationStock
- [ ] Batch numbers are unique per outlet
- [ ] Stock variance reports reconcile daily
- [ ] Can audit "why did this stock count change" for any date

---

## Post-INVENTORY: Refactor Sequence

Once INVENTORY is locked down (Phase 4 complete):

1. **SALES** (2 weeks) - Make stock deduction atomic with sale creation
2. **SHIFTS** (1.5 weeks) - Lock shift totals, prevent reopening, generate Z-Reports
3. **CUSTOMERS** (1 week) - Enforce credit limits, lock old invoices
4. **REPORTS** (2 weeks) - Rebuild all reports on stable foundation
5. **RESTAURANT** (1.5 weeks) - Integrate KOT with stable sales
6. **PAYMENTS** (2 weeks) - Add card/mobile money integrations
7. **POLISH** (remaining) - Performance optimization, frontend UX

---

## Risk Mitigation: If You Ignore This Advice

**If you refactor SALES without fixing INVENTORY first:**
- Sales will be perfect, but using corrupted stock data
- You'll spend weeks debugging "why do reports disagree with sales?"
- You'll discover the problem is INVENTORY, not SALES
- You'll refactor INVENTORY, then have to refactor SALES again
- **Total cost: 3-4x the effort of doing it right the first time**

**If you try to refactor REPORTS or PAYMENTS first:**
- You'll complete them, but they'll be based on shaky foundations
- When INVENTORY is finally fixed, reports will change unexpectedly
- You'll lose confidence in the system
- Users won't trust the data

---

## Conclusion

**Start with INVENTORY. Stabilize it completely. Then build SALES on top of it.**

This is the only safe path to a production system you can trust.

---

**Next Steps:**
1. Review this analysis with team
2. Create INVENTORY refactor project board (Phase 1-4)
3. Allocate developer to INVENTORY (full-time, 4 weeks)
4. Freeze SALES, SHIFTS, REPORTS changes (read-only mode)
5. After INVENTORY Phase 4, unfreeze and start SALES refactor
