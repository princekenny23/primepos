# PrimePOS - Professional SaaS Multi-Tenant POS System

**Maturity Level**: Production Ready (MVP+)  
**Version**: 1.1.0  
**Last Updated**: March 28, 2026  
**Target Users**: Retail stores, restaurants, bars, wholesale businesses in Africa/Global  
**Deployment**: Render (Backend) + Vercel (Frontend)  

## 🎯 Project Overview

PrimePOS is a **full-stack, multi-tenant SaaS Point of Sale system** designed to serve small and medium-sized businesses. It supports multiple business types (retail, restaurant, bar, wholesale) with a **single unified codebase** that scales per tenant with configurable features (tax, pricing, outlets, staff limits).

**Recent Progress (Mar 2026):**
- ✅ Removed all success toast/popup notifications across 26+ frontend files (errors preserved)
- ✅ Added system actions menu (vertical dots) to navbar — Refresh & Sync All
- ✅ Reports — Cashup: removed Action column, Log State button, outlet filter dropdown; added Export Data button
- ✅ Reports — Stock Valuation: removed outlet & category filters; replaced with single date-range button + preset modal
- ✅ Reports — Sales (all tabs): outlet filter dropdown removed; reports auto-scoped to current outlet via store
- ✅ Outlet filtering now implicit — all reports use `currentOutlet` automatically, no manual selection required
- ✅ Accessibility fixes — radio inputs in tax-pricing settings now have proper title attributes
- ✅ System User Guide & Training Playbook created (`docs/SYSTEM_USER_GUIDE_AND_TRAINING_PLAYBOOK.md`)
- ✅ All code pushed to GitHub

### Offline Mode Rollout Status (Mar 2026)
- ✅ Phase 0 implemented (feature flags, offline status store, backend sync route scaffolding)
- ✅ Phase 1 implemented (service worker registration + read cache strategy skeleton)
- ✅ Phase 2 foundation implemented (offline outbox queue, idempotent server event persistence, cursor-based pull scaffold)
- ✅ Existing business logic untouched by default (offline remains disabled until flags are enabled)

Offline implementation + testing guide:
- `docs/OFFLINE_MODE_README.md`

Enable flags when ready:
- Frontend: `NEXT_PUBLIC_OFFLINE_MODE_ENABLED=true`, `NEXT_PUBLIC_OFFLINE_MODE_PHASE=1`
- Backend: `OFFLINE_MODE_ENABLED=true`, `OFFLINE_MODE_PHASE=1`

Phase controls:
- `0`: disabled (default, no runtime behavior change)
- `1`: read-only offline foundation (status indicator + service worker cache)
- `2+`: reserved for transactional outbox sync rollout

### What PrimePOS Does
✅ **Multi-Tenant SaaS**: Each customer isolated, independent configuration  
✅ **Point of Sale**: Fast checkout, multiple payment methods (cash, card, mobile money)  
✅ **Inventory Management**: Real-time stock tracking, product variations, units management  
✅ **Business Analytics**: Comprehensive reports, sales trends, inventory insights  
✅ **Multi-Outlet Support**: Manage multiple locations from one account  
✅ **Role-Based Access Control**: Admin, Manager, Cashier, Staff roles with permissions  
✅ **Restaurant/Bar Features**: Table management, kitchen display, order tracking  
✅ **Customer Management**: Profile tracking, purchase history, credit management  
✅ **Health Checks**: Production readiness probes for orchestration platforms  
✅ **Environment Validation**: Fail-fast configuration checking on startup  

### Production Readiness Checklist
- ✅ **Health endpoints** - `/health/` (liveness), `/health/ready/` (readiness with DB check)
- ✅ **Environment validation** - Checks SECRET_KEY, DATABASE, ALLOWED_HOSTS, CORS on startup
- ✅ **Multi-tenant middleware** - Automatic tenant isolation per request
- ✅ **JWT authentication** - Secure token-based auth with refresh tokens
- ✅ **CORS configured** - Cross-origin request handling
- ✅ **Static files** - WhiteNoise for production serving
- ✅ **Error handling** - Comprehensive exception handling
- ✅ **Logging** - Activity tracking, login/logout logs
- ✅ **Database migrations** - All models migrated and ready
- ⏳ **Post-launch improvements** - Critical modals/features listed below

### Deployment Status
- ✅ **Backend**: Ready for Render deployment (render.yaml configured)
- ✅ **Frontend**: Ready for Vercel deployment (vercel.json configured)
- ✅ **Database**: PostgreSQL configured and ready
- ✅ **Environment variables**: .env.example provided with all required fields
- 🚀 **Ready to Deploy**: Both frontend and backend are production-ready

---

## 🛠️ Tech Stack

### **Backend**
| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Django + Django REST Framework | 4.2.7 + 3.14.0 |
| Authentication | JWT (djangorestframework-simplejwt) | 5.3.0 |
| Database | PostgreSQL (prod) / SQLite (dev) | Latest |
| Task Queue | Celery + Redis | 5.3.4 + 5.0.1 |
| Image Processing | Pillow | Latest |
| Data Export | Pandas + OpenPyXL | Latest |
| Real-time | Django Channels | 4.0.0 |

### **Frontend**
| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Next.js (React) | 14.2.5 / 18.3.1 |
| Language | TypeScript | 5.5.4 |
| Styling | Tailwind CSS | 3.4.7 |
| UI Components | Radix UI | Latest |
| State Management | Zustand | 5.0.8 |
| Charts | Recharts | 2.15.4 |
| Icons | Lucide React | Latest |
| Printing | QZ-Tray | 2.2.5 |

---

## 🏗️ System Architecture

