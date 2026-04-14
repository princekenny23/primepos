# PrimePOS — Technical Design Document

| Field | Value |
|---|---|
| **Document Version** | 1.0.0 |
| **Product Version** | 1.1.0 |
| **Status** | Production-Ready Draft |
| **Last Updated** | April 2026 |
| **Authored By** | PrimePOS Engineering Team |

---

## Table of Contents

1. [Project Description](#1-project-description)
2. [System Architecture](#2-system-architecture)
3. [Data Design](#3-data-design)
4. [User Interface Design](#4-user-interface-design)
5. [API Documentation](#5-api-documentation)
6. [Testing & Maintenance](#6-testing--maintenance)

---

## 1. Project Description

### 1.1 Name & Version

| Attribute | Value |
|---|---|
| **Product Name** | PrimePOS |
| **Version** | 1.1.0 (MVP+) |
| **Codename** | PrimeERP |
| **Target Markets** | Sub-Saharan Africa (primary), Global (secondary) |

### 1.2 Overview

PrimePOS is a **full-stack, multi-tenant SaaS Point-of-Sale and business-management platform** designed for small and medium-sized enterprises (SMEs). It provides a single unified codebase that adapts to multiple business models — retail/wholesale, restaurants, and bars — through configurable tenant settings.

### 1.3 Core Capabilities

| Capability | Description |
|---|---|
| **Multi-Tenant SaaS** | Complete data isolation per tenant; each business operates independently |
| **Point of Sale (POS)** | Fast checkout with cash, card, mobile money, tab, and credit payment methods |
| **Inventory Management** | Real-time stock tracking, batch/expiry management, multi-unit selling, low-stock alerts |
| **Business Analytics** | Dashboards, KPIs, profit/loss reports, sales trends, cashup reports |
| **Multi-Outlet Support** | Manage multiple physical locations (branches) under one tenant account |
| **Role-Based Access Control** | SaaS Admin, Admin, Manager, Cashier, Staff with granular permissions |
| **Restaurant / Bar Module** | Table management, kitchen display system (KDS), tab management, order tracking |
| **E-commerce Storefront** | Per-tenant public storefront with product catalogue, checkout, and WhatsApp order notifications |
| **Fleet & Distribution** | Vehicle, driver, and trip management for delivery businesses |
| **Customer Relationship Management (CRM)** | Customer profiles, purchase history, credit accounts, loyalty |
| **Supplier & Procurement** | Purchase orders, supplier invoices, purchase returns |
| **Offline Mode (in rollout)** | Service-worker-based read cache + transactional outbox queue |
| **Hardware Printing** | ESC/POS receipt printing via QZ-Tray integration |

### 1.4 Deployment Topology

| Component | Platform | Notes |
|---|---|---|
| Backend API | Render (Python/Docker) | Auto-scaling web service |
| Frontend SPA | Vercel (Next.js) | Edge-optimised CDN delivery |
| Database | PostgreSQL (Render managed) | Primary data store |
| Task Queue | Redis + Celery (Render) | Async jobs and background tasks |
| Media Storage | Cloudinary | Product images, logos |
| Error Monitoring | Sentry | Frontend & backend error tracking |
| Desktop Connector | .NET 8 Windows app | Local print bridge (`primeposconnector`) |

---

## 2. System Architecture

### 2.1 High-Level Component Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                   │
│                                                                  │
│  ┌─────────────────────┐      ┌──────────────────────────┐       │
│  │  Browser / PWA       │      │  Public Storefront        │       │
│  │  (Next.js 14)        │      │  (Next.js, /storefront/   │       │
│  │  Deployed on Vercel  │      │   [slug])                 │       │
│  └─────────┬───────────┘      └────────────┬─────────────┘       │
│            │ HTTPS / REST JSON              │                     │
└────────────┼───────────────────────────────┼─────────────────────┘
             │                               │
┌────────────▼───────────────────────────────▼─────────────────────┐
│                     DJANGO REST FRAMEWORK API                    │
│                     (Render — gunicorn + whitenoise)             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Multi-Tenant Middleware  →  Auth (JWT)  →  RBAC           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Accounts │ Tenants │ Outlets │ Products │ Inventory │ Sales     │
│  Customers│ Suppliers│ Staff  │ Shifts   │ Restaurant│ Bar       │
│  Reports  │ Storefront│ Fleet │ Expenses │ Quotations│ Sync      │
│  Activity Logs │ Notifications │ Health │ Admin                  │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────────┐  │
│  │ Celery   │  │ Redis    │  │ PostgreSQL  │  │ Cloudinary   │  │
│  │ Workers  │  │ Broker   │  │ (Primary DB)│  │ (Media)      │  │
│  └──────────┘  └──────────┘  └────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────────────────┘
             │
┌────────────▼─────────────────┐
│  PrimePOS Connector (.NET 8) │
│  Windows local print bridge  │
│  Proxies to QZ-Tray /        │
│  thermal printer hardware    │
└──────────────────────────────┘
```

### 2.2 Request Lifecycle

```
User action in browser
        │
        ▼
Next.js Page / Component
        │
        ▼
Frontend Service layer
(lib/services/saleService.ts, etc.)
        │
        ▼
lib/api.ts  ──── attaches: Authorization: Bearer <token>
                           X-Outlet-ID: <outlet_id>
        │
        ▼  HTTPS POST /api/v1/sales/
Django URL Router (urls.py)
        │
        ▼
ViewSet / View  (auth + permission check)
        │
        ▼
Serializer  (schema validation + field coercion)
        │
        ├─── validation errors → 400 JSON
        │
        ▼
Model.save() / business logic service
        │
        ▼
PostgreSQL write
        │
        ▼
JSON Response  →  Frontend state update
```

### 2.3 Tenant Isolation Model

Each tenant is fully isolated:
- All primary models carry a `tenant` FK.
- The multi-tenant middleware injects `request.tenant` on every authenticated request.
- Queryset filtering is enforced in every ViewSet to prevent cross-tenant data leakage.
- Tenants are resolved by subdomain (`<slug>.primepos.app`) or custom domain (`TENANT_BASE_DOMAIN` setting).

### 2.4 Authentication Flow

```
POST /api/v1/auth/login/
  { "email": "...", "password": "..." }
         │
         ▼
  Returns:
  { "access": "<JWT access token>",
    "refresh": "<JWT refresh token>",
    "user": { ... } }
         │
         ▼
  Frontend stores tokens in memory / localStorage
  All subsequent requests include:
    Authorization: Bearer <access>
         │
  Token expires → POST /api/v1/auth/token/refresh/
    { "refresh": "<refresh token>" }
```

### 2.5 Offline Architecture (Phase Rollout)

| Phase | Status | Behaviour |
|---|---|---|
| 0 | Default / Active | No offline behaviour; feature flags disabled |
| 1 | Available | Service-worker read cache; offline status indicator |
| 2+ | Reserved | Transactional outbox queue; sync-on-reconnect |

Enable via environment variables:
- `NEXT_PUBLIC_OFFLINE_MODE_ENABLED=true`
- `NEXT_PUBLIC_OFFLINE_MODE_PHASE=1`
- `OFFLINE_MODE_ENABLED=true` (backend)

---

## 3. Data Design

### 3.1 Entity Relationship Overview

```
Tenant ──< Outlet ──< Till
   │           │
   │           └──< Product ──< Batch (expiry/stock)
   │           │       └──< ProductUnit (selling units)
   │           │
   │           └──< Sale ──< SaleItem
   │           │      ├── Customer (optional)
   │           │      ├── Shift
   │           │      └── Till
   │           │
   │           └──< Shift ──< CashMovement
   │           │
   │           └──< StockMovement
   │
   ├──< User ──< StaffProfile ──< Role
   │
   ├──< Customer ──< CreditAccount
   │
   ├──< Supplier ──< PurchaseOrder ──< PurchaseOrderItem
   │
   ├──< Storefront ──< StorefrontOrder ──< StorefrontOrderItem
   │
   ├── TenantPermissions (1-to-1)
   │
   └──< Restaurant: Table, RestaurantOrder, KitchenTicket
       Bar: BarTab, BarTabItem
       Distribution: Vehicle, Driver, Trip, DeliveryOrder
```

### 3.2 Core Database Tables

#### `tenants_tenant`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | integer | PK | Auto-increment primary key |
| `name` | varchar(255) | NOT NULL | Business display name |
| `type` | varchar(20) | NOT NULL | `retail`, `restaurant`, `bar` |
| `pos_type` | varchar(20) | NOT NULL | `standard`, `single_product` |
| `currency` | varchar(3) | default `MWK` | ISO 4217 currency code |
| `currency_symbol` | varchar(10) | | Display symbol |
| `subdomain` | slug(63) | UNIQUE | Auto-generated from name |
| `domain` | varchar(255) | UNIQUE, nullable | Custom domain |
| `settings` | jsonb | default `{}` | Flexible tenant config |
| `has_distribution` | boolean | default false | Enable fleet module |
| `is_active` | boolean | default true | Suspend flag |
| `created_at` | timestamptz | auto | Row creation timestamp |
| `updated_at` | timestamptz | auto | Last modification timestamp |

#### `accounts_user`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | integer | PK | |
| `email` | varchar | UNIQUE, NOT NULL | Login identifier |
| `username` | varchar | UNIQUE | Legacy Django field |
| `name` | varchar(255) | | Display name |
| `phone` | varchar(30) | nullable | Contact number |
| `tenant_id` | FK → `tenants_tenant` | nullable | Owning tenant |
| `role` | varchar(50) | | `admin`, `manager`, `cashier`, `staff`, `saas_admin` |
| `is_saas_admin` | boolean | default false | Platform super-admin flag |
| `password` | varchar | hashed | Django PBKDF2 hash |
| `is_active` | boolean | default true | Account enabled |
| `created_at` | timestamptz | auto | |
| `updated_at` | timestamptz | auto | |

#### `outlets_outlet`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | integer | PK | |
| `tenant_id` | FK → `tenants_tenant` | NOT NULL | |
| `name` | varchar(255) | NOT NULL | Branch name |
| `address` | text | | Physical address |
| `phone` | varchar(20) | | |
| `email` | varchar | | |
| `business_type` | varchar(30) | nullable | Override tenant type |
| `settings` | jsonb | default `{}` | Per-outlet config |
| `is_active` | boolean | default true | |
| `created_at` | timestamptz | auto | |
| `updated_at` | timestamptz | auto | |

#### `products_product`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | integer | PK | |
| `tenant_id` | FK | NOT NULL | |
| `outlet_id` | FK → `outlets_outlet` | NOT NULL | Product belongs to outlet |
| `category_id` | FK → `products_category` | nullable | |
| `name` | varchar(255) | NOT NULL | |
| `sku` | varchar(100) | indexed, nullable | Stock-keeping unit |
| `barcode` | varchar(100) | indexed | EAN/QR barcode |
| `retail_price` | decimal(15,2) | ≥ 0.01 | |
| `cost` | decimal(15,2) | nullable | Cost price |
| `wholesale_price` | decimal(15,2) | nullable | |
| `wholesale_enabled` | boolean | default false | |
| `minimum_wholesale_quantity` | integer | default 1 | |
| `stock` | integer | ≥ 0, default 0 | Legacy stock count |
| `low_stock_threshold` | integer | ≥ 0 | Alert trigger level |
| `unit` | varchar(50) | default `pcs` | Base unit label |
| `track_expiration` | boolean | default false | Enable batch expiry |
| `expiry_date` | date | nullable | |
| `preparation_time` | integer | nullable | Minutes (restaurant) |
| `volume_ml` | decimal(8,2) | nullable | Bar items |
| `alcohol_percentage` | decimal(5,2) | nullable | Bar items |
| `image` | varchar | nullable | Cloudinary path |
| `is_active` | boolean | default true | |
| `created_at` | timestamptz | auto | |
| `updated_at` | timestamptz | auto | |

#### `apps_sales_sale`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | integer | PK | |
| `tenant_id` | FK | NOT NULL | |
| `outlet_id` | FK | NOT NULL | |
| `user_id` | FK → `accounts_user` | nullable | Cashier |
| `shift_id` | FK → `shifts_shift` | nullable | Active shift |
| `till_id` | FK → `outlets_till` | nullable | POS terminal |
| `customer_id` | FK → `customers_customer` | nullable | |
| `table_id` | FK → `restaurant_table` | nullable | Restaurant |
| `receipt_number` | varchar(50) | UNIQUE, indexed | Auto-generated |
| `subtotal` | decimal(10,2) | ≥ 0 | Pre-tax, pre-discount |
| `tax` | decimal(10,2) | default 0 | Tax rate % |
| `tax_amount` | decimal(10,2) | default 0 | Computed tax |
| `discount` | decimal(10,2) | default 0 | Discount rate % |
| `discount_amount` | decimal(10,2) | default 0 | Computed discount |
| `total` | decimal(10,2) | ≥ 0.01 | Final amount |
| `payment_method` | varchar(20) | | `cash`, `card`, `mobile`, `tab`, `credit` |
| `cash_amount` | decimal(12,2) | | Split tender — cash portion |
| `card_amount` | decimal(12,2) | | Split tender — card portion |
| `mobile_amount` | decimal(12,2) | | Split tender — mobile money |
| `bank_transfer_amount` | decimal(12,2) | | |
| `status` | varchar(20) | | `completed`, `pending`, `refunded`, `cancelled` |
| `payment_status` | varchar(20) | | `unpaid`, `partially_paid`, `paid`, `overdue` |
| `cash_received` | decimal(10,2) | nullable | Tender amount |
| `change_given` | decimal(10,2) | nullable | Change returned |
| `created_at` | timestamptz | auto | |

#### `inventory_batch`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | integer | PK | |
| `tenant_id` | FK | NOT NULL | |
| `outlet_id` | FK | NOT NULL | |
| `product_id` | FK → `products_product` | nullable | |
| `batch_number` | varchar(100) | UNIQUE per (product, outlet) | Lot identifier |
| `expiry_date` | date | NOT NULL | |
| `quantity` | integer | ≥ 0 | Current stock in batch |
| `cost_price` | decimal(10,2) | nullable | Cost per unit |
| `created_at` | timestamptz | auto | |
| `updated_at` | timestamptz | auto | |

### 3.3 Data Flow Diagram — Create Sale

```
[Cashier selects products in POS]
          │
          ▼
[Cart state (Zustand) updated]
          │
          ▼
[Cashier clicks "Complete Sale"]
          │
          ▼
[saleService.create(payload)]  ──POST /api/v1/sales/──▶  [SaleViewSet.create()]
                                                                    │
                                                           [SaleSerializer validates]
                                                                    │
                                                         ┌──────────┴──────────┐
                                                    Validation OK         Validation fail
                                                         │                      │
                                               [Sale + SaleItems saved]    400 + errors
                                                         │
                                               [Stock decremented per item]
                                                         │
                                               [StockMovement ledger entry]
                                                         │
                                               [Receipt number generated]
                                                         │
                                               [201 Response with sale data]
                                                         │
                                          [Frontend shows receipt / triggers print]
```

### 3.4 Data Dictionary (Key Terms)

| Term | Definition |
|---|---|
| **Tenant** | A business (customer) subscribing to PrimePOS; root isolation boundary |
| **Outlet** | A physical branch or location belonging to a Tenant |
| **Till** | A physical or virtual cash register assigned to an Outlet |
| **Shift** | A cashier's work session opened on a Till; contains opening/closing float |
| **Product** | A sellable item scoped to a Tenant + Outlet |
| **ProductUnit** | A named selling unit for a Product (e.g., "crate", "bottle"); has a stock conversion factor |
| **Batch** | A dated lot of a Product with an expiry date; the stock source of truth when expiry tracking is enabled |
| **StockMovement** | An immutable ledger entry recording every stock change (sale, purchase, adjustment, transfer) |
| **Sale** | A completed customer transaction containing one or more SaleItems |
| **SaleItem** | A single line of a Sale; references Product + quantity + price |
| **Receipt** | A printable/digital proof of Sale; ESC/POS formatted for thermal printers |
| **Storefront** | A public-facing e-commerce site generated per Tenant |
| **StorefrontOrder** | An online order placed via the public Storefront |
| **Customer** | A CRM contact associated with a Tenant; may hold a credit account |
| **Staff / Role** | An employee record with configurable permission flags |
| **PurchaseOrder** | A formal request to a Supplier to deliver goods |
| **SupplierInvoice** | Received goods invoice linked to a PurchaseOrder |

---

## 4. User Interface Design

### 4.1 Technology & Design System

| Item | Choice |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS 3 |
| Component Library | Radix UI primitives |
| Design Tokens | Tailwind CSS config (colors, spacing, typography) |
| Icons | Lucide React |
| Charts | Recharts |
| State Management | Zustand stores |
| i18n | Custom `i18n-context` (runtime locale switching) |

### 4.2 Navigation Structure

```
/                           → Root (redirect to /auth/login)
/auth/login                 → Email + password login
/auth/verify-email          → Email verification flow
/auth/select-outlet         → Post-login outlet selector

/onboarding/                → New tenant wizard (first-run)
  /setup-business           → Business details
  /setup-outlet             → First outlet creation
  /add-first-user           → Invite admin user

/dashboard/                 → Landing dashboard (KPI cards)
  /pos/                     → POS entry / shift start
  /pos/start-shift          → Open till / start shift wizard

  /sales/                   → Sales overview
    /transactions           → All transactions list
    /returns                → Customer returns
    /credits                → Credit account management
    /discounts              → Discount rules
    /voids                  → Voided sales

  /inventory/               → Inventory overview
    /products               → Product list + CRUD
    /products/categories    → Category management
    /products/[id]          → Product detail
    /stock-control          → Manual stock adjustments
    /stock-taking           → Full stock-take workflow
    /stock-taking/[id]      → Individual stock-take session
    /low-stock              → Low-stock alert list
    /expiry                 → Expiry tracking
    /suppliers/             → Supplier management
      /list                 → Supplier list
      /purchases            → Purchase receipts
      /purchase-orders      → Purchase order management
      /invoices             → Supplier invoices
      /returns              → Purchase returns

  /restaurant/              → Restaurant module
    /dashboard              → Restaurant KPIs
    /tables                 → Table map + status
    /orders                 → Order queue
    /kitchen                → Kitchen Display System (KDS)
    /menu                   → Menu / product management

  /bar/                     → Bar module
    /dashboard              → Bar KPIs
    /tables                 → Table status
    /tabs                   → Open bar tabs

  /retail/                  → Retail module
    /dashboard              → Retail KPIs

  /storefront/              → E-commerce storefront management
    /sites                  → Storefront site list + enable/disable
    /catalog                → Published product catalogue
    /orders                 → Incoming online orders
    /settings               → Storefront branding & config
    /reports                → Storefront revenue reports

  /distribution/            → Fleet management
    /vehicles               → Vehicle registry
    /drivers                → Driver profiles
    /active-trips           → Live trip map
    /deliveries             → Delivery order management
    /trip-history           → Completed trips
    /driver-dashboard       → Driver self-service view

  /office/                  → Back-office
    /customer-management    → CRM — customer list
    /customer-management/[id] → Customer profile
    /users                  → User / staff management
    /shift-management       → Shift overview and history
    /expenses               → Expense recording
    /quotations             → Sales quotations
    /reports/               → Full reporting suite
      /sales                → Sales report (payments, items, categories)
      /cashup               → Cash-up / till reconciliation
      /stock-valuation      → Inventory value snapshot
      /profit-loss          → P&L statement

  /loyalty/                 → Loyalty programme management
  /discounts                → Discount & promotion rules
  /returns                  → Returns management

  /settings/                → Tenant settings
    /business               → Business profile
    /outlets-and-tills-management → Outlets + tills CRUD
    /tax                    → Tax rates and pricing
    /language               → UI language selector
    /notifications          → Notification preferences
    /integrations           → Third-party integration keys
    /activity-logs          → Audit trail

/pos/retail                 → Full-screen Retail POS terminal
/pos/restaurant             → Full-screen Restaurant POS
/pos/bar                    → Full-screen Bar POS
/pos/single-product         → Single-product quick-sale POS

/storefront/[slug]/         → Public storefront homepage
/storefront/[slug]/shop     → Product catalogue
/storefront/[slug]/products/[product_id] → Product detail
/storefront/[slug]/orders/[public_order_ref] → Order status
/storefront/[slug]/about    → About page

/admin/                     → SaaS super-admin panel
  /tenants                  → All tenant management
  /users                    → Platform user management
  /billing                  → Subscription billing
  /plans                    → SaaS plan management
  /analytics                → Platform-wide analytics
  /sync                     → Data sync management
  /support-tickets          → Support ticket queue
```

### 4.3 POS Terminal UX Flow

```
┌────────────────────────────────────────────────────────┐
│ RETAIL POS (/pos/retail)                               │
│                                                        │
│ [Product Search / Barcode Scan]                        │
│ ┌─────────────────┐  ┌─────────────────────────────┐  │
│ │  Product Grid    │  │        Cart                 │  │
│ │                  │  │                             │  │
│ │ [Product Card]   │  │  Item 1   qty  unit  price  │  │
│ │ [Product Card]   │──▶│  Item 2   qty  unit  price  │  │
│ │ [Product Card]   │  │  ...                        │  │
│ │                  │  │  ─────────────────────────  │  │
│ │                  │  │  Subtotal  Discount  Tax     │  │
│ │                  │  │  TOTAL: MWK X,XXX           │  │
│ │                  │  │                             │  │
│ │                  │  │  [Customer] [Discount]       │  │
│ │                  │  │  [COMPLETE SALE]             │  │
│ └─────────────────┘  └─────────────────────────────┘  │
└────────────────────────────────────────────────────────┘

On "COMPLETE SALE":
  → Payment method selector modal
  → Cash: enter amount received → calculate change
  → Card / Mobile: confirm amount
  → Multi-tender: split payment across methods
  → Submit → receipt generated → optional print
```

### 4.4 UI/UX Principles

- **Outlet-scoped by default** — All views use the currently selected outlet; no manual filter required.
- **Error-only toast notifications** — Success operations are silent; only errors produce alerts to reduce noise.
- **Offline-first indicator** — A status indicator shows connectivity state when offline mode is enabled.
- **Responsive layout** — Sidebar collapses on smaller screens; POS terminals are designed for touchscreens.
- **Accessibility** — Radix UI components are keyboard-navigable and screen-reader compatible; form inputs have proper `title` and `aria-*` attributes.
- **Multilingual** — The `i18n-context` provider allows runtime language switching; receipt labels are independently localised via `lib/i18n/receipt-labels.ts`.
- **Role-gated navigation** — Sidebar items and action buttons are conditionally rendered based on `role-context` permissions.

### 4.5 Key Modals & Components

| Component | Location | Purpose |
|---|---|---|
| `CreateSaleModal` | `components/modals/` | POS checkout and payment collection |
| `AddEditProductModal` | `components/modals/` | Create / update product records |
| `StockAdjustmentModal` | `components/modals/` | Manual stock increase/decrease |
| `StartShiftModal` | `components/modals/` | Open till with opening float |
| `CloseShiftModal` | `components/modals/` | Close till with cash count |
| `RetailPOS` | `components/pos/` | Full retail POS terminal |
| `RestaurantPOS` | `components/pos/` | Restaurant order POS |
| `KitchenDisplay` | `components/restaurant/` | Live kitchen ticket board |
| `StorefrontUI` | `app/storefront/_components/` | Public-facing storefront shell |

---

## 5. API Documentation

### 5.1 Base URL & Versioning

```
Production:  https://<your-domain>/api/v1/
Development: http://localhost:8000/api/v1/
```

All endpoints are versioned under `/api/v1/`.

### 5.2 Authentication

PrimePOS uses **JWT (JSON Web Token)** bearer authentication via `djangorestframework-simplejwt`.

#### Obtain Tokens

```http
POST /api/v1/auth/login/
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secret"
}
```

**Response `200 OK`:**
```json
{
  "access": "eyJhbGci...",
  "refresh": "eyJhbGci...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "manager",
    "tenant_id": 5
  }
}
```

#### Refresh Access Token

```http
POST /api/v1/auth/token/refresh/
Content-Type: application/json

{ "refresh": "<refresh_token>" }
```

#### Authenticated Request Header

```http
Authorization: Bearer <access_token>
```

### 5.3 Common Response Codes

| Code | Meaning |
|---|---|
| `200 OK` | Successful read |
| `201 Created` | Resource created successfully |
| `204 No Content` | Successful delete |
| `400 Bad Request` | Validation error (body contains field-level errors) |
| `401 Unauthorized` | Missing or invalid token |
| `403 Forbidden` | Insufficient permissions or tenant mismatch |
| `404 Not Found` | Resource does not exist |
| `500 Internal Server Error` | Unhandled server exception |

### 5.4 Standard List Response (Pagination)

```json
{
  "count": 120,
  "next": "https://.../api/v1/products/?page=2",
  "previous": null,
  "results": [ ... ]
}
```

### 5.5 Endpoint Reference

#### 5.5.1 Authentication

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/auth/login/` | Obtain access + refresh tokens |
| `POST` | `/api/v1/auth/token/refresh/` | Refresh access token |
| `POST` | `/api/v1/auth/register/` | Register new tenant + admin user |
| `POST` | `/api/v1/auth/logout/` | Invalidate refresh token |
| `GET` | `/api/v1/auth/me/` | Get current user profile |

#### 5.5.2 Sales

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/sales/` | List sales (scoped to outlet) |
| `POST` | `/api/v1/sales/` | Create a new sale |
| `GET` | `/api/v1/sales/{id}/` | Get sale detail |
| `POST` | `/api/v1/sales/{id}/void/` | Void / cancel a sale |
| `GET` | `/api/v1/sales/{id}/receipt/` | Fetch formatted receipt |
| `POST` | `/api/v1/sales/returns/` | Process a customer return/refund |

**Create Sale — Request:**
```json
{
  "outlet": 15,
  "till": 3,
  "payment_method": "cash",
  "cash_received": "5000.00",
  "customer": 42,
  "items_data": [
    { "product_id": 101, "quantity": 2, "price": "1500.00", "unit_id": 5 }
  ],
  "discount_amount": "0.00",
  "tax_amount": "270.00",
  "total": "3270.00"
}
```

**Create Sale — Response `201`:**
```json
{
  "id": 923,
  "receipt_number": "REC-00923",
  "total": "3270.00",
  "change_given": "1730.00",
  "status": "completed",
  "payment_method": "cash",
  "created_at": "2026-04-14T10:00:00Z"
}
```

#### 5.5.3 Products

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/products/` | List products (`?is_active=true&page_size=50`) |
| `POST` | `/api/v1/products/` | Create product |
| `GET` | `/api/v1/products/{id}/` | Get product detail |
| `PATCH` | `/api/v1/products/{id}/` | Update product fields |
| `DELETE` | `/api/v1/products/{id}/` | Deactivate product |
| `GET` | `/api/v1/products/lookup/` | Barcode / SKU lookup (`?barcode=<value>`) |
| `POST` | `/api/v1/products/bulk-import/` | CSV bulk import |
| `GET` | `/api/v1/products/bulk-export/` | CSV bulk export |

#### 5.5.4 Inventory

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/inventory/` | Stock overview |
| `POST` | `/api/v1/inventory/adjustments/` | Manual stock adjustment |
| `GET` | `/api/v1/inventory/batches/` | List stock batches |
| `GET` | `/api/v1/inventory/low-stock/` | Low-stock alert list |
| `GET` | `/api/v1/inventory/expiry/` | Expiring items |
| `POST` | `/api/v1/inventory/stock-takes/` | Start a stock-take session |
| `POST` | `/api/v1/inventory/transfers/` | Transfer stock between outlets |

#### 5.5.5 Customers

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/customers/` | List customers |
| `POST` | `/api/v1/customers/` | Create customer |
| `GET` | `/api/v1/customers/{id}/` | Customer profile |
| `PATCH` | `/api/v1/customers/{id}/` | Update customer |
| `GET` | `/api/v1/customers/{id}/purchases/` | Purchase history |
| `GET` | `/api/v1/customers/{id}/credit/` | Credit account balance |

#### 5.5.6 Suppliers & Purchase Orders

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/suppliers/` | List suppliers |
| `POST` | `/api/v1/suppliers/` | Create supplier |
| `GET` | `/api/v1/purchase-orders/` | List purchase orders |
| `POST` | `/api/v1/purchase-orders/` | Create purchase order |
| `POST` | `/api/v1/purchase-orders/{id}/receive/` | Mark goods received |
| `GET` | `/api/v1/supplier-invoices/` | List supplier invoices |
| `POST` | `/api/v1/purchase-returns/` | Record purchase return |

#### 5.5.7 Shifts

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/shifts/open/` | Open a new shift |
| `POST` | `/api/v1/shifts/{id}/close/` | Close active shift |
| `GET` | `/api/v1/shifts/` | List shifts |
| `GET` | `/api/v1/shifts/{id}/report/` | Shift cashup report |
| `POST` | `/api/v1/shifts/{id}/cash-movements/` | Record cash in/out |

#### 5.5.8 Restaurant

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/restaurant/tables/` | List tables with status |
| `POST` | `/api/v1/restaurant/tables/` | Create table |
| `POST` | `/api/v1/restaurant/orders/` | Create restaurant order |
| `PATCH` | `/api/v1/restaurant/orders/{id}/` | Update order (add items, change status) |
| `GET` | `/api/v1/restaurant/kitchen/` | Kitchen display queue |
| `POST` | `/api/v1/restaurant/kitchen/{id}/update-status/` | Mark ticket prepared/served |

#### 5.5.9 Bar

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/bar/tabs/` | List open bar tabs |
| `POST` | `/api/v1/bar/tabs/` | Open new bar tab |
| `POST` | `/api/v1/bar/tabs/{id}/add-item/` | Add item to tab |
| `POST` | `/api/v1/bar/tabs/{id}/close/` | Close and charge tab |

#### 5.5.10 Storefront (Public API — no auth)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/storefronts/resolve/?host=<host>` | Resolve storefront by domain |
| `GET` | `/api/v1/storefronts/{slug}/products/` | Public product catalogue |
| `GET` | `/api/v1/storefronts/{slug}/products/{id}/` | Product detail |
| `POST` | `/api/v1/storefronts/{slug}/checkout/create-order/` | Submit checkout order |
| `GET` | `/api/v1/storefronts/{slug}/orders/{ref}/` | Order status tracking |

**Checkout — Request:**
```json
{
  "customer_name": "Mary Phiri",
  "customer_phone": "+265999111222",
  "customer_address": "Area 47, Lilongwe",
  "notes": "Call when near",
  "items": [
    { "product_id": 1001, "quantity": 2 }
  ]
}
```

**Checkout — Response `201`:**
```json
{
  "order": {
    "public_order_ref": "ORD-49CE568B9D",
    "status": "pending",
    "total": "17000.00"
  },
  "whatsapp_url": "https://wa.me/265123456789?text=..."
}
```

#### 5.5.11 Reports

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/reports/sales/` | Sales summary for date range |
| `GET` | `/api/v1/reports/sales/items/` | Item-level sales breakdown |
| `GET` | `/api/v1/reports/sales/categories/` | Category-level sales |
| `GET` | `/api/v1/reports/sales/payments/` | Payment method breakdown |
| `GET` | `/api/v1/reports/cashup/` | Cashup / till reconciliation |
| `GET` | `/api/v1/reports/stock-valuation/` | Inventory value at date |
| `GET` | `/api/v1/reports/profit-loss/` | P&L statement |

All report endpoints accept query parameters: `?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`

#### 5.5.12 Fleet / Distribution

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/fleet/vehicles/` | List vehicles |
| `POST` | `/api/v1/fleet/vehicles/` | Add vehicle |
| `GET` | `/api/v1/fleet/drivers/` | List drivers |
| `POST` | `/api/v1/fleet/trips/` | Create trip |
| `PATCH` | `/api/v1/fleet/trips/{id}/` | Update trip status |
| `GET` | `/api/v1/fleet/deliveries/` | List delivery orders |

#### 5.5.13 Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health/` | Liveness probe (returns `200 OK`) |
| `GET` | `/health/ready/` | Readiness probe (checks DB connectivity) |

#### 5.5.14 Admin (SaaS Super-Admin)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/admin/tenants/` | All tenant list |
| `POST` | `/api/v1/admin/tenants/{id}/suspend/` | Suspend tenant |
| `GET` | `/api/v1/admin/analytics/` | Platform-wide KPIs |
| `POST` | `/api/v1/admin/billing/record-payment/` | Record manual payment |

---

## 6. Testing & Maintenance

### 6.1 Testing Strategy

PrimePOS uses a layered test approach covering unit, integration, and end-to-end scenarios.

#### 6.1.1 Backend Testing (Python / Django)

| Layer | Framework | Scope |
|---|---|---|
| Unit tests | `unittest` / `pytest` | Individual model methods, serializer validation, utility functions |
| Integration tests | Django `TestCase` | ViewSet responses, multi-model business logic (e.g., sale creation + stock decrement) |
| API contract tests | DRF test client | Request/response shape validation for all endpoints |

**Key test areas:**

| Module | Test Focus |
|---|---|
| `sales` | Sale creation, stock deduction, receipt generation, payment splitting |
| `inventory` | Batch expiry logic, stock movement ledger, low-stock detection |
| `accounts` | Login, token refresh, role permission enforcement |
| `tenants` | Tenant isolation — ensure queryset filtering prevents cross-tenant data |
| `storefronts` | Public checkout flow, WhatsApp URL generation, order status |
| `shifts` | Open/close flow, cash movement recording, cashup totals |
| `reports` | Correct aggregation for sales, cashup, stock-valuation |

**Running backend tests:**
```bash
cd backend
python manage.py test apps --verbosity=2
```

Or with pytest:
```bash
cd backend
pytest --tb=short -q
```

#### 6.1.2 Frontend Testing (TypeScript / Next.js)

| Layer | Framework | Scope |
|---|---|---|
| Unit tests | Jest + React Testing Library | Hooks, utility functions, service layer |
| Component tests | React Testing Library | Modal render/submit, form validation |
| E2E tests | Playwright / Cypress | Full user journeys (login → POS → sale → receipt) |

**Key test scenarios:**

| Scenario | Steps |
|---|---|
| Retail sale flow | Login → select outlet → open shift → scan product → complete cash sale → print receipt |
| Restaurant order flow | Login → create table order → send to KDS → mark served → close order |
| Online storefront order | Visit public storefront → add to cart → checkout → receive WhatsApp confirmation |
| Inventory receipt | Receive purchase order → stock increases → stock movement recorded |
| Low-stock alert | Set threshold → reduce stock below threshold → alert appears in dashboard |
| Shift reconciliation | Open shift → make sales → close shift → cashup report matches |

**Running frontend tests:**
```bash
cd frontend
npm run test
```

#### 6.1.3 End-to-End Test Guide

Refer to `docs/END_TO_END_TESTING_GUIDE.md` and `docs/CRITICAL_BLOCKERS_TEST_GUIDE.md` for environment setup and full scenario walkthroughs.

### 6.2 Quality Assurance Process

```
Feature Branch
     │
     ▼
Local dev test (manual + unit tests)
     │
     ▼
Pull Request → GitHub Actions CI
  - Lint (ESLint for frontend, flake8/ruff for backend)
  - Unit test suite
  - Build check (Next.js build)
     │
     ▼
Code Review
     │
     ▼
Merge to main
     │
     ▼
Auto-deploy: Render (backend) + Vercel (frontend)
     │
     ▼
Smoke test on staging
     │
     ▼
Production release
```

### 6.3 Environment Configuration

| Variable | Component | Description |
|---|---|---|
| `SECRET_KEY` | Backend | Django secret key (required) |
| `DATABASE_URL` | Backend | PostgreSQL connection string |
| `ALLOWED_HOSTS` | Backend | Comma-separated allowed hostnames |
| `CORS_ALLOWED_ORIGINS` | Backend | Comma-separated frontend origins |
| `REDIS_URL` | Backend | Celery/Redis broker URL |
| `CLOUDINARY_URL` | Backend | Media storage URL |
| `SENTRY_DSN` | Backend + Frontend | Error reporting DSN |
| `TENANT_BASE_DOMAIN` | Backend | Root domain for tenant subdomains |
| `NEXT_PUBLIC_API_URL` | Frontend | Backend API base URL |
| `NEXT_PUBLIC_OFFLINE_MODE_ENABLED` | Frontend | Enable offline mode (`true`/`false`) |
| `NEXT_PUBLIC_OFFLINE_MODE_PHASE` | Frontend | Offline mode phase (`0`, `1`, `2`) |
| `OFFLINE_MODE_ENABLED` | Backend | Backend offline sync handler flag |

Full reference: `backend/.env.example`

### 6.4 Deployment Runbook

1. **Backend (Render)**
   - Service type: Web Service (Docker or Python)
   - Build command: `pip install -r requirements.txt`
   - Start command: `gunicorn primepos.wsgi:application --bind 0.0.0.0:$PORT`
   - Run migrations on deploy: `python manage.py migrate --run-syncdb`
   - Static files: served by WhiteNoise (no separate static server needed)
   - Health check URL: `/health/ready/`

2. **Frontend (Vercel)**
   - Framework: Next.js
   - Build command: `npm run build`
   - Output directory: `.next`
   - Set all `NEXT_PUBLIC_*` environment variables in Vercel dashboard

3. **Database**
   - PostgreSQL (Render managed or external)
   - Run `python manage.py migrate` on first deploy and after schema changes
   - Backup strategy: daily automated snapshots (Render feature)

Full checklist: `docs/DEPLOYMENT_CHECKLIST_READY.md`

### 6.5 Monitoring & Observability

| Concern | Tool | Details |
|---|---|---|
| Error tracking | Sentry | Frontend + backend SDK; captures exceptions with stack traces and release context |
| Health probes | `/health/` & `/health/ready/` | Used by Render orchestration for liveness/readiness |
| Audit trail | Activity Logs module | All user actions recorded in `activity_logs` app |
| Logging | Django logging | INFO/WARNING/ERROR to stdout (captured by Render logs) |
| Uptime monitoring | External ping (recommended) | Monitor `/health/ready/` at 1-minute intervals |

### 6.6 Long-Term Maintenance Strategy

#### Routine Tasks

| Frequency | Task |
|---|---|
| Daily | Review Sentry error inbox; triage new issues |
| Weekly | Review low-stock alerts and expiry warnings via dashboard |
| Monthly | Review Celery task queue health; check failed tasks |
| Monthly | Database backup verification |
| Per release | Run full test suite; review migration plan; update changelog |

#### Security Maintenance

- Rotate `SECRET_KEY` if exposure is suspected.
- Keep `djangorestframework-simplejwt` and `django-cors-headers` up to date for security patches.
- Audit `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` on domain changes.
- Review JWT token expiry settings (`ACCESS_TOKEN_LIFETIME`, `REFRESH_TOKEN_LIFETIME`) in `settings/base.py`.
- Monitor Cloudinary storage usage and access logs.

#### Database Maintenance

- Index review: query-heavy tables (`sales`, `inventory_batch`, `stock_movements`) have composite indexes defined; revisit after significant data growth.
- Run `VACUUM ANALYZE` on PostgreSQL periodically (Render automates this for managed instances).
- Archive old `activity_logs` and `stock_movements` records after configurable retention period.

#### Dependency Upgrades

- Pin major versions in `requirements.txt` and `package.json`.
- Test upgrades in a staging environment before production.
- Priority upgrade targets: Django, Next.js, Sentry SDK (security-sensitive).

#### Feature Flag Rollout (Offline Mode)

When rolling out Offline Mode Phase 1 to production:
1. Enable `NEXT_PUBLIC_OFFLINE_MODE_ENABLED=true` and `NEXT_PUBLIC_OFFLINE_MODE_PHASE=1` in Vercel.
2. Enable `OFFLINE_MODE_ENABLED=true` in Render.
3. Monitor service worker registration errors in Sentry.
4. Monitor `/api/v1/sync/` endpoint health.
5. Roll back by setting phase back to `0` if anomalies are detected.

Reference: `docs/OFFLINE_MODE_README.md`, `docs/OFFLINE_MODE_PRODUCTION_READINESS.md`

---

*End of Technical Design Document — PrimePOS v1.1.0*
