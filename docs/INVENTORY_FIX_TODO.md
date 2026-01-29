# Inventory System - TODO List

**Created**: January 26, 2026  
**Priority**: CRITICAL - Start Immediately  
**Estimated Timeline**: 5 weeks  
**Reference**: See [INVENTORY_IMPLEMENTATION_GUIDE.md](INVENTORY_IMPLEMENTATION_GUIDE.md)

---

## 📋 WEEK 1: Code Cleanup & Validation

### ✅ Day 1-2: Setup & Verification

- [ ] **Review implementation guide with team**
  - [ ] Read [INVENTORY_IMPLEMENTATION_GUIDE.md](INVENTORY_IMPLEMENTATION_GUIDE.md)
  - [ ] Read [IMPLEMENTATION_COMPLETE_SUMMARY.md](IMPLEMENTATION_COMPLETE_SUMMARY.md)
  - [ ] Assign tasks to developers
  - [ ] Set up project tracking board

- [ ] **Verify database models are migrated**
  ```bash
  python manage.py showmigrations inventory
  python manage.py showmigrations products
  ```
  - [ ] Confirm Batch model exists
  - [ ] Confirm StockMovement model exists
  - [ ] Confirm StockTake model exists
  - [ ] Confirm StockTakeItem model exists
  - [ ] Confirm LocationStock model exists

- [ ] **Test product image field is optional**
  - [ ] Create product without image via API → Success
  - [ ] Create product with image via API → Success
  - [ ] Update product without touching image → Success
  - [ ] Verify serializer returns null for missing images

### ✅ Day 3-4: FIFO Implementation

- [ ] **Create `stock_helpers.py` utility functions**
  - [ ] Implement `get_fifo_batches(variation, outlet)` function
    - [ ] Filter by variation and outlet
    - [ ] Exclude expired batches (expiry_date > today)
    - [ ] Exclude zero quantity batches
    - [ ] Order by expiry_date ASC, created_at ASC
  - [ ] Add docstrings and type hints
  - [ ] Write unit tests for `get_fifo_batches()`

- [ ] **Create atomic `deduct_stock()` function**
  - [ ] Add to `stock_helpers.py`
  - [ ] Use `@transaction.atomic` decorator
  - [ ] Call `get_fifo_batches()` to get ordered batches
  - [ ] Loop through batches and deduct FIFO
  - [ ] Create StockMovement record for each deduction
  - [ ] Raise `InsufficientStockError` if not enough stock
  - [ ] Return list of deductions made
  - [ ] Write unit tests for `deduct_stock()`

- [ ] **Test FIFO logic with sample data**
  - [ ] Create 3+ batches with different expiry dates
  - [ ] Deduct quantity that spans multiple batches
  - [ ] Verify oldest expiry deducted first
  - [ ] Verify StockMovement records created
  - [ ] Verify Batch quantities updated correctly

### ✅ Day 5: Testing & Documentation

- [ ] **Write unit tests**
  - [ ] Test `get_fifo_batches()` with expired batches
  - [ ] Test `get_fifo_batches()` with zero quantity
  - [ ] Test `deduct_stock()` with sufficient stock
  - [ ] Test `deduct_stock()` with insufficient stock
  - [ ] Test `deduct_stock()` creates StockMovement
  - [ ] Test atomic rollback on error

- [ ] **Code review**
  - [ ] Review FIFO logic with team
  - [ ] Verify no breaking changes
  - [ ] Update docstrings
  - [ ] Commit to version control

---

## 📋 WEEK 2: Perpetual Inventory Enforcement

### ✅ Day 1-2: Replace Stock Deduction Points

- [ ] **Audit all stock deduction locations**
  - [ ] Find all places where `product.stock -= X`
  - [ ] Find all places where `batch.quantity -= X`
  - [ ] Find all places where `LocationStock.quantity -= X`
  - [ ] Document current deduction logic