### **High-Level Flow**
```
┌─────────────────────────────────────────┐
│   User Browser (Next.js 3000)           │
│   - UI Components (React)               │
│   - State Management (Zustand)          │
│   - API Client                          │
└──────────────┬──────────────────────────┘
               │
        HTTP/REST (JSON)
               │
┌──────────────▼──────────────────────────┐
│  Django REST API (8000)                 │
│  - Authentication (JWT)                 │
│  - Tenant Isolation Middleware          │
│  - Business Logic (Services)            │
│  - Database ORM                         │
└──────────────┬──────────────────────────┘
               │
         Database Layer
               │
┌──────────────▼──────────────────────────┐
│  PostgreSQL Database                    │
│  - Tenant data isolated                 │
│  - Outlet-specific stock tracking       │
│  - Transaction logs                     │
└─────────────────────────────────────────┘
```

### **Multi-Tenant Architecture**
Every request goes through the **TenantMiddleware** which:
1. Extracts tenant ID from JWT token
2. Filters all database queries to tenant's data only
3. Prevents cross-tenant data leakage

**Key Data Isolation Points:**
- `Tenant` - Root business entity
- `Outlet` - Physical location (multi-outlet support per tenant)
  - Each outlet can have its own `business_type` (retail, restaurant, bar, wholesale_and_retail)
  - Each outlet has configurable `settings` (posMode, receiptTemplate, taxEnabled, taxRate, etc.)
  - Operational modules (POS, dashboard, inventory) gated and filtered by outlet business type
- All models have `tenant = ForeignKey(Tenant)`

**Outlet Business Type System:**
- Each outlet independently selects its business type (restaurant, bar, retail, etc.)
- Outlet settings are derived from business type + custom configuration
- Frontend routing (POS pages, dashboard layouts) determined by outlet posMode
- Inventory, reports, and operational features filtered per outlet with business-type-specific logic

### **Authentication Flow**
```
1. User logs in (POST /auth/login/)
2. Backend validates credentials
3. JWT token generated with tenant_id + user_id
4. Frontend stores token in localStorage/cookie
5. All subsequent requests include Authorization header
6. Backend validates token and extracts tenant context
```

### **Request Lifecycle**
```
Request → TenantMiddleware (extract tenant) 
        → Permission Check (role-based)
        → ViewSet/APIView
        → Service Layer (business logic)
        → Database Query (filtered by tenant)
        → Serializer (response formatting)
        → Response
```

---

## � CRITICAL MODAL FIXES - POST DEPLOYMENT

| Priority | Modal/Feature | Issue | Impact | Week | Est. Time | Notes |
|----------|---------------|-------|--------|------|-----------|-------|
| 🔴 **P0** | **Payment Processing Modal** | Cash only, card/mobile not functional | Can't accept payments | Wk1 | 40 hrs | Integrate Stripe, M-Pesa, integrate with Payment Service |
| 🔴 **P0** | **Receipt Printing/PDF** | Preview works, printing/PDF export missing | Customers can't get receipts | Wk1 | 30 hrs | QZ-Tray printing, PDF generation (pdfkit), email receipts |
| 🔴 **P0** | **Rate Limiting** | No API rate limits (abuse risk) | DDoS/spam vulnerability | Wk1 | 20 hrs | Implement django-ratelimit per tenant |
| 🟠 **P1** | **Backend RBAC Enforcement** | Permissions defined but not enforced on every view | Security risk (users can access unauthorized endpoints) | Wk1 | 35 hrs | Add `@requires_permission` decorator to all viewsets |
| 🟠 **P1** | **Centralized Exception Handling** | Inconsistent error responses | Poor API contract, hard debugging | Wk1 | 25 hrs | Create DRF exception handler class, format all errors uniformly |
| 🟠 **P1** | **Error Tracking (Sentry)** | No production error visibility | Can't diagnose failures in production | Wk1 | 15 hrs | Set up Sentry, add to INSTALLED_APPS, configure webhooks |
| 🟠 **P1** | **Async Tasks (Celery+Redis)** | Long operations block requests | Poor UX (reports, bulk imports timeout) | Wk2 | 45 hrs | Configure Celery, implement task queue for reports/imports/emails |
| 🟠 **P1** | **Email Notifications** | No email on actions (password reset, invoices) | Users can't receive critical messages | Wk2 | 30 hrs | SendGrid setup, email templates, signal handlers |
| 🟠 **P1** | **Invoice/Billing System** | Structure ready, PDF/email not implemented | Can't send formal invoices to customers | Wk2 | 35 hrs | PDF generation, scheduled invoice creation, email delivery |
| 🟡 **P2** | **Advanced Analytics Dashboard** | Basic reports only, no trend analysis | Limited business insights | Wk2 | 50 hrs | Add charting, trend analysis, export capabilities |
| 🟡 **P2** | **Barcode Scanner Integration** | Hardware integration framework missing | Manual entry only, slower POS | Wk2 | 25 hrs | Implement barcode reader input handler |
| 🟡 **P2** | **Loyalty Program Module** | Not implemented | Can't track customer rewards | Wk3 | 40 hrs | Points system, redemption, tier management |
| 🟡 **P2** | **Credit/Accounts Receivable Management** | Model exists, UI not implemented | Can't track customer credit | Wk3 | 35 hrs | Payment tracking, aging reports, reminders |
| 🟡 **P2** | **Multi-Language Support** | i18n framework ready, only English | Can't serve non-English markets | Wk3 | 30 hrs | Add French, Swahili, Portuguese translations |
| 🟡 **P2** | **Inventory Audit Trail** | No historical tracking | Can't trace stock discrepancies | Wk3 | 20 hrs | Add InventoryAudit model, signal handlers |
| 🟡 **P2** | **Bulk Import (CSV/Excel)** | Not fully tested | Data migration for clients difficult | Wk3 | 25 hrs | Test with real data, validation, error handling |
| 🟢 **P3** | **Mobile App (React Native)** | Not in scope for MVP | Desktop/tablet only | Wk4+ | 80 hrs | Consider for future release |
| 🟢 **P3** | **Price List Management** | Not implemented | Can't manage customer-specific pricing | Wk4+ | 30 hrs | Price list model, application logic |
| 🟢 **P3** | **Supplier Management** | Basic structure, ordering not implemented | Can't automate restocking | Wk4+ | 35 hrs | Purchase order system, receipt tracking |
| 🟢 **P3** | **Kitchen Display System (KDS)** | Restaurant orders visible, KDS not optimized | Slow kitchen workflow | Wk4+ | 25 hrs | Optimize display, timing controls |

