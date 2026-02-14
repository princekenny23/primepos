# PrimePOS – End-to-End SaaS POS Testing & Validation Guide

**Version:** 1.0  
**Date:** February 6, 2026  
**Environment:** Local / Staging / Production  

---

## 1. System Overview

### 1.1 High-Level Description
PrimePOS is a multi-tenant SaaS Point-of-Sale platform for retail, bar, and restaurant operations. It supports inventory, sales, customer credit (tabs), purchasing, reporting, and administrative management across multiple business tenants.

### 1.2 Tech Stack
- **Frontend:** Next.js (React, TypeScript)
- **Backend:** Django + Django REST Framework
- **Database:** PostgreSQL (multi-tenant tenant-scoped data)
- **Hosting:** Render (frontend + backend services)
- **Auth:** Session/JWT (as configured in backend)

### 1.3 Multi-Tenant Architecture
- Tenant is a top-level business boundary.
- All core entities (users, outlets, sales, inventory, customers, etc.) are tenant-scoped.
- API filters and querysets enforce tenant isolation.
- Data visibility across tenants is blocked unless `is_saas_admin`.

### 1.4 User Roles (Typical)
- **SaaS Admin:** Global platform admin (cross-tenant)
- **Tenant Admin:** Business-level admin
- **Manager:** Outlet-level manager
- **Cashier/Staff:** POS operations only

---

## 2. Test Data & Environment Setup

### 2.1 Required Fixtures
- Tenant A (Business Alpha)
- Tenant B (Business Beta)
- Outlets: 2 per tenant
- Tills: 1 per outlet
- Users: Admin, Manager, Cashier per tenant
- Products: 20 products, 3 categories, 5 with barcodes
- Customers: 10 customers, 3 credit-enabled

### 2.2 Preconditions
- Backend reachable
- Frontend reachable
- Admin access available
- Database migrations applied
- Email/SMS integrations disabled or sandboxed

---

## 3. Tenant Onboarding Test Cases

### TC-TEN-001: Create Tenant
- **Objective:** Verify tenant creation flow works.
- **Preconditions:** SaaS admin access.
- **Steps:**
  1. Login as SaaS admin.
  2. Create a tenant with valid business details.
  3. Save and verify tenant appears in list.
- **Expected Results:** Tenant created, unique identifier assigned.

### TC-TEN-002: Duplicate Tenant
- **Objective:** Verify duplicate tenant creation fails.
- **Preconditions:** Tenant with same identifier exists.
- **Steps:**
  1. Attempt to create tenant with duplicate slug/identifier.
- **Expected Results:** Validation error returned; no duplicate created.

### TC-TEN-003: Invalid Tenant Data
- **Objective:** Verify validation for invalid fields.
- **Steps:**
  1. Submit tenant creation without required fields.
- **Expected Results:** Errors displayed; tenant not created.

### TC-TEN-004: Default Settings Creation
- **Objective:** Ensure default tenant settings are created.
- **Steps:**
  1. Create tenant.
  2. Verify default settings exist (currency, timezone, etc.).
- **Expected Results:** Defaults present in admin and API.

### TC-TEN-005: Tenant Isolation
- **Objective:** Verify tenant data isolation.
- **Steps:**
  1. Login as Tenant A admin, create product.
  2. Login as Tenant B admin.
  3. Check products list.
- **Expected Results:** Tenant B cannot see Tenant A data.

---

## 4. Business Setup Test Cases

### TC-BIZ-001: Outlet Creation
- **Objective:** Create outlet tied to tenant.
- **Steps:**
  1. Login as tenant admin.
  2. Create outlet with address/phone.
- **Expected Results:** Outlet created and visible.

### TC-BIZ-002: Till Creation
- **Objective:** Create till for outlet.
- **Steps:**
  1. Navigate to tills.
  2. Create till linked to outlet.
- **Expected Results:** Till created and selectable in POS.

### TC-BIZ-003: Staff User Creation
- **Objective:** Create staff with correct permissions.
- **Steps:**
  1. Create user with cashier role.
- **Expected Results:** User can login and access POS only.

---

## 5. Product & Inventory Test Cases

### TC-INV-001: Create Product
- **Objective:** Add product successfully.
- **Steps:**
  1. Inventory → Products → Add Product.
- **Expected Results:** Product appears in list.

### TC-INV-002: Category Assignment
- **Objective:** Ensure category assignment works.
- **Steps:**
  1. Create product with category.
- **Expected Results:** Product filter by category works.

### TC-INV-003: Stock Adjustment
- **Objective:** Adjust stock levels.
- **Steps:**
  1. Inventory → Stock Control → Adjust.
- **Expected Results:** Stock updated in product detail.

