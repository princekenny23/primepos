# PrimePOS E-commerce Implementation README

## Objective
Launch an Odoo-style e-commerce MVP on top of the existing PrimePOS platform, reusing current multi-tenant, outlet, product, sales, and inventory systems.

## Guiding Principles
- Reuse existing backend and frontend services instead of rebuilding core commerce logic.
- Keep a single source of truth for inventory, orders, and reporting.
- Support multiple online stores per tenant from day one.
- Keep implementation incremental so revenue can start early.

## What Already Exists and Should Be Reused
- Multi-tenant isolation and tenant settings.
- Multi-outlet support per tenant.
- Product catalog with outlet linkage, pricing, units, and stock.
- Sales lifecycle including checkout initiation/finalization and receipts.
- Existing admin/dashboard UX patterns and service layer.
- CSS variable based theming foundation in frontend.

## MVP Scope
### In Scope
- Public storefront browsing (products, categories, product details).
- Cart and checkout for online orders.
- Order creation through existing sales engine.
- Tenant-level branding and per-store color themes.
- Multiple online stores per tenant.
- Basic payment modes: cash on delivery, bank transfer, manual confirmation.

### Out of Scope (Phase 1)
- Full marketplace features.
- Complex promotions engine.
- Full card gateway orchestration across multiple providers.
- Deep CMS/page builder.

## Target Architecture
### Core Concept
Add a commerce channel layer that maps public storefront traffic into existing tenant/outlet/product/sale flows.

### Channel Flow
1. Resolve storefront by domain or slug.
2. Resolve tenant and default outlet from storefront.
3. Read catalog using existing product and category data.
4. Create online order by calling existing sale creation flow with `channel=web`.
5. Reuse stock deduction, receipts, and reporting.

## Data Model Additions
Create a new backend app, for example `apps.storefronts`, with:

### Storefront
- `tenant` (FK)
- `name`
- `slug`
- `is_active`
- `default_outlet` (FK)
- `currency_override` (nullable)
- `theme_settings` (JSON)
- `checkout_settings` (JSON)
- `seo_settings` (JSON)

### StorefrontDomain
- `storefront` (FK)
- `domain`
- `is_primary`
- `is_verified`
- `ssl_status`

### StorefrontCatalogRule
- `storefront` (FK)
- `rule_type` (`include` or `exclude`)
- `category` (nullable FK)
- `product` (nullable FK)

### Optional (Phase 2)
- `StorefrontPriceList` and `StorefrontPriceListItem` for store-specific pricing overrides.

## API Plan
### Public Read APIs
- `GET /api/v1/storefronts/resolve?host=`
- `GET /api/v1/storefronts/{slug}/config`
- `GET /api/v1/storefronts/{slug}/categories`
- `GET /api/v1/storefronts/{slug}/products`
- `GET /api/v1/storefronts/{slug}/products/{id-or-slug}`

### Public Write APIs
- `POST /api/v1/storefronts/{slug}/checkout/validate`
- `POST /api/v1/storefronts/{slug}/checkout/create-order`
- `GET /api/v1/storefronts/{slug}/orders/{public_order_ref}`

### Internal/Admin APIs
- CRUD for storefronts, domains, and catalog rules.
- Theme and checkout settings update endpoints.

## Reuse Strategy for Orders and Inventory
- Do not create a separate order engine.
- Map storefront checkout payload into existing sales payload format.
- Set `payment_method` and `status` based on checkout mode.
- Keep inventory updates inside current sales transaction logic.
- Use existing receipt pipeline for order confirmation artifacts.

## Multi-Store Per Tenant Design
- One tenant can own many storefronts.
- Each storefront can point to one default outlet for fulfillment.
- Storefront-specific catalog rules control what is visible.
- Storefront-specific theme settings control look and feel.
- Optional: shared catalog with store-level price overrides.

## Tenant and Storefront Theming
Use existing CSS variable tokens. Apply theme settings at runtime per storefront.

### Required Tokens
- `--primary`
- `--primary-foreground`
- `--secondary`
- `--accent`
- `--background`
- `--foreground`
- `--card`
- `--border`
- `--ring`

### Theming Rules
- Tenant has a default theme in tenant settings.
- Storefront can override tenant defaults.
- Validate contrast before saving theme.
- Provide quick presets and custom picker.

## Fast Revenue MVP Features (Priority)
1. Multi-store setup with per-store branding.
2. WhatsApp order handoff from cart/checkout.
3. Cash on delivery and bank transfer checkout modes.
4. Delivery zones and delivery fee rules.
5. Coupon codes (simple fixed/percent) in Phase 1.5.

## Implementation Phases
### Phase 0: Foundation (3-5 days)
- Create storefront models and migrations.
- Add admin APIs for storefront CRUD.
- Add host/slug resolution middleware/helper.

### Phase 1: Public Storefront (5-7 days)
- Product/category listing and detail pages.
- Storefront theme application.
- Basic cart state and checkout form.

### Phase 2: Order Execution (5-7 days)
- Checkout validation.
- Order creation via existing sales service.
- COD/bank transfer/manual payment confirmation flow.

### Phase 3: Commercial Features (4-6 days)
- Multi-domain support.
- Delivery zones and fees.
- Basic discount code support.
- Storefront analytics from sales channel filters.

## Security and Isolation Requirements
- Public APIs must resolve tenant through storefront only.
- Never accept tenant IDs directly from public clients.
- Enforce tenant/outlet ownership on all storefront resources.
- Add rate limits to public checkout endpoints.

## QA Checklist
- Storefront can only access mapped tenant data.
- Creating an online order updates stock correctly.
- Order appears in existing dashboard/sales reports.
- Theme changes apply only to target storefront.
- Multiple storefronts under same tenant work independently.

## Deployment Notes
- Add storefront app to installed apps and URL routing.
- Configure domain mapping and TLS for custom domains.
- Set cache layer for public catalog endpoints.
- Add monitoring for checkout errors and failed order creation.

## Suggested Commercial Packaging
- Starter: 1 online store, COD, basic branding.
- Growth: up to 3 stores, custom domains, delivery zones.
- Scale: unlimited stores, advanced promos, channel analytics.

## Next Step
After approval of this README, create a technical task breakdown file with model-level field definitions, endpoint contracts, and migration order for implementation.