### Priority Explanation
- **🔴 P0 (Critical)**: Blocks primary use cases, launch blockers - implement in **Week 1**
- **🟠 P1 (High)**: Security/stability issues, poor UX - implement in **Week 1-2**
- **🟡 P2 (Medium)**: Feature gaps, lower UX impact - implement in **Week 2-3**
- **🟢 P3 (Low)**: Nice-to-have, future releases - implement in **Week 4+**

### Week 1 Action Items (Before First Paying Customer)
1. Integrate Stripe + M-Pesa payment gateways
2. Implement receipt PDF/printing
3. Add API rate limiting
4. Enforce RBAC on all endpoints
5. Set up Sentry error tracking
6. Create centralized exception handler

### Week 2-3 Action Items (First Month)
1. Implement Celery + Redis for async tasks
2. Set up email notification system
3. Complete billing/invoice system with PDF
4. Build advanced analytics dashboard
5. Add barcode scanner support

---

## �📁 Frontend Architecture (Next.js)

### **Folder Structure**
```
frontend/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Home/landing page
│   ├── auth/                    # Authentication pages
│   │   ├── login/
│   │   ├── register/
│   │   └── onboarding/          # Business setup wizard
│   ├── dashboard/               # Main dashboard
│   │   ├── page.tsx
│   │   ├── settings/
│   │   └── [tenant]/            # Tenant-specific pages
│   ├── pos/                     # Point of Sale (main feature)
│   │   ├── retail/              # Retail checkout flow
│   │   ├── restaurant/          # Restaurant/table management
│   │   ├── bar/                 # Bar-specific POS
│   │   └── single-product/      # Simple checkout for limited SKU
│   ├── admin/                   # Admin section
│   ├── select-business/         # Business selection page
│   └── providers.tsx            # Global context providers
│
├── components/                  # React components (organized by feature)
│   ├── ui/                      # Base UI components (buttons, inputs, etc.)
│   ├── modals/                  # Modal dialogs
│   │   ├── payment-modal.tsx    # Payment processing UI
│   │   ├── receipt-preview-modal.tsx
│   │   └── ...
│   ├── pos/                     # POS-specific components
│   │   ├── product-grid.tsx     # Product selector
│   │   ├── cart-display.tsx     # Current order display
│   │   ├── checkout-panel.tsx   # Final payment
│   │   └── ...
│   ├── dashboard/               # Dashboard components
│   ├── reports/                 # Reporting UI
│   ├── settings/                # Settings/config UI
│   └── layouts/                 # Layout wrappers
│
├── lib/                         # Utilities & logic (non-component)
│   ├── api.ts                   # API client setup (axios/fetch wrapper)
│   ├── services/                # Business logic service layer
│   │   ├── authService.ts       # Login, logout, token refresh
│   │   ├── tenantService.ts     # Business management
│   │   ├── saleService.ts       # Checkout, sale operations
│   │   ├── productService.ts    # Product queries
│   │   ├── inventoryService.ts  # Stock operations
│   │   ├── reportService.ts     # Analytics data
│   │   ├── paymentService.ts    # Payment processing
│   │   └── ... (31+ services total)
│   ├── hooks/                   # Custom React hooks
│   ├── types/                   # TypeScript type definitions
│   ├── utils/                   # Helper functions
│   └── i18n/                    # Internationalization
│
├── stores/                      # Zustand state management
│   ├── authStore.ts             # User auth state
│   ├── businessStore.ts         # Tenant/outlet state
│   ├── posStore.ts              # Current POS order state
│   └── qzStore.ts               # Print queue state
│
├── contexts/                    # React Context API
│   ├── tenant-context.tsx       # Tenant data provider
│   ├── shift-context.tsx        # Current shift state
│   ├── role-context.tsx         # User role/permissions
│   ├── i18n-context.tsx         # Language/localization
│   └── qz-context.tsx           # Printer integration
│
├── locales/                     # Multi-language support
│   ├── en/                      # English translations
│   └── ny/                      # Chichewa translations
│
└── package.json                 # Dependencies

```

### **Data Flow Pattern**
```
User Action (click button)
    ↓
Component State Update
    ↓
Call Service Layer (e.g., saleService.createSale())
    ↓
API Call (GET/POST to backend)
    ↓
Update Zustand Store (global state)
    ↓
Component Re-render (using useStore hook)
    ↓
UI Updated with new data
```

### **How API Calls Work**
1. **Service Layer** (`lib/services/`) - Encapsulates all API logic
   - Each service corresponds to a backend app (saleService, productService, etc.)
   - Methods handle request/response, error handling, data transformation
   - Example: `saleService.createSale(items, paymentMethod)` → HTTP POST to `/api/v1/sales/`

2. **API Client** (`lib/api.ts`) - Central HTTP configuration
   - Manages JWT token injection into Authorization header
   - Handles 401 responses (token expiry)
   - Base URL configuration

3. **Components** - Only interact with services
   - `const { createSale } = saleService`
   - Never direct HTTP calls in components

