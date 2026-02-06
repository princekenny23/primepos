# Render Test Guide (PrimePOS)

This guide is a full checklist for testing the hosted system on Render, including creating users, inventory, sales, quotations, and finance flows.

## 1) Access the hosted app
- Open your Render URL in a browser.
- Confirm the frontend loads without console errors.

## 2) Create a super admin (Django)
> Use the Render shell (or SSH/console) for the backend service.

Run:
- `python manage.py createsuperuser`

Then:
- Log into the Django admin: `/admin/`
- Confirm superuser login works.

## 3) Create a business/tenant and outlet
In Django admin:
- Create a Tenant (Business)
- Create an Outlet linked to that Tenant
- Create a Till linked to that Outlet

## 4) Create a staff user (POS user)
In Django admin:
- Create a User and assign:
  - Tenant
  - Outlet
  - Roles/Permissions required for sales

## 5) Login to the app
- Login with the staff user.
- Ensure the dashboard loads and outlet context is correct.

## 6) Create products & categories
From the app:
- Inventory → Products → Add Product
- Create at least 2 products and 1 category
- Add a product with a barcode for scanner testing

## 7) Test sales flow
- POS → Add items → Checkout
- Verify sale is recorded in Sales → Transactions

## 8) Test credit (Tabs)
- Create a sale with payment method `tab`
- Sales → Credits
- Record partial payment
- Confirm status changes to `partially_paid` and remaining balance updates
- Record remaining payment and confirm status `paid`
- If due dates are used, confirm `overdue` for past due items

## 9) Test barcode scanning (optional)
- Ensure scanner is enabled in Settings → Integrations → Hardware Scanner
- Use the “Send Test Scan” button
- Confirm Add Product modal opens with barcode prefilled

## 10) Quotations flow
- Sales → Quotations → Create a new quotation
- Add customer and items, save
- Convert quotation to sale (if supported)
- Confirm sale appears in Transactions

## 11) Returns flow
- Sales → Returns → Create a return against a sale
- Confirm return is saved and stock is adjusted (if applicable)

## 12) Discounts flow
- Sales → Discounts → Create a discount
- Apply in POS and confirm totals

## 13) Inventory stock control
- Inventory → Stock Control → Receive/Adjust
- Confirm stock levels update in Products

## 14) Purchases/Expenses (office)
- Office → Expenses → Create an expense
- Confirm it appears in expenses list

## 15) Reports
- Reports → Sales/Inventory
- Confirm filters and export (if available)

## 16) Basic health check
- API responds without 500 errors
- No failed migrations
- Logs show no unhandled exceptions

## Notes
- If a list is empty after creating records, refresh the page or sign out/in to reload context.
- For permissions issues, confirm the user’s tenant/outlet mappings.