### TC-INV-004: Stock Receiving
- **Objective:** Receive stock from supplier.
- **Steps:**
  1. Inventory → Stock Control → Receive.
- **Expected Results:** Stock increases appropriately.

---

## 6. Daily POS Usage Test Cases

### TC-POS-001: New Sale (Cash)
- **Objective:** Complete a cash sale.
- **Steps:**
  1. POS → Add items → Checkout.
  2. Select cash.
- **Expected Results:** Sale recorded, status paid.

### TC-POS-002: Card Sale
- **Objective:** Complete card sale.
- **Steps:**
  1. POS → Checkout → Card.
- **Expected Results:** Sale recorded.

### TC-POS-003: Tab Sale (Credit)
- **Objective:** Create credit/tab sale.
- **Steps:**
  1. POS → Checkout → Tab.
- **Expected Results:** Sale recorded with payment_status = unpaid.

### TC-POS-004: Partial Payment on Tab
- **Objective:** Validate partial payment updates status.
- **Steps:**
  1. Sales → Credits → Record payment less than total.
- **Expected Results:** payment_status = partially_paid, remaining updated.

### TC-POS-005: Full Payment on Tab
- **Objective:** Close credit sale fully.
- **Steps:**
  1. Record remaining amount.
- **Expected Results:** payment_status = paid, remaining 0.

---

## 7. Sales Management Test Cases

### TC-SALES-001: Transactions List
- **Objective:** Verify transactions list shows new sale.
- **Steps:**
  1. Sales → Transactions.
- **Expected Results:** Sale listed with correct totals.

### TC-SALES-002: Returns
- **Objective:** Create return.
- **Steps:**
  1. Sales → Returns → Create return.
- **Expected Results:** Return recorded; stock adjusted (if enabled).

### TC-SALES-003: Discounts
- **Objective:** Create discount and apply.
- **Steps:**
  1. Sales → Discounts → Create.
  2. Apply in POS.
- **Expected Results:** Total reduced correctly.

### TC-SALES-004: Quotations
- **Objective:** Create quotation and convert.
- **Steps:**
  1. Sales → Quotations → Create.
  2. Convert to sale.
- **Expected Results:** Sale created from quotation.

---

## 8. Customer Management & Credit

### TC-CUST-001: Create Customer
- **Objective:** Add new customer.
- **Steps:**
  1. Customer Management → Add.
- **Expected Results:** Customer listed.

### TC-CUST-002: Enable Credit
- **Objective:** Enable customer credit.
- **Steps:**
  1. Edit customer → enable credit.
- **Expected Results:** Credit limit and terms saved.

### TC-CUST-003: Credit Summary
- **Objective:** Validate outstanding balance.
- **Steps:**
  1. View customer summary.
- **Expected Results:** Outstanding reflects unpaid tab totals.

---

## 9. Accounting & Reports

### TC-REP-001: Daily Sales Report
- **Objective:** Validate report totals.
- **Steps:**
  1. Reports → Sales.
- **Expected Results:** Totals match transactions.

### TC-REP-002: Inventory Report
- **Objective:** Stock valuation accuracy.
- **Steps:**
  1. Reports → Inventory.
- **Expected Results:** Matches current stock.

### TC-REP-003: Export Reports
- **Objective:** Export to CSV/PDF.
- **Steps:**
  1. Export any report.
- **Expected Results:** File downloads, correct data.

---

## 10. Multi-Tenant Isolation

### TC-MULTI-001: Cross-Tenant Access
- **Objective:** Verify tenant isolation.
- **Steps:**
  1. Login to Tenant A. Create data.
  2. Login to Tenant B. Query data.
- **Expected Results:** Data not visible.

### TC-MULTI-002: SaaS Admin Visibility
- **Objective:** SaaS admin can view all tenants.
- **Steps:**
  1. Login as SaaS admin.
  2. Access tenant data.
- **Expected Results:** SaaS admin sees cross-tenant records.

---

## 11. Deployment Readiness

### TC-DEP-001: Health Check
- **Objective:** Confirm API and UI uptime.
- **Steps:**
  1. Check health endpoints.
- **Expected Results:** 200 OK responses.

### TC-DEP-002: Migrations Applied
- **Objective:** Verify migrations applied.
- **Steps:**
  1. Inspect migration status.
- **Expected Results:** No pending migrations.

### TC-DEP-003: Error Monitoring
- **Objective:** Ensure logs are clean.
- **Steps:**
  1. Check Render logs.
- **Expected Results:** No critical errors.

---

## 12. Acceptance Criteria
- All test cases pass with expected results.
- No tenant data leakage.
- POS sales and credit flows accurately update status and balances.
- System stable under normal usage.

---

## 13. Sign-Off
- **QA Lead:** ______________________  
- **Engineering Lead:** ______________  
- **Product Owner:** ________________  