### **Component Hierarchy (POS Example)**
```
<POS Page>
  ├── <ProductGrid>           ← Browse products
  ├── <CartDisplay>           ← Current items
  │   └── <CartItem>          ← Individual line items
  ├── <CheckoutPanel>         ← Total & payment method
  │   └── <PaymentModal>      ← Payment details
  │       ├── <CashPayment>
  │       ├── <CardPayment>   (disabled - pending integration)
  │       └── <MobileMoneyPayment> (disabled - pending integration)
  └── <ReceiptPreviewModal>   ← Print/download
```

---

## 🔌 Backend Architecture (Django)

### **Backend Apps Overview (18 Apps)**

| App | Purpose | Key Models | Status |
|-----|---------|-----------|--------|
| `health` | Liveness & readiness probes | HealthCheck | ✅ Production Ready |
| `tenants` | Multi-tenant management | Tenant | ✅ Fully Implemented |
| `accounts` | Users & authentication | User, Role | ✅ Fully Implemented |
| `products` | Product catalog | Product, Category, ItemVariation | ✅ Fully Implemented |
| `outlets` | Business locations | Outlet, Till | ✅ Fully Implemented |
| `sales` | **CORE: Transactions** | Sale, SaleItem, SaleRefund | ✅ Fully Implemented |
| `inventory` | **CORE: Stock tracking** | LocationStock, InventoryMovement | ✅ Fully Implemented |
| `customers` | Customer profiles | Customer, CustomerCredit | ✅ Fully Implemented |
| `shifts` | Cash reconciliation | Shift, ShiftRegister | ✅ Fully Implemented |
| `restaurant` | Restaurant-specific | Table, KitchenOrder | ✅ Fully Implemented |
| `bar` | Bar-specific | BarOrder, Bartender | ✅ Implemented |
| `staff` | Employee management | StaffProfile, StaffRole | ✅ Fully Implemented |
| `suppliers` | Supplier management | Supplier, PurchaseOrder | ⚠️ Partial |
| `expenses` | Expense tracking | Expense, ExpenseCategory | ✅ Fully Implemented |
| `quotations` | Price quotes | Quotation | ✅ Fully Implemented |
| `reports` | Analytics & reporting | Various reports | ✅ Basic Reports |
| `notifications` | Email & SMS | Notification | ⏳ Pending Integration |
| `activity_logs` | Audit trail | ActivityLog | ✅ Fully Implemented |

### **Backend Folder Structure**
```
backend/
├── primepos/                    # Django project config
│   ├── settings/
│   │   ├── base.py             # All settings (prod-safe)
│   │   ├── startup.py          # Production validation
│   │   └── local.py            # Development overrides
│   ├── urls.py                  # Root routing
│   ├── wsgi.py                  # Production ASGI
│   ├── asgi.py                  # WebSocket support
│   └── router.py                # DRF ViewSet routing
│
├── apps/                        # Feature apps (18 total)
│   ├── health/                  ✅ NEW: Health checks for Render
│   ├── tenants/                 ✅ Multi-tenant isolation
│   ├── accounts/                ✅ Auth & user management
│   ├── products/                ✅ Product catalog + variations
│   ├── inventory/               ✅ Stock tracking per outlet
│   ├── sales/                   ✅ Transaction processing
│   ├── customers/               ✅ Customer profiles + credit
│   ├── outlets/                 ✅ Store locations + tills
│   ├── shifts/                  ✅ Cash register shifts
│   ├── staff/                   ✅ Employee management
│   ├── restaurant/              ✅ Table + kitchen orders
│   ├── bar/                     ✅ Bar POS + orders
│   ├── expenses/                ✅ Expense tracking
│   ├── reports/                 ✅ Analytics & dashboards
│   ├── activity_logs/           ✅ Audit trail
│   ├── notifications/           ⏳ Email/SMS (pending impl)
│   ├── quotations/              ✅ Price quotes
│   └── suppliers/               ⚠️ Partial implementation
│
├── docs/                        # Documentation (27 files)
│   ├── SAAS_ONBOARDING_GUIDE.md # Multi-tenant signup
│   ├── TAX_MANAGEMENT.md        # Tax configuration by tenant
│   ├── CRITICAL_BLOCKERS_FIXED.md
│   ├── DEPLOYMENT_CHECKLIST_READY.md
│   └── ... (detailed implementation guides)
│
├── requirements.txt             # Python dependencies
├── manage.py                    # Django CLI
├── render.yaml                  # Render.com deployment config
├── .env.example                 # Environment variable template
└── pyrightconfig.json           # Type checking config
```

### **Key Design Patterns**

**1. Multi-Tenant Isolation**
```python
# TenantMiddleware automatically filters all queries
class TenantMiddleware:
    def __call__(self, request):
        # Extract tenant from JWT token
        request.tenant = get_tenant_from_token(request)
        # All subsequent queries filtered by this tenant
```

**2. Service Layer Architecture**
```python
# Business logic isolated from views
class SaleService:
    @staticmethod
    def create_sale(tenant, items, payment_method):
        # Atomic transaction: create sale + deduct stock
        with transaction.atomic():
            sale = Sale.objects.create(...)
            for item in items:
                deduct_inventory(item)
            trigger_notifications(sale)
        return sale
```

**3. Permission Checks**
```python
# Role-based access control
class SaleViewSet(viewsets.ModelViewSet):
    @requires_permission('can_sales')
    def create(self, request):
        # Only users with 'can_sales' permission
        return super().create(request)
```

---

## 🔌 Frontend Architecture (Next.js)