- [ ] **Replace sales stock deduction**
  - [ ] Locate sale creation view/serializer
  - [ ] Replace stock deduction with `deduct_stock()` call
  - [ ] Ensure user is passed to StockMovement
  - [ ] Add reference_id (sale ID) to movement
  - [ ] Test: Create sale → Stock deducted atomically
  - [ ] Test: Sale fails → Stock not deducted (rollback)

- [ ] **Replace adjustment stock deduction**
  - [ ] Locate inventory adjustment endpoint
  - [ ] Use `deduct_stock()` for negative adjustments
  - [ ] Create direct Batch increase for positive adjustments
  - [ ] Always create StockMovement record
  - [ ] Test: Manual adjustment creates movement

- [ ] **Handle damage/spoilage/expiry**
  - [ ] Create damage endpoint (uses `deduct_stock()`)
  - [ ] Create expiry handler (auto-deduct expired batches)
  - [ ] Test: Expired batch auto-removed from sellable stock

### ✅ Day 3-4: Stock Reconciliation

- [ ] **Create reconciliation utility**
  - [ ] Add `reconcile_stock(variation, outlet)` function
  - [ ] Calculate: Sum of Batch.quantity for variation/outlet
  - [ ] Calculate: LocationStock.quantity for same
  - [ ] Compare values and return variance
  - [ ] Log mismatches for investigation

- [ ] **Create reconciliation report**
  - [ ] Add API endpoint `/api/v1/inventory/reconciliation/`
  - [ ] Show variations with variances
  - [ ] Flag high-variance items (>5%)
  - [ ] Export to CSV/PDF
  - [ ] Test: Reconciliation identifies discrepancies

- [ ] **Add automated reconciliation check**
  - [ ] Create management command `reconcile_inventory`
  - [ ] Schedule daily via cron/Celery
  - [ ] Email alerts for variances >10%
  - [ ] Log results to database

### ✅ Day 5: Performance Optimization

- [ ] **Add database indexes**
  - [ ] Verify indexes on `inventory_batch`
    - [ ] (tenant)
    - [ ] (variation, outlet)
    - [ ] (expiry_date)
    - [ ] (variation, outlet, expiry_date)
  - [ ] Verify indexes on `inventory_stockmovement`
    - [ ] (tenant)
    - [ ] (variation)
    - [ ] (outlet)
    - [ ] (movement_type)
    - [ ] (created_at)
  - [ ] Run migrations if needed

- [ ] **Query optimization**
  - [ ] Use `select_related()` for batch queries
  - [ ] Use `prefetch_related()` for variation queries
  - [ ] Test query count (should be <5 per sale)
  - [ ] Benchmark deduction speed (<100ms target)

- [ ] **Integration testing**
  - [ ] Test: Complete sale flow (POS → stock deduction)
  - [ ] Test: Concurrent sales don't cause race condition
  - [ ] Test: Bulk operations (import 100+ products)
  - [ ] Test: Multi-outlet stock isolation

---

## 📋 WEEK 3: Physical Inventory Counts

### ✅ Day 1-2: StockTake API

- [ ] **Create StockTake serializers**
  - [ ] `StockTakeSerializer` (list, create, retrieve)
  - [ ] `StockTakeItemSerializer` (nested in StockTake)
  - [ ] Validate outlet belongs to tenant
  - [ ] Validate variation exists
  - [ ] Auto-calculate variance (counted - expected)

- [ ] **Create StockTake ViewSet**
  - [ ] `POST /api/v1/inventory/stock-takes/` - Create session
  - [ ] `GET /api/v1/inventory/stock-takes/` - List sessions
  - [ ] `GET /api/v1/inventory/stock-takes/{id}/` - Detail
  - [ ] `PATCH /api/v1/inventory/stock-takes/{id}/` - Update
  - [ ] Filter by outlet, status, date range
  - [ ] Pagination for large counts

