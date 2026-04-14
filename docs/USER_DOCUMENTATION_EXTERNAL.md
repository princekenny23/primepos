# PrimePOS User Documentation (External)

**Version:** 1.1.0  
**Last Updated:** April 2026  
**Audience:** End-users — Cashiers, Managers, Store Owners, and Staff  

---

## Table of Contents

1. [Quick Start & Installation](#1-quick-start--installation)
   - 1.1 [System Requirements](#11-system-requirements)
   - 1.2 [Accessing PrimePOS](#12-accessing-primepos)
   - 1.3 [First-Time Login](#13-first-time-login)
   - 1.4 [Setting Up Your Business Profile](#14-setting-up-your-business-profile)
   - 1.5 [Setting Up Your First Outlet](#15-setting-up-your-first-outlet)
   - 1.6 [Adding Staff and Roles](#16-adding-staff-and-roles)
2. [Tutorials & How-To Guides](#2-tutorials--how-to-guides)
   - 2.1 [Processing a Sale (Cashier)](#21-processing-a-sale-cashier)
   - 2.2 [Accepting Multiple Payment Methods](#22-accepting-multiple-payment-methods)
   - 2.3 [Processing a Return or Refund](#23-processing-a-return-or-refund)
   - 2.4 [Starting and Closing a Shift](#24-starting-and-closing-a-shift)
   - 2.5 [Adding and Managing Products](#25-adding-and-managing-products)
   - 2.6 [Adding Product Variations and Units](#26-adding-product-variations-and-units)
   - 2.7 [Receiving Stock / Purchase Orders](#27-receiving-stock--purchase-orders)
   - 2.8 [Running a Stock Take](#28-running-a-stock-take)
   - 2.9 [Creating a Quotation](#29-creating-a-quotation)
   - 2.10 [Managing Customers](#210-managing-customers)
   - 2.11 [Generating Reports](#211-generating-reports)
   - 2.12 [Restaurant & Table Orders](#212-restaurant--table-orders)
3. [Reference Manual](#3-reference-manual)
   - 3.1 [Navigation Overview](#31-navigation-overview)
   - 3.2 [Dashboard (Dash)](#32-dashboard-dash)
   - 3.3 [POS Module](#33-pos-module)
   - 3.4 [Sales Module](#34-sales-module)
   - 3.5 [Inventory Module](#35-inventory-module)
   - 3.6 [Office Module](#36-office-module)
   - 3.7 [Reports Module](#37-reports-module)
   - 3.8 [Settings Module](#38-settings-module)
   - 3.9 [User Roles and Permissions](#39-user-roles-and-permissions)
4. [Troubleshooting & FAQ](#4-troubleshooting--faq)
   - 4.1 [Login Issues](#41-login-issues)
   - 4.2 [POS & Sales Issues](#42-pos--sales-issues)
   - 4.3 [Inventory Issues](#43-inventory-issues)
   - 4.4 [Printer and Receipt Issues](#44-printer-and-receipt-issues)
   - 4.5 [Reports Issues](#45-reports-issues)
   - 4.6 [Offline Mode Issues](#46-offline-mode-issues)
   - 4.7 [Frequently Asked Questions (FAQ)](#47-frequently-asked-questions-faq)

---

## 1. Quick Start & Installation

### 1.1 System Requirements

PrimePOS is a **browser-based web application** — no software installation is required on your device.

| Requirement | Minimum |
|-------------|---------|
| Device | PC, laptop, tablet, or smartphone |
| Browser | Google Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ |
| Internet | Stable broadband connection (≥ 2 Mbps recommended) |
| Screen | 1024 × 768 resolution or higher (tablet/desktop) |
| Printer | ESC/POS-compatible thermal receipt printer (optional) |

> **💡 Tip:** Google Chrome on a desktop or laptop gives the best experience for all PrimePOS features, including printing.

---

### 1.2 Accessing PrimePOS

1. Open your web browser.
2. Navigate to the URL provided by your PrimePOS administrator or your service provider (e.g., `https://your-business.primepos.app`).
3. You will see the PrimePOS login screen.

```
┌──────────────────────────────────────┐
│           🏪 PrimePOS                │
│                                      │
│   Username: [____________________]   │
│   Password: [____________________]   │
│                                      │
│            [ Log In ]                │
└──────────────────────────────────────┘
```

---

### 1.3 First-Time Login

1. Enter the **username** and **password** provided by your administrator.
2. Click **Log In**.
3. On first login you may be prompted to change your password — choose a strong, memorable password.
4. Confirm your **tenant/business** context displayed at the top of the screen.
5. Select your assigned **outlet** from the outlet selector.

> **⚠️ Important:** Always confirm the correct outlet is selected before starting work. All transactions are recorded against the active outlet.

---

### 1.4 Setting Up Your Business Profile

*(Performed by System Admin on first setup)*

1. Navigate to **Settings → Business Info**.
2. Fill in:
   - Business name
   - Address
   - Phone number
   - Tax registration number (if applicable)
   - Logo (upload image file)
3. Click **Save**.

The business name and logo will appear on all printed receipts and reports.

---

### 1.5 Setting Up Your First Outlet

1. Go to **Settings → Outlets**.
2. Click **Add Outlet**.
3. Enter:
   - Outlet name (e.g., "Main Branch", "Warehouse")
   - Physical address
   - Contact number
4. Click **Save**.
5. Assign a **till** to the outlet under **Settings → Tills**.

---

### 1.6 Adding Staff and Roles

1. Go to **Office → Users**.
2. Click **Add User**.
3. Fill in name, email, and username.
4. Assign a **role**:

| Role | Typical Access |
|------|---------------|
| Cashier | POS sales only |
| Supervisor | POS, returns, voids, shift management |
| Inventory Clerk | Inventory management, stock take |
| Office/Admin | Quotations, customers, expenses |
| Branch Manager | All modules for assigned outlet |
| System Admin | Full system access, settings |

5. Assign the user to the correct **outlet**.
6. Click **Save** and share the login credentials with the new user.

---

## 2. Tutorials & How-To Guides

### 2.1 Processing a Sale (Cashier)

**Goal:** Complete a standard cash or card sale at the POS.

**Steps:**

1. Log in and confirm your outlet is selected.
2. Navigate to **POS** from the main menu.
3. **Search or browse** for items using the search bar or category filters.
4. Click an item to add it to the cart. The item appears in the right-hand **Cart Panel**.
5. Adjust **quantity** by clicking the quantity field and typing the correct number.
6. To apply a discount, click the discount icon next to the item (if your role permits).
7. To attach a customer, click **+ Customer** and search by name or phone.
8. Click **Checkout / Pay**.
9. Select the **payment method**:
   - Cash
   - Card
   - Mobile Money / Transfer
10. For cash payments, enter the amount tendered — the system will calculate change automatically.
11. Click **Complete Sale**.
12. The receipt screen appears. Click **Print Receipt** or **Send via SMS/Email** if configured.

> **✅ Sale complete!** The transaction is recorded and inventory is updated automatically.

---

### 2.2 Accepting Multiple Payment Methods

**Goal:** Split a payment between cash and mobile money (or any two methods).

1. At the **Checkout** screen, click **Split Payment**.
2. Enter the amount for the **first method** (e.g., Cash: 50.00).
3. Select the **second method** (e.g., Mobile Money).
4. The remaining balance is automatically pre-filled.
5. Confirm both amounts and click **Complete Sale**.

---

### 2.3 Processing a Return or Refund

**Goal:** Return a purchased item and refund the customer.

1. Go to **POS** or **Sales → Returns**.
2. Search for the original sale by **receipt number**, **customer name**, or **date**.
3. Select the sale and click **Return / Refund**.
4. Select which items are being returned and enter quantities.
5. Select the **reason** for return.
6. Choose the refund method (cash, credit note, or exchange).
7. A supervisor may need to **approve** the return depending on your settings.
8. Click **Confirm Return**.

> **⚠️ Note:** Returns require a reason code and are logged for audit purposes.

---

### 2.4 Starting and Closing a Shift

**Starting a Shift:**

1. Navigate to **POS → Shift Management** or click **Start Shift** from the dashboard prompt.
2. Select your assigned **till**.
3. Count and enter your **opening cash float**.
4. Click **Start Shift**.

> The shift start time is recorded. All sales, returns, and cash movements during this period are linked to your shift.

**Closing a Shift:**

1. Click **End Shift** from the shift bar at the top of the POS screen.
2. Count all cash in the till.
3. Enter the **physical cash count**.
4. The system displays **expected cash** (opening float + cash sales − cash payouts).
5. Enter any **discrepancy notes** if the amounts do not match.
6. Click **Close Shift**.
7. Print the **Shift Summary Report** for your records.
8. A supervisor must review and sign off on the shift summary.

---

### 2.5 Adding and Managing Products

**Adding a New Product:**

1. Go to **Inventory → Products** (or **Settings → Products**).
2. Click **Add Product**.
3. Fill in the **Basic** tab:
   - Product name *(required)*
   - SKU (optional — auto-generated if left blank)
   - Category *(required)*
   - Barcode (optional)
   - Description (optional)
   - Selling price *(required)*
   - Cost price (optional)
4. Enable **Track Inventory** if you want stock levels monitored.
5. Click **Save**.

**Editing an Existing Product:**

1. Search for the product in the product list.
2. Click the product name or the **Edit** (pencil) icon.
3. Make changes and click **Save**.

> **💡 Tip:** You can scan a barcode in the search field to quickly find a product.

---

### 2.6 Adding Product Variations and Units

**Goal:** Set up a product that comes in multiple sizes, colors, or pack sizes.

**Adding Variations (e.g., Small / Medium / Large):**

1. Open the product in edit mode (see 2.5).
2. Click the **Variations** tab.
3. Click **Add Variation**.
4. Enter the variation **name** and **price**.
5. Repeat for each variation.
6. Click **Save**.

**Example — Water Bottle:**

| Variation | Price |
|-----------|-------|
| 250ml | $2.50 |
| 500ml | $4.50 |
| 1 Litre | $7.50 |

**Adding Units (e.g., single piece vs. carton):**

1. Click the **Units** tab in the product editor.
2. Click **Add Unit**.
3. Enter:
   - Unit name (e.g., "Piece", "Dozen", "Carton")
   - Conversion factor (how many base units = 1 of this unit)
   - Unit selling price
4. Click **Save**.

**Example — Beverages:**

| Unit | Conversion | Price |
|------|-----------|-------|
| Piece | 1 | $2.50 |
| Dozen | 12 | $25.00 |
| Carton (24) | 24 | $45.00 |

---

### 2.7 Receiving Stock / Purchase Orders

1. Go to **Inventory → Purchase Orders**.
2. Click **New Purchase Order**.
3. Select the **supplier**.
4. Add items and **ordered quantities**.
5. Click **Save** to create a draft, or **Submit** to send to the supplier.
6. When goods arrive, open the purchase order and click **Receive Stock**.
7. Enter the **actual quantities received**.
8. Confirm the receiving outlet.
9. Click **Post Receipt**. Stock levels update immediately.

> **⚠️ Control:** Always verify physical stock against the delivery note before posting the receipt.

---

### 2.8 Running a Stock Take

**Goal:** Count physical inventory and reconcile with system stock levels.

1. Go to **Inventory → Stock Take**.
2. Click **New Stock Take Session**.
3. Select the **outlet** and **category** (or select All).
4. Click **Start Session**.
5. For each product, enter the **physical count** you have on hand.
6. Use the barcode scanner to locate products quickly.
7. Once all items are counted, click **Submit Stock Take**.
8. The system shows a **variance report** — review differences.
9. Click **Post Adjustments** to update stock levels to match physical counts.

---

### 2.9 Creating a Quotation

1. Go to **Office → Quotations**.
2. Click **New Quotation**.
3. Select a **customer** (or create a new one).
4. Add items and quantities.
5. Apply any discounts.
6. Click **Save as Draft** or **Finalise Quotation**.
7. To print or share, click **Print Quotation**.
8. When the customer confirms, click **Convert to Sale** to post the transaction directly to POS.

---

### 2.10 Managing Customers

**Adding a Customer:**

1. Go to **Office → Customers** or click **+ Customer** during a POS sale.
2. Click **Add Customer**.
3. Enter: name, phone number, email (optional), address (optional).
4. Click **Save**.

**Viewing Purchase History:**

1. Find the customer in the customer list.
2. Click the customer name.
3. The profile page shows all past transactions, credit balance, and notes.

**Managing Credit:**

- Credit limits are set per customer in the customer profile.
- Credit sales are recorded as **accounts receivable**.
- Payments against outstanding credit are logged under **Office → Customer Payments**.

---

### 2.11 Generating Reports

1. Go to **Reports** from the main navigation.
2. Select the report type:
   - **Sales Summary** — total sales by day/week/month
   - **Item Sales** — breakdown by product or category
   - **Cashup / Shift Report** — per-shift reconciliation
   - **Profit & Loss** — revenue vs. cost
   - **Stock Valuation** — current inventory value
3. Set your **date range** using the date picker or a preset (Today, This Week, This Month).
4. The report refreshes automatically for the current outlet.
5. Review results on screen.
6. Click **Export Data** to download a CSV or PDF.

> **💡 Tip:** Reports are automatically scoped to your current outlet — no manual filter needed.

---

### 2.12 Restaurant & Table Orders

*(Available for Restaurant and Bar business types)*

**Taking a Table Order:**

1. Go to **POS → Restaurant View** or navigate to the floor plan.
2. Select an available **table**.
3. Add items to the order from the menu.
4. Assign a **waiter** (optional).
5. Click **Send to Kitchen**. The order appears on the Kitchen Display.
6. When the customer is ready to pay, click **Bill / Checkout** on the table.
7. Process payment as normal.

**Managing Tables:**

- Green = Available
- Orange = Occupied / Order in progress
- Red = Bill requested

---

## 3. Reference Manual

### 3.1 Navigation Overview

```
┌─────────────────────────────────────────────────────────┐
│  🏪 PrimePOS     [Outlet: Main Branch ▼]    [⋮] [User] │
├──────┬──────────────────────────────────────────────────┤
│      │                                                  │
│ MENU │         Main Content Area                        │
│      │                                                  │
│ Dash │                                                  │
│ POS  │                                                  │
│ Sales│                                                  │
│ Inv  │                                                  │
│ Off  │                                                  │
│ Rep  │                                                  │
│ Set  │                                                  │
└──────┴──────────────────────────────────────────────────┘
```

**Top Navigation Bar:**

| Element | Description |
|---------|-------------|
| Business Logo/Name | Displays current tenant name |
| Outlet Selector | Switch between outlets you are authorized for |
| ⋮ (Actions Menu) | System actions: Refresh, Sync All |
| User Avatar / Name | Access profile settings and logout |

**Refresh vs. Sync All:**

| Action | Use When |
|--------|----------|
| **Refresh** | Reload current page data (minor state update) |
| **Sync All** | Full app reload — use after configuration changes or when data appears stale across modules |

---

### 3.2 Dashboard (Dash)

The dashboard provides a real-time snapshot of your business performance.

| Widget | Description |
|--------|-------------|
| Today's Sales | Total revenue for the current day |
| Transactions | Number of completed sales today |
| Top Products | Best-selling items by quantity or value |
| Stock Alerts | Products below minimum stock level |
| Shift Status | Current shift open/closed indicator |
| Recent Activity | Latest transactions across the outlet |

---

### 3.3 POS Module

**Cart Panel (Right Side):**

| Element | Description |
|---------|-------------|
| Item Rows | Each line shows product name, quantity, unit price, line total |
| Quantity Field | Click to edit quantity; tap ← to remove |
| Discount Icon | Apply line-level discount (role-dependent) |
| + Customer | Attach a customer account to the sale |
| Order Notes | Add a note to the transaction |
| Subtotal | Sum before tax and discounts |
| Tax | Calculated tax amount |
| Total | Final amount due |
| Pay Button | Proceeds to payment screen |

**Product Search / Grid (Left Side):**

| Element | Description |
|---------|-------------|
| Search Bar | Type product name, SKU, or scan barcode |
| Category Tabs | Filter products by category |
| Product Cards | Click to add to cart; shows name and price |
| Variation Selector | Appears when product has variations; select size/type |

**Payment Screen:**

| Field | Description |
|-------|-------------|
| Payment Method Buttons | Cash / Card / Mobile Money / Credit |
| Amount Tendered | For cash — enter amount given by customer |
| Change | Calculated automatically |
| Split Payment | Divide total across multiple methods |
| Complete Sale | Finalise the transaction |

---

### 3.4 Sales Module

| Sub-section | Description |
|-------------|-------------|
| Sales History | Browse and search all past transactions |
| Returns | Initiate and manage product returns |
| Receipts | View and reprint past receipts |
| Voids | Cancel a transaction (supervisor permission required) |

---

### 3.5 Inventory Module

| Sub-section | Description |
|-------------|-------------|
| Products | Add, edit, deactivate products; manage variations and units |
| Categories | Manage product category groupings |
| Purchase Orders | Create, submit, receive supplier orders |
| Suppliers | Manage supplier contact details and terms |
| Stock Take | Scheduled or ad-hoc physical inventory counts |
| Stock Adjustments | Manual increase or decrease of stock levels with reason codes |
| Transfers | Move stock between outlets |
| Stock Valuation | View current value of inventory by product or category |

---

### 3.6 Office Module

| Sub-section | Description |
|-------------|-------------|
| Customers | Customer profiles, purchase history, credit |
| Quotations | Create, edit, print, and convert quotes to sales |
| Expenses | Record and categorise business expenses |
| Users | Manage staff accounts and role assignments |
| Customer Payments | Record payments against outstanding credit balances |

---

### 3.7 Reports Module

| Report | Description | Key Filters |
|--------|-------------|-------------|
| Sales Summary | Total sales, refunds, net revenue | Date range |
| Item Sales | Revenue breakdown by product | Date range, category |
| Category Sales | Revenue by product category | Date range |
| Cashup Report | Shift-by-shift cash reconciliation | Date range |
| Profit & Loss | Revenue vs. cost vs. gross profit | Date range |
| Stock Valuation | Inventory value at cost and retail | Date (snapshot) |
| Customer Statement | Transaction history per customer | Customer, date range |
| Expense Report | Business expenditure summary | Date range, category |

> **💡 Note:** All reports auto-scope to your **current outlet**. No manual outlet selection is needed.

---

### 3.8 Settings Module

| Section | Description |
|---------|-------------|
| **Business Info** | Business name, logo, address, tax number |
| **Outlets** | Add and manage physical store locations |
| **Tills** | Configure tills/cash registers per outlet |
| **Printers** | Add, configure, and assign receipt printers |
| **Tax & Pricing** | Set tax rates, pricing rules, and rounding |
| **Payment Methods** | Enable/disable payment types (cash, card, mobile money) |
| **Notifications** | Email or system notification preferences |
| **Language & Region** | Set display language, currency, date format |
| **Users** | Manage staff accounts (also accessible from Office) |
| **Roles & Permissions** | Define what each role can see and do |
| **Integrations** | Connect third-party services (e-commerce, WhatsApp, etc.) |

---

### 3.9 User Roles and Permissions

| Permission | Cashier | Supervisor | Inv. Clerk | Office | Branch Mgr | Admin |
|-----------|---------|-----------|-----------|--------|-----------|-------|
| Process sales | ✅ | ✅ | — | — | ✅ | ✅ |
| Apply discounts | ✅ (within limit) | ✅ | — | — | ✅ | ✅ |
| Process returns | — | ✅ | — | — | ✅ | ✅ |
| Void transactions | — | ✅ | — | — | ✅ | ✅ |
| Manage inventory | — | — | ✅ | — | ✅ | ✅ |
| Purchase orders | — | — | ✅ | — | ✅ | ✅ |
| View reports | — | ✅ (shift) | ✅ (stock) | ✅ | ✅ | ✅ |
| Manage customers | — | — | — | ✅ | ✅ | ✅ |
| Manage users | — | — | — | — | ✅ (outlet) | ✅ |
| System settings | — | — | — | — | — | ✅ |

---

## 4. Troubleshooting & FAQ

### 4.1 Login Issues

**Problem: I cannot log in — "Invalid credentials" error.**

- Double-check your **username and password** (case-sensitive).
- Ensure CAPS LOCK is off.
- Try resetting your password (contact your administrator).
- Confirm you are on the correct URL for your business.

**Problem: I am logged out automatically.**

- PrimePOS has an automatic session timeout for security. Log in again.
- Ensure your internet connection is stable.

**Problem: "Account disabled" message.**

- Your account may have been suspended. Contact your system administrator.

**Problem: I can log in but cannot see my outlet.**

- You have not been assigned to an outlet. Ask your administrator to assign you.

---

### 4.2 POS & Sales Issues

**Problem: A product is not appearing in the POS.**

- Check that the product is **Active** in Inventory → Products.
- Verify the product is assigned to the correct **outlet** and **category**.
- Try using the search bar and typing the product name directly.
- Use **Sync All** from the top-right ⋮ menu to refresh all data.

**Problem: The price shown on POS is incorrect.**

- Go to **Inventory → Products** and verify the selling price.
- Check if an active **promotion or discount** is modifying the price.
- Confirm the correct **unit** or **variation** is selected.

**Problem: A sale completed but the receipt did not print.**

- Check that your printer is **powered on** and connected.
- Verify the printer is assigned to the correct **outlet and till** in Settings.
- Try reprinting from **Sales → Receipts** by finding the transaction.
- A failed print does **not** cancel the sale — the transaction is saved.

**Problem: The till is showing an incorrect opening balance.**

- The opening balance is entered manually at shift start. If entered incorrectly, a supervisor can adjust the shift note and add a correction entry.

**Problem: I accidentally voided a transaction.**

- Voids cannot be undone. Record the void reason and inform your manager. The manager can review the audit log in Reports.

---

### 4.3 Inventory Issues

**Problem: Stock levels are not updating after a sale.**

- Verify the product has **Track Inventory** enabled in the product settings.
- Ensure the sale was fully completed (not left in draft).
- Use **Sync All** to refresh inventory state.

**Problem: Stock levels went negative.**

- Negative stock can occur if **Track Inventory** was enabled after sales were already processed.
- Perform a **Stock Adjustment** to correct the quantity with a note explaining the reason.

**Problem: A purchase order was received but stock did not increase.**

- Verify the receiving outlet matches the product's assigned outlet.
- Check that you clicked **Post Receipt** (not just saved the receipt as draft).

**Problem: I cannot find a product during stock take.**

- Use the barcode scanner or search field within the stock take session.
- Verify the product exists and is active in **Inventory → Products**.

---

### 4.4 Printer and Receipt Issues

**Problem: Printer is connected but not printing.**

| Check | Action |
|-------|--------|
| Power | Ensure the printer is on and paper is loaded |
| Connection | Check USB or network cable / Bluetooth pairing |
| Assignment | Settings → Printers — confirm printer is assigned to the correct till |
| Browser | Chrome is recommended for print support |
| Test Print | Use the **Test Print** button in Settings → Printers |

**Problem: Receipts are printing with incorrect business name or logo.**

- Update your business details in **Settings → Business Info** and save.
- Try a test print again.

**Problem: Receipts are missing items or totals are wrong.**

- This usually indicates the receipt was printed before the transaction completed. Reprint from **Sales → Receipts**.

---

### 4.5 Reports Issues

**Problem: Reports show no data for the selected period.**

- Confirm the **date range** is set correctly (the system uses the business's configured timezone).
- Check that transactions exist for that period in **Sales → Sales History**.
- Ensure you are on the correct outlet.

**Problem: Sales Summary total does not match my manual count.**

- Check for **voided** or **returned** transactions — these reduce the net total.
- Verify the date range includes all expected transactions (start and end time).

**Problem: Cannot export a report.**

- Ensure your browser is not blocking pop-ups or downloads.
- Try a different browser (Chrome recommended).

---

### 4.6 Offline Mode Issues

**Problem: The system shows an "Offline" indicator.**

- Your device has lost its internet connection.
- PrimePOS will continue in read-only mode if Offline Mode is enabled by your administrator.
- Reconnect to the internet. The system will sync automatically when the connection is restored.

**Problem: A sale made offline is not appearing in reports.**

- Offline transactions are queued and synced when the connection is restored.
- Wait a few minutes after reconnection and refresh the reports.
- Contact your administrator if transactions remain unsynced after 30 minutes.

---

### 4.7 Frequently Asked Questions (FAQ)

**Q: Can I use PrimePOS on my phone or tablet?**  
A: Yes. PrimePOS works on any modern mobile browser. For the best POS experience, a tablet (7 inches or larger) is recommended.

**Q: How many users can I add?**  
A: The number of users depends on your subscription plan. Contact your service provider for details.

**Q: Can I manage multiple shop locations?**  
A: Yes. PrimePOS supports multiple outlets under a single account. Add outlets in **Settings → Outlets** and assign staff accordingly.

**Q: Is my data backed up?**  
A: All data is stored securely in the cloud and backed up regularly. Contact your service provider for backup frequency and data retention details.

**Q: How do I change my password?**  
A: Click your **name/avatar** in the top-right corner → **Profile Settings** → **Change Password**. Enter your current password, then your new one, and confirm.

**Q: Can I customise the receipt?**  
A: Yes. Update your **business name, address, logo**, and **footer message** in **Settings → Business Info**. The changes reflect on all future receipts.

**Q: Can I connect PrimePOS to my e-commerce store?**  
A: Yes, if the integration is available on your plan. Go to **Settings → Integrations** to connect your online store and synchronise products and orders.

**Q: What happens if the internet goes down during a sale?**  
A: If Offline Mode is enabled by your administrator, in-progress sales may complete using cached data. The transaction will sync when connectivity is restored. Contact your administrator to confirm whether Offline Mode is activated for your account.

**Q: How do I give a discount on a specific item?**  
A: In the POS cart, click the **discount icon** on the item row. Enter the discount percentage or fixed amount. Note that discount permissions are role-based — contact your supervisor if the option is not available.

**Q: How do I deactivate a product without deleting it?**  
A: Go to **Inventory → Products**, find the product, and toggle the **Active** status to off. Inactive products remain in the database for historical reporting but will not appear in the POS product list.

**Q: Can I have different prices for wholesale and retail customers?**  
A: Yes. Products support multiple unit price tiers. Set up wholesale units and prices under the **Units** tab in the product editor (see Section 2.6).

**Q: Where can I get more help?**  
A: Contact your PrimePOS service provider or system administrator. For technical issues, provide the error message, the module you were using, and the time the issue occurred.

---

*PrimePOS User Documentation (External) — © 2026 PrimePOS. All rights reserved.*