### **Folder Structure**
```
frontend/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Home/landing page
│   ├── auth/                    # Authentication pages
│   │   ├── login/
│   │   ├── register/
│   │   └── onboarding/          # Business setup wizard
│   ├── dashboard/               # Main dashboard
│   │   ├── page.tsx
│   │   ├── settings/
```│   │   │   ├── deduct_stock()   # Called from sale service
│   │   │   └── adjust_stock()
│   │   └── urls.py
│   │
│   ├── payments/                # Payment processing
│   │   ├── models.py
│   │   │   ├── Payment          # Transaction record
│   │   │   ├── PaymentMethod    # Available payment types
│   │   │   └── PaymentSplit     # Multi-payment per sale
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── services.py
│   │   │   ├── process_cash_payment() ✅ DONE
│   │   │   ├── process_card_payment() ❌ TODO (Stripe/Square/Paystack)
│   │   │   └── process_mobile_money() ❌ TODO (M-Pesa/Airtel)
│   │   └── urls.py
│   │
│   ├── customers/               # Customer management & credit
│   │   ├── models.py
│   │   │   ├── Customer         # Customer profile
│   │   │   ├── CustomerGroup    # Grouping/tiering
│   │   │   └── CreditLimit      # Credit policy
│   │   ├── serializers.py
│   │   └── views.py
│   │
│   ├── shifts/                  # Cash reconciliation
│   │   ├── models.py
│   │   │   ├── Shift            # Work period
│   │   │   │   ├── user
│   │   │   │   ├── outlet
│   │   │   │   ├── opening_time
│   │   │   │   ├── closing_time
│   │   │   │   ├── opening_balance (cash)
│   │   │   │   └── closing_balance (reconciled)
│   │   │   ├── CashDrawerSession # Per-shift cash tracking
│   │   │   ├── CashMovement     # Immutable cash ledger
│   │   │   ├── PettyCashPayout  # Expense tracking
│   │   │   └── CashupSettlement # End-of-day settlement
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── services.py
│   │
│   ├── restaurant/              # Restaurant-specific features
│   │   ├── models.py
│   │   │   ├── Table            # Seating layout
│   │   │   ├── KitchenOrderTicket (KOT)
│   │   │   └── KOTItem          # Line items in KOT
│   │   ├── serializers.py
│   │   ├── views.py
│   │   │   └── KitchenDisplaySystem (WebSocket)
│   │   └── urls.py
│   │
│   ├── suppliers/               # Supplier management
│   ├── purchases/               # Purchase orders (partially implemented)
│   ├── reports/                 # Analytics & dashboards
│   ├── staff/                   # Staff/employee management
│   ├── expenses/                # Expense tracking
│   ├── notifications/           # System notifications
│   ├── activity_logs/           # Audit trail
│   └── admin/                   # Admin-specific features
│
├── requirements.txt             # Python dependencies
├── manage.py                    # Django CLI
└── db.sqlite3 / postgres        # Database file (dev/prod)
```

### **Core Models & Responsibilities**

#### **1. Tenant** (Multi-tenancy root)
- Represents one business/customer
- Isolates all data
- Contains business settings (currency, business type, etc.)

#### **2. Sale** (Transaction)
- Core transaction record
- Links: Tenant → Outlet → User (cashier)
- Tracks: Items, total, payment method, status, customer (optional)
- Restaurant: Links to Table + creates KOT

#### **3. LocationStock** (Inventory)
- **Per-outlet, per-variation** stock levels
- Updated atomically on sale
- Supports multi-outlet businesses

#### **4. Shift** (Cash management)
- Work period for a cashier
- Cash reconciliation (opening + sales + adjustments = closing)
- Prevents data leakage across shifts

#### **5. Outlet** (Multi-location)
- Physical store location
- Each business can have multiple outlets
- Stock, customers, and sales are outlet-specific

### **Request Validation & Error Handling**

**Serializer Validation:**
```python
class SaleSerializer(serializers.ModelSerializer):
    # Built-in validators
    items = SaleItemSerializer(many=True, required=True)
    total = serializers.DecimalField(max_digits=10, decimal_places=2)
    payment_method = serializers.ChoiceField(choices=['cash', 'card', 'mobile'])
    
    def validate_items(self, items):
        if not items:
            raise ValidationError("Sale must have at least one item")
        return items
```

**Service Layer Error Handling:**
```python
def create_sale(sale_data, items_data):
    try:
        with transaction.atomic():
            # Create sale
            # Deduct stock
            # Create sale items
            # Return success
    except InsufficientStockError:
        raise ValidationError("Item XXX out of stock")
    except Exception as e:
        # Log error
        raise APIError(str(e))
```

### **Permissions & Roles**

**Role-Based Access Control:**
- Tenant has custom roles (Admin, Manager, Cashier, etc.)
- Each role has specific permissions (can_create_sale, can_view_reports, etc.)
- Permission checked in ViewSet `check_permissions()`

**Multi-Tenant Data Isolation:**
```python
class SaleViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        # Middleware sets request.tenant
        return Sale.objects.filter(tenant=request.tenant)
```

---

## 🚀 Setting Up Development Environment

### **Prerequisites**
- Python 3.8+ (3.10+ recommended)
- Node.js 18+ (20+ recommended)
- PostgreSQL 12+ (optional for dev, can use SQLite)
- Git

### **Backend Setup**

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv env
# Windows:
env\Scripts\activate
# Linux/Mac:
source env/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file with:
# SECRET_KEY=your-dev-key-here
# DEBUG=True
# DATABASE_URL=sqlite:///db.sqlite3  (or postgres://...)
# CORS_ALLOWED_ORIGINS=http://localhost:3000

# Run migrations
python manage.py migrate

# Create superuser (admin account)
python manage.py createsuperuser

# Load sample data (optional)
python manage.py loaddata sample_tenants sample_products

# Start development server
python manage.py runserver
# Server runs at http://localhost:8000
```

### **Frontend Setup**

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Create .env.local with:
# NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
# NEXT_PUBLIC_USE_REAL_API=true

# Run development server
npm run dev
# App runs at http://localhost:3000

# Linting (optional)
npm run lint