- [ ] **Implement bulk item entry**
  - [ ] `POST /api/v1/inventory/stock-takes/{id}/items/bulk/`
  - [ ] Accept array of items: `[{variation_id, counted}]`
  - [ ] Get system quantity from Batch sum
  - [ ] Calculate variance automatically
  - [ ] Return variance summary

### ✅ Day 3-4: Reconciliation Workflow

- [ ] **Create reconciliation endpoint**
  - [ ] `POST /api/v1/inventory/stock-takes/{id}/reconcile/`
  - [ ] Validate status is 'completed'
  - [ ] Loop through items with variance != 0
  - [ ] For overage: Create positive adjustment movement
  - [ ] For shortage: Create negative adjustment movement
  - [ ] Update Batch quantities
  - [ ] Set status to 'reconciled'
  - [ ] Return adjustment count

- [ ] **Add variance reason tracking**
  - [ ] Add `variance_reason` field to StockTakeItem
  - [ ] Require reason for variances >10 units
  - [ ] Store in StockMovement.reason when reconciled
  - [ ] Test: Variance adjustment creates movement with reason

- [ ] **Create variance reports**
  - [ ] `GET /api/v1/inventory/stock-takes/{id}/variance-report/`
  - [ ] Show items with variance
  - [ ] Group by category
  - [ ] Calculate total loss/gain value
  - [ ] Export to PDF

### ✅ Day 5: Testing & Validation

- [ ] **End-to-end physical count test**
  - [ ] Create StockTake session
  - [ ] Add 10+ items with counts
  - [ ] Review variance report
  - [ ] Add variance reasons
  - [ ] Reconcile adjustments
  - [ ] Verify Batch quantities updated
  - [ ] Verify StockMovement records created
  - [ ] Verify LocationStock synced

- [ ] **Edge case testing**
  - [ ] Test: Count item not in system (add as new)
  - [ ] Test: System item not counted (zero variance)
  - [ ] Test: Large variance (>50%)
  - [ ] Test: Cancel incomplete count
  - [ ] Test: Multiple counts for same outlet

---

## 📋 WEEK 4: Frontend Implementation

### ✅ Day 1-2: Stock Dashboard

- [ ] **Create stock dashboard page**
  - [ ] Route: `/dashboard/inventory`
  - [ ] Show real-time stock by outlet
  - [ ] Filter by category, variation, outlet
  - [ ] Search by name, SKU, barcode

- [ ] **Display FIFO batch details**
  - [ ] Expandable variation → show batches
  - [ ] Show: batch_number, quantity, expiry, cost
  - [ ] Highlight expiring soon (<30 days)
  - [ ] Highlight low stock (< threshold)
  - [ ] Show total value (quantity × cost)

- [ ] **Add low stock alerts**
  - [ ] Badge showing count of low stock items
  - [ ] Alert banner for critical items (<10% threshold)
  - [ ] Email notifications for low stock
  - [ ] Suggested reorder quantities

- [ ] **Add expiry warnings**
  - [ ] Badge showing expiring soon count
  - [ ] List of batches expiring in 7/14/30 days
  - [ ] Highlight expired batches (red)
  - [ ] Suggest discounts/markdowns

### ✅ Day 3: Inventory Adjustment UI

- [ ] **Create adjustment form**
  - [ ] Route: `/dashboard/inventory/adjust`
  - [ ] Select variation and outlet
  - [ ] Show current stock quantity
  - [ ] Input: adjustment quantity (+/-)
  - [ ] Input: reason (required)
  - [ ] Input: reference (optional)

- [ ] **Implement adjustment types**
  - [ ] Manual correction (+/-)
  - [ ] Damage/spoilage (-)
  - [ ] Return to stock (+)
  - [ ] Other (with reason)

- [ ] **Show adjustment history**
  - [ ] List recent adjustments by outlet
  - [ ] Filter by date range, type, user
  - [ ] Export to CSV
  - [ ] Audit trail view

