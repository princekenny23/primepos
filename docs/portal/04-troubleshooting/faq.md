# Troubleshooting and FAQ

## Quick Troubleshooting Flow
1. Confirm internet/network status.
2. Confirm correct account and outlet selected.
3. Refresh page and retry once.
4. Check exact error message.
5. Escalate with timestamp, outlet, and screenshot.

## Common Issues

### 1) POS checkout fails
Symptoms:
- Checkout button does nothing
- Error on payment confirmation

Checks:
- Cart is not empty
- Payment method selected
- User has permission to create sale

Fix:
- Re-login and retry
- Confirm backend service is reachable
- Check if endpoint returned `400` with validation details

### 2) Storefront order not visible in dashboard
Symptoms:
- Customer completed WhatsApp checkout, but no order in admin list

Checks:
- `create-order` endpoint success response includes `public_order_ref`
- Tenant/account used in dashboard matches storefront owner
- Backend migrations are applied

Fix:
- Re-run order placement
- Refresh admin orders page
- Check backend logs for `500` tracebacks

### 3) Login issues
Symptoms:
- Invalid credentials error
- Token expired frequently

Fix:
- Reset password
- Check server time sync
- Confirm auth token refresh flow

### 4) Inventory mismatch
Symptoms:
- Product stock does not match expected quantity

Checks:
- Review stock movements
- Verify manual adjustments
- Verify void/refund handling

Fix:
- Perform audited stock adjustment
- Add reason for correction

### 5) Sync/offline issues
Symptoms:
- Pending sync queue not clearing

Fix:
- Confirm sync service is enabled
- Confirm network and auth token
- Retry push/pull actions

## FAQ

### Q: Can I hide products from storefront?
Yes. Use storefront catalog include/exclude rules.

### Q: Can I use one system for multiple outlets?
Yes. PrimePOS supports multi-outlet and role-based access.

### Q: How can I recover from accidental checkout mistakes?
Use void/refund workflows according to role permissions.

### Q: How often should I back up data?
Daily minimum. More frequent for high-volume outlets.

### Q: Where should support start when a user says "it is not working"?
Start with account, outlet context, and exact timestamp/error message.