# Production build (optional)
npm run build
npm run start
```

### **Database Setup (PostgreSQL)**

```bash
# Create database
createdb primepos

# Update .env:
DATABASE_URL=postgresql://user:password@localhost:5432/primepos

# Run migrations
python manage.py migrate
```

### **Verify Setup**
- Backend: Navigate to http://localhost:8000/api/v1/ → Should see API listing
- Frontend: Navigate to http://localhost:3000 → Should see login page
- Try creating a test tenant and user through admin panel

---

## 💡 Development Rules

### **Adding a New Feature**

**Step 1: Backend**
```
1. Create models in apps/[feature]/models.py
2. Create migrations: python manage.py makemigrations
3. Create serializers in apps/[feature]/serializers.py
4. Create ViewSet in apps/[feature]/views.py
5. Register in apps/[feature]/urls.py and primepos/urls.py
6. Add admin.py registration
7. Write tests
```

**Step 2: Frontend**
```
1. Create service in lib/services/[feature]Service.ts
2. Create components in components/[feature]/
3. Create pages in app/[feature]/ (if needed)
4. Add routes to app layout
5. Add to navigation/sidebar
```

**Step 3: Multi-tenant Compliance**
```
✅ Add tenant filter to get_queryset()
✅ Include tenant in serializer
✅ Validate tenant ownership before operations
❌ Never query across tenants
```

### **Code Organization Rules**

| Layer | Location | Responsibility |
|-------|----------|-----------------|
| **API Endpoint** | `apps/[feature]/views.py` | HTTP request handling, permission checks |
| **Business Logic** | `apps/[feature]/services.py` | Complex operations, transactions, validation |
| **Database** | `apps/[feature]/models.py` | Data structure, relationships |
| **Request/Response** | `apps/[feature]/serializers.py` | Input validation, output formatting |
| **Routes** | `apps/[feature]/urls.py` | URL patterns |
| **UI Component** | `frontend/components/[feature]/` | Visual rendering |
| **API Call Logic** | `frontend/lib/services/[feature]Service.ts` | HTTP requests, data transformation |
| **Global State** | `frontend/stores/` or `contexts/` | Shared data across components |

### **What NOT to Touch Without Refactoring**

⚠️ **TenantMiddleware** - If changing how tenant isolation works, update ALL views  
⚠️ **User Model** - Changing auth will break login across all apps  
⚠️ **LocationStock Model** - Critical for inventory; changes require migration  
⚠️ **Sale/SaleItem Models** - Core transaction; changes affect payments, reporting, inventory  
⚠️ **API Request Format** - Changing JSON structure breaks all frontend calls  

---

## 📊 Core Features & Completion Status

### **✅ COMPLETE & PRODUCTION-READY**

| Feature | Backend | Frontend | Notes |
|---------|---------|----------|-------|
| Multi-tenant architecture | ✅ | ✅ | Complete data isolation |
| User authentication (JWT) | ✅ | ✅ | Secure token-based auth |
| Product management | ✅ | ✅ | Supports variations (sizes, colors, etc.) |
| Item variations (Square POS compatible) | ✅ | ✅ | Per-variation stock, pricing, SKU, barcode |
| Cash sales/checkout | ✅ | ✅ | Atomic transaction with stock deduction |
| Multi-outlet support | ✅ | ✅ | Per-outlet stock tracking, outlet-specific business type |
| Outlet business type selection | ✅ | ✅ | Each outlet can have retail/restaurant/bar/wholesale type with specific settings |
| Outlet-specific operational modules | ✅ | ✅ | POS, dashboard, inventory operations respect outlet business type |
| Inventory management | ✅ | ✅ | Location-based stock, movements, transfers, outlet-filtered queries |
| Receipt generation | ✅ | ⚠️ | Preview done; print/PDF pending |
| Customer management | ✅ | ✅ | Profiles, purchase history |
| Credit sales (accounts receivable) | ✅ | ✅ | Credit limit validation, payment tracking |
| Shift management & cash reconciliation | ✅ | ✅ | Opening/closing, cash validation |
| Cash management | ✅ | ✅ | Drawer sessions, petty cash, settlements |
| Restaurant features (tables, KOT) | ✅ | ✅ | Table management, kitchen display system, outlet-specific gating |
| Role-based access control | ✅ | ✅ | Per-tenant custom roles |
| Reports & analytics | ✅ | ✅ | Sales, products, cash summaries, outlet-filtered |
| Stock taking (physical count) | ✅ | ✅ | Variance tracking, outlet-specific |
| Bulk product import (Excel/CSV) | ✅ | ✅ | With variation support |
| Multi-language support | ✅ | ✅ | English & Chichewa |

### **⚠️ PARTIALLY COMPLETE**

| Feature | Status | What's Done | What's Missing |
|---------|--------|-------------|-----------------|
| Payment processing | 60% | Cash payments complete, models exist | Card, mobile money integrations |
| Receipt system | 50% | Preview modal + number generation | PDF export, thermal printing |
| Purchase orders | 40% | Frontend UI exists | Backend API, auto-generation |
| Loyalty programs | 20% | Database structure ready | API endpoints, frontend UI |
| Price lists | 20% | Models exist | API endpoints, frontend UI |

### **❌ NOT IMPLEMENTED (Post-MVP)**

| Feature | Reason |
|---------|--------|
| Barcode scanner integration | Requires hardware, can be added later |
| Digital receipt storage & email | Requires email service integration |
| Split/layaway payments | Multi-payment handling incomplete |
| Subscription billing | Multi-tenant requires custom implementation |
| Advanced analytics (BI) | Can use existing data, needs visualization layer |
| Mobile app | Desktop-first MVP approach |

---

## 🔌 API Quick Reference

### **Authentication**
```http
POST /api/v1/auth/login/
Content-Type: application/json

