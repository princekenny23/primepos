# Storefront MVP Implementation Phases

## Goal
Ship a complete storefront MVP with public shopping flow, theme customization, WhatsApp checkout, and operational dashboard controls.

## Phase 0: Foundation Hardening (Done)
- Storefront models, migrations, and API routes exist.
- Dashboard settings page exists for storefront basics and catalog rules.
- Storefront orders dashboard exists.

## Phase 1: Public Storefront Shell (Done)
### Scope
- Public storefront page by slug.
- Read storefront config, categories, and products.
- Theme application from storefront color settings.
- Search and category filtering.

### Deliverables
- Route: `/storefront/[slug]`
- Branded hero + category tabs + product grid.
- Product cards with stock visibility.

## Phase 2: Cart + Checkout (In Progress)
### Scope
- Client-side cart state.
- WhatsApp checkout form (customer info + address + notes).
- API validation via `checkout/validate`.
- Order creation via `checkout/create-order`.

### Deliverables
- Add-to-cart and quantity controls.
- Checkout summary and submit flow.
- WhatsApp order handoff button from API response.

### Status
- Done: Cart state, add/remove quantity, checkout form, validate/create API integration.
- Done: WhatsApp handoff and post-order success panel.
- Done: Persist cart between refreshes and mobile sticky checkout bar.
- Done: WhatsApp message preview and copy helper.
- Remaining: Delivery zone fee logic in checkout payload.

## Phase 3: Customer Order Tracking (In Progress)
### Scope
- Public order status page by order reference.
- Fetch order details via storefront public endpoint.

### Deliverables
- Route: `/storefront/[slug]/orders/[public_order_ref]`
- Order status timeline and key metadata.

### Status
- Done: Public order tracking route and order detail fetch.
- Done: Visual status timeline component.

## Phase 4: Admin Storefront Controls (Next)
### Scope
- Expand settings to support theme presets.
- Better content controls (headline, welcome text, contact section).
- Optional domain management panel.

### Deliverables
- Theme presets + custom palette in dashboard.
- Storefront content settings persisted in `seo_settings` or `checkout_settings`.

## Phase 5: Monetization and Ops (Next)
### Scope
- Delivery zones and fee rules.
- WhatsApp commerce optimization (message templates and conversion tracking).
- Basic analytics dashboard.

### Deliverables
- Delivery fee display and validation.
- KPI cards: orders, conversion proxy, top products.

## Definition of MVP Done
- Merchant can create and style a storefront.
- Shopper can browse products and place an order.
- Order appears in dashboard and status can be updated.
- Theme colors are applied consistently on public storefront pages.