### ✅ Day 4-5: Physical Count UI

- [ ] **Create stock take page**
  - [ ] Route: `/dashboard/inventory/stock-take`
  - [ ] Button: Start New Count
  - [ ] List: Previous counts (status, date)
  - [ ] Filter by outlet, status

- [ ] **Build count entry interface**
  - [ ] Barcode scanner support
  - [ ] Autocomplete variation search
  - [ ] Show expected quantity
  - [ ] Input counted quantity
  - [ ] Auto-calculate variance
  - [ ] Color code: green (match), yellow (small), red (large)

- [ ] **Implement variance review**
  - [ ] Show items with variance only
  - [ ] Input variance reason (required for large)
  - [ ] Calculate total variance value
  - [ ] Button: Approve & Reconcile
  - [ ] Confirmation dialog before reconcile

- [ ] **Product image handling**
  - [ ] Show placeholder if image missing
  - [ ] Allow upload during product creation
  - [ ] Allow skip during product creation
  - [ ] Edit product without changing image

---

## 📋 WEEK 5: Monitoring & Production

### ✅ Day 1: System Health Monitoring

- [ ] **Set up daily reconciliation**
  - [ ] Create cron job: `python manage.py reconcile_inventory`
  - [ ] Run at 2 AM daily
  - [ ] Email summary to admin
  - [ ] Alert on variances >5%

- [ ] **Add expiry monitoring**
  - [ ] Create command: `python manage.py check_expiring_batches`
  - [ ] Run daily at 8 AM
  - [ ] Email list of expiring items
  - [ ] Suggest actions (discount, remove)

- [ ] **Movement ledger validation**
  - [ ] Create command: `python manage.py validate_movements`
  - [ ] Check: Every Batch change has movement
  - [ ] Check: Movement quantities sum correctly
  - [ ] Check: No orphaned movements
  - [ ] Run weekly

### ✅ Day 2: Performance Tuning

- [ ] **Database query analysis**
  - [ ] Enable Django Debug Toolbar
  - [ ] Profile stock dashboard queries
  - [ ] Profile sale creation queries
  - [ ] Identify N+1 queries
  - [ ] Add select_related/prefetch_related

- [ ] **Caching strategy**
  - [ ] Cache outlet stock summary (5 min TTL)
  - [ ] Cache category totals (10 min TTL)
  - [ ] Invalidate on stock movement
  - [ ] Test cache hit rate

- [ ] **Bulk operation optimization**
  - [ ] Use `bulk_create()` for batch import
  - [ ] Use `bulk_update()` for reconciliation
  - [ ] Test: Import 1000 products <30 seconds

### ✅ Day 3-4: Reporting Suite

- [ ] **Stock movement history report**
  - [ ] Filter by variation, date range, type
  - [ ] Show: date, type, quantity, user, reason
  - [ ] Export to CSV/Excel
  - [ ] Chart: Movements over time

- [ ] **Outlet reconciliation report**
  - [ ] Compare system vs. physical counts
  - [ ] Show variance by category
  - [ ] Calculate accuracy percentage
  - [ ] Trend: Accuracy over time

- [ ] **Expiry tracking report**
  - [ ] List batches by expiry date
  - [ ] Group by: expired, <7 days, <30 days
  - [ ] Show waste value (expired × cost)
  - [ ] Suggest reorder patterns

- [ ] **Cost of goods sold (COGS) report**
  - [ ] Calculate by FIFO (batch cost)
  - [ ] Group by category, outlet, date
  - [ ] Compare to revenue
  - [ ] Gross margin analysis

### ✅ Day 5: Documentation & Training

- [ ] **Create staff SOPs**
  - [ ] How to conduct physical count
  - [ ] How to handle stock adjustments
  - [ ] How to investigate variances
  - [ ] How to read reports

- [ ] **Create admin documentation**
  - [ ] System architecture overview
  - [ ] Database schema
  - [ ] API documentation
  - [ ] Troubleshooting guide