{
  "username": "cashier@business.com",
  "password": "password123"
}

# Response
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": { "id": 1, "tenant_id": 5, ... }
}
```

**All subsequent requests:**
```http
Authorization: Bearer <access_token>
```

### **Create a Sale (POS Checkout)**
```http
POST /api/v1/sales/
Authorization: Bearer <token>
Content-Type: application/json

{
  "outlet_id": 1,
  "items": [
    {
      "variation_id": 42,
      "quantity": 2,
      "unit_price": "5000.00"
    },
    {
      "variation_id": 51,
      "quantity": 1,
      "unit_price": "3500.00"
    }
  ],
  "subtotal": "13500.00",
  "tax": "1350.00",
  "discount": "0.00",
  "total": "14850.00",
  "payment_method": "cash",
  "cash_received": "15000.00"
}

# Response (201 Created)
{
  "id": 1523,
  "receipt_number": "RCP-2025-001523",
  "total": "14850.00",
  "status": "completed",
  "created_at": "2025-01-21T14:32:00Z"
}
```

### **Get Products (with variations)**
```http
GET /api/v1/products/?outlet_id=1
Authorization: Bearer <token>

# Response
{
  "count": 145,
  "results": [
    {
      "id": 42,
      "name": "T-Shirt",
      "category": "Clothing",
      "variations": [
        {
          "id": 421,
          "sku": "TSH-BLK-S",
          "size": "S",
          "color": "Black",
          "retail_price": "5000.00",
          "wholesale_price": "3500.00",
          "stock": 45
        },
        {
          "id": 422,
          "sku": "TSH-BLK-M",
          "size": "M",
          "color": "Black",
          "retail_price": "5000.00",
          "wholesale_price": "3500.00",
          "stock": 32
        }
      ]
    }
  ]
}
```

### **Check Stock (per outlet)**
```http
GET /api/v1/inventory/location-stock/?outlet_id=1&variation_id=421
Authorization: Bearer <token>

# Response
{
  "count": 1,
  "results": [
    {
      "id": 8821,
      "outlet": "Main Store",
      "variation": "T-Shirt - S - Black",
      "quantity_on_hand": 45,
      "reorder_level": 10
    }
  ]
}
```

### **Adjust Stock (manual correction)**
```http
POST /api/v1/inventory/adjust/
Authorization: Bearer <token>
Content-Type: application/json

{
  "outlet_id": 1,
  "variation_id": 421,
  "quantity_change": 5,
  "reason": "Stock count correction",
  "notes": "Physical count discrepancy"
}
```

**See README.md API section for complete endpoint listing**

---

## 📈 Data Models Overview

### **Entity Relationships**

```
Tenant (Business)
├── Outlet (Location)
│   ├── LocationStock (per variation)
│   ├── Sale
│   │   ├── SaleItem (line items)
│   │   ├── Table (restaurant)
│   │   └── Shift
│   └── Staff/User
│
├── Product
│   ├── ItemVariation (size/color/pack)
│   │   ├── SKU
│   │   └── Pricing (retail/wholesale)
│   └── Category
│
├── Customer
│   ├── CreditLimit
│   └── Purchase History
│
├── Supplier
│   └── Purchase Orders (partial)
│
└── Settings/Configuration
```

### **Key Fields on Core Models**

**Sale Model:**
- `receipt_number` - Unique, auto-generated
- `tenant` - Data isolation
- `outlet` - Multi-location support
- `items` - Foreign key to SaleItem
- `total` - Decimal, validated > 0
- `payment_method` - [cash, card, mobile, tab, credit]
- `status` - [completed, pending, refunded, cancelled]
- `table` - Optional (restaurant feature)
- `customer` - Optional (credit sales)
- `shift` - Linked for cash reconciliation
- `created_at` - Timestamp

**LocationStock Model:**
- `tenant` - Data isolation
- `outlet` - Which location
- `variation` - Which product variant
- `quantity_on_hand` - Current stock
- Updated atomically on sale/receipt/transfer

---

## ⚡ Common Development Tasks

### **Add a New Product Variation Type** (e.g., "Material")
```python
# backend/apps/products/models.py
class ItemVariation(models.Model):
    # Existing fields...
    size = CharField(null=True, blank=True)
    color = CharField(null=True, blank=True)
    # ADD:
    material = CharField(null=True, blank=True)  # new variation

# backend/apps/products/serializers.py
class ItemVariationSerializer(serializers.ModelSerializer):
    class Meta:
        fields = [..., 'material']  # add to list

# Run migration
python manage.py makemigrations
python manage.py migrate
```

### **Add a New Report**
```python
# backend/apps/reports/views.py
class CustomReportViewSet(viewsets.ViewSet):
    def list(self, request):
        tenant = request.tenant
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        data = Sale.objects.filter(
            tenant=tenant,
            created_at__range=[start_date, end_date]
        ).aggregate(
            total_revenue=Sum('total'),
            transaction_count=Count('id')
        )
        
        return Response(data)

# backend/apps/reports/urls.py
urlpatterns = [
    path('custom-report/', CustomReportViewSet.as_view({'get': 'list'}))
]
```

### **Add Frontend Role-Based Visibility**
```tsx
// frontend/components/example.tsx
import { useRoleContext } from '@/contexts/role-context';

export function AdminFeature() {
  const { userRole } = useRoleContext();
  
  // Only show to admins
  if (userRole !== 'admin') return null;
  
  return <button>Admin Action</button>;
}
```

---

## 🐛 Troubleshooting & Common Issues

### **Frontend → Backend Connection Issues**

**Problem:** API calls failing with CORS error
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solution:**
```python
# backend/primepos/settings/base.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    # Add your frontend URL
]
```

### **Stock Deduction Fails**

**Problem:** Sale created but inventory not updated
```
LocationStock query returned no rows
```

**Causes:**
1. LocationStock record doesn't exist for variation/outlet
2. Stock already depleted
3. Transaction rolled back due to error

**Fix:**
```python
# Ensure LocationStock exists before sale
LocationStock.objects.get_or_create(
    tenant=tenant,
    outlet=outlet,
    variation=variation,
    defaults={'quantity_on_hand': 0}
)
```

### **Tenant Data Leakage**

**Problem:** Can see another tenant's data
```
Sale.objects.all()  # WRONG - gets all sales!
```

**Fix:**
```python
# CORRECT - use middleware
Sale.objects.filter(tenant=request.tenant)

# In serializer - mark tenant as read_only
class SaleSerializer(serializers.ModelSerializer):
    tenant = serializers.PrimaryKeyRelatedField(read_only=True)
```

### **JWT Token Expired**

**Problem:** 401 Unauthorized after ~1 hour
```
"detail": "Token is invalid or expired"
```

**Solution (Frontend):**
```typescript
// lib/api.ts - automatic refresh
if (error.response.status === 401) {
    const newToken = await authService.refreshToken();
    // Retry original request with new token
}
```

---

## 🚀 Deployment Guide

### **Environment Variables Required**

**Backend (.env or production settings):**
```env
# Django
SECRET_KEY=your-long-random-secret-key
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,api.yourdomain.com

# Database
DATABASE_URL=postgresql://user:pass@db-host:5432/primepos

# Redis (for Celery/caching)
REDIS_URL=redis://redis-host:6379

# CORS
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Email (for notifications)
EMAIL_BACKEND=smtp
EMAIL_HOST=your-smtp-host
EMAIL_PORT=587
EMAIL_HOST_USER=your-email
EMAIL_HOST_PASSWORD=your-password

# File Storage (S3 recommended for production)
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_STORAGE_BUCKET_NAME=your-bucket
```

**Frontend (.env.production):**
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
NEXT_PUBLIC_USE_REAL_API=true
```

### **Production Checklist**

- [ ] Set `DEBUG=False` in Django settings
- [ ] Use PostgreSQL (not SQLite)
- [ ] Set strong `SECRET_KEY`
- [ ] Configure `ALLOWED_HOSTS`
- [ ] Enable HTTPS (SSL certificate)
- [ ] Set up Redis for caching
- [ ] Configure email service
- [ ] Set up database backups
- [ ] Configure file storage (S3)
- [ ] Run `python manage.py collectstatic`
- [ ] Use gunicorn/uwsgi as app server
- [ ] Set up log aggregation
- [ ] Monitor error rates and performance

### **Docker Deployment (Recommended)**

See `docker-compose.yml` and `Dockerfile` (if available) for containerized setup.

---

## 📚 Known Gaps & Next Steps

### **High Priority (Blocking MVP)**

1. **Payment Gateway Integration** (2-3 weeks)
   - Card payments (Stripe/Square/Paystack)
   - Mobile money (M-Pesa/Airtel Money)
   - Files to update: `backend/apps/payments/`, `frontend/components/modals/payment-modal.tsx`

2. **Receipt Printing/PDF** (1-2 weeks)
   - Backend: Receipt model + PDF generation service
   - Frontend: Print modal + PDF download
   - Files to create: `backend/apps/sales/receipts.py`, `frontend/lib/services/receiptService.ts`

3. **Database Migrations** (Immediate)
   - Run: `python manage.py migrate`
   - Ensure all models synced before production

### **Medium Priority (Post-MVP)**

1. **Barcode Scanner Integration** (1 week)
   - Keyboard input handling
   - Scanner configuration UI
   - SKU lookup on scan

2. **Purchase Order Automation** (2 weeks)
   - Backend API for PO creation/approval
   - Auto-PO based on low stock alerts
   - Supplier integration

3. **Loyalty Program Implementation** (2-3 weeks)
   - Points system
   - Tier-based rewards
   - Integration with sales

### **Low Priority (Enhancement)**

1. Advanced analytics/BI dashboard
2. Mobile app (current: web/PWA only)
3. Subscription billing module
4. Third-party integrations (accounting software, tax services)

---

## 📞 Support & Questions

### **Code Structure Questions**
- Check relevant app's `README.md` or code comments
- Example: Question about inventory? → `backend/apps/inventory/models.py`

### **API Endpoint Questions**
- Visit `/api/v1/` root endpoint for browsable API
- Or check `backend/primepos/urls.py` for all routes

### **Feature Implementation**
- Review the "Adding a New Feature" section above
- Follow the established patterns (serializers, viewsets, services)

### **Bug Reports**
- Check terminal output for Django/Next.js errors
- Review logs in `backend/logs/` if available
- Verify data isolation with tenant filtering

---

## 📄 Additional Resources

- **Architecture Diagrams**: See docs/ folder
- **Database Schema**: Django admin panel at `/admin/`
- **API Playground**: http://localhost:8000/api/v1/ (browsable API)
- **Frontend Components**: Storybook (if configured)
- **Deployment**: See DEPLOYMENT_GUIDE.md (if available)

---

## ✅ Project Readiness for Handover

**Status: Ready for Development Handover**

This codebase is:
- ✅ Well-structured and modular
- ✅ Multi-tenant production-ready (core features)
- ✅ Documented with clear code patterns
- ✅ Type-safe (TypeScript frontend, Python backend)
- ✅ Following Django/Next.js best practices

**Recommended Next Developer Tasks:**
1. Run both servers and test the application flow
2. Review and understand the tenant isolation mechanism
3. Implement the payment gateway integration (biggest gap)
4. Add receipt PDF generation
5. Write unit tests for critical business logic

---

**Last Updated**: January 2026  
**Maintained By**: PrimePOS Development Team  
**Version**: MVP (0.1.0)