- [ ] **Staff training session**
  - [ ] Demo: Stock dashboard
  - [ ] Demo: Physical count workflow
  - [ ] Demo: Stock adjustment
  - [ ] Q&A and feedback

- [ ] **Create API documentation**
  - [ ] Document all endpoints
  - [ ] Include request/response examples
  - [ ] Authentication requirements
  - [ ] Rate limits

---

## 📋 FINAL CHECKLIST: Pre-Production

### ✅ Code Quality

- [ ] All unit tests passing (>90% coverage)
- [ ] All integration tests passing
- [ ] No linting errors (flake8, pylint)
- [ ] Type hints added (mypy validation)
- [ ] Docstrings complete
- [ ] Code reviewed by 2+ developers

### ✅ Data Integrity

- [ ] Batch is single source of truth
- [ ] All stock changes create StockMovement
- [ ] FIFO deduction verified
- [ ] Expiry exclusion working
- [ ] Reconciliation report accurate
- [ ] No orphaned records

### ✅ Performance

- [ ] Stock deduction <100ms
- [ ] Dashboard load <2 seconds
- [ ] Physical count entry <1 second per item
- [ ] Reconciliation <5 seconds
- [ ] Database indexes optimized
- [ ] Query count minimized

### ✅ Security

- [ ] Tenant isolation enforced
- [ ] Outlet permissions working
- [ ] API authentication required
- [ ] User audit trail complete
- [ ] No SQL injection vulnerabilities
- [ ] No sensitive data in logs

### ✅ Documentation

- [ ] Implementation guide complete
- [ ] API documentation published
- [ ] Staff SOPs created
- [ ] Admin guide written
- [ ] Migration guide prepared
- [ ] Rollback plan documented

### ✅ Deployment

- [ ] Database migrations tested
- [ ] Backup strategy in place
- [ ] Rollback tested
- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] Staff trained

---

## 🚨 Critical Success Metrics

After deployment, verify these metrics weekly:

| Metric | Target | Status |
|--------|--------|--------|
| Stock accuracy | 99.5%+ | ⏳ |
| System availability | 99.9%+ | ⏳ |
| Deduction speed | <100ms | ⏳ |
| Audit trail completeness | 100% | ⏳ |
| Expired sales | 0 | ⏳ |
| Reconciliation variance | <1% | ⏳ |
| Staff count efficiency | <15 min/100 items | ⏳ |

---

## 📞 Support & Escalation

**Questions?** Reference sections in implementation guide:
- Stock logic → [Part 2: Perpetual Inventory](INVENTORY_IMPLEMENTATION_GUIDE.md#part-2-perpetual-inventory-system-architecture)
- API design → [Part 6: Technical Specifications](INVENTORY_IMPLEMENTATION_GUIDE.md#part-6-technical-specifications)
- Frontend → [Part 5: Phase 4](INVENTORY_IMPLEMENTATION_GUIDE.md#phase-4-frontend-integration-week-4)

**Issues?** 
1. Create GitHub issue with "inventory" label
2. Include: current behavior, expected behavior, severity
3. Tag relevant developer

**Blockers?**
- Escalate to tech lead immediately
- Do not proceed with dependent tasks
- Document blocker and workaround attempts

---

## 📊 Progress Tracking

**Week 1**: ⏳ 0/20 tasks completed  
**Week 2**: ⏳ 0/18 tasks completed  
**Week 3**: ⏳ 0/15 tasks completed  
**Week 4**: ⏳ 0/17 tasks completed  
**Week 5**: ⏳ 0/22 tasks completed  

**Total**: ⏳ 0/92 tasks completed (0%)

---

**Next Action**: Start Week 1, Day 1 - Review implementation guide with team

**Deadline**: February 28, 2026 (5 weeks from today)

**Owner**: Development Team  
**Last Updated**: January 26, 2026
