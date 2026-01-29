# POS SYSTEM – MVP DEPLOYMENT CHECKLIST

## 🔴 CRITICAL (P0) - BLOCKING DEPLOYMENT

### OFFLINE SYNC & PWA (NOT IMPLEMENTED)
- [ ] Create service worker for offline caching
- [ ] Implement IndexedDB for local transaction storage
- [ ] Add offline detection hook (`navigator.onLine`)
- [ ] Create sync queue for offline transactions (auto-sync when online)
- [ ] Add visual offline indicator in UI
- [ ] Create `manifest.json` for PWA installability
- [ ] Add apple-touch-icon and splash screens
- [ ] Configure next-pwa or workbox

### BACKEND SECURITY & AUTH
- [ ] Add API rate limiting/throttling to DRF settings
- [ ] Implement password reset/recovery endpoints
- [ ] Configure email service (SMTP settings for Gmail/SendGrid)
- [ ] Fix insecure fallback SECRET_KEY in development settings

### DEPLOYMENT INFRASTRUCTURE
- [ ] Add `gunicorn` to requirements.txt (production WSGI server)
- [ ] Add `whitenoise` for static file serving
- [ ] Create `Procfile` for Render
- [ ] Update `render.yaml` to include backend service + PostgreSQL + Redis
- [ ] Create `.env.example` documenting all required variables
- [ ] Add health check endpoint (`/api/health/`)
- [ ] Enable `SECURE_SSL_REDIRECT = True` in production

---

## 🟡 HIGH PRIORITY (P1) - CORE FUNCTIONALITY

### SALES (YOUR ORIGINAL LIST)
- [ ] Inventory must reduce automatically when a sale is completed
- [ ] Discounts must be saved in the database (not UI-only)
- [ ] Fix credit sales to correctly show PAID, PARTIALLY PAID, and UNPAID statuses
- [ ] Credit payments must update customer balance and credit status
- [ ] Returns and refunds must be receipt-based only
- [ ] Remove existing standalone refund logic

### PAYMENTS
- [ ] Implement split payment functionality (UI + backend `SalePayment` model)
- [ ] Add payment reference number capture for card/mobile money
- [ ] Mobile money integration (M-PESA, Airtel Money, TNM Mpamba) - at least manual entry validation

### INVENTORY (YOUR ORIGINAL LIST)
- [ ] Fix inventory logic for retail, wholesale, bar, and restaurant (single consistent logic)
- [ ] Fix expiry handling (optional expiry, FEFO where applicable)
- [ ] Fix import/export so each field has its own column
- [ ] Add optional product images (tenant configurable, can be disabled)

### STOCK CONTROL (YOUR ORIGINAL LIST)
- [ ] Ensure stock adjustments work correctly
- [ ] Ensure stock transfers update inventory properly
- [ ] Ensure received stock updates inventory correctly
- [ ] Ensure returned stock updates inventory correctly
- [ ] All stock movements must be auditable

### LOW STOCK (YOUR ORIGINAL LIST)
- [ ] Low stock thresholds must work correctly
- [ ] Low stock alerts and reports must be accurate

### POS HARDWARE
- [ ] Implement cash drawer kick command via QZ Tray
- [ ] Add automatic drawer open on cash sale completion
- [ ] Add "No Sale" / open drawer button

### TAX CONFIGURATION
- [ ] Create tax configuration UI in settings
- [ ] Implement per-product tax rate/category
- [ ] Add tax-inclusive vs tax-exclusive pricing option
- [ ] Replace mock data in tax reports with real calculations

### SHIFT MANAGEMENT
- [ ] Add cash in/out (petty cash) during shift
- [ ] Generate Z-Report / X-Report for shift close
- [ ] Add shift summary with cash variance explanation

---

## 🟢 MEDIUM PRIORITY (P2) - IMPORTANT BUT NOT BLOCKING

### FRONTEND UX
- [ ] Add `error.tsx` boundary pages (Next.js)
- [ ] Add `not-found.tsx` (404 pages)
- [ ] Add `loading.tsx` route loading states
- [ ] Create Skeleton/loading components
- [ ] Add empty states for lists
- [ ] Add confirmation dialogs for destructive actions

### REPORTS (YOUR ORIGINAL LIST)
- [ ] Fix and complete all sales reports
- [ ] Fix and complete inventory reports
- [ ] Fix and complete credit reports
- [ ] Fix and complete stock movement reports
- [ ] Fix and complete expiry and low stock reports
- [ ] Add CSV/Excel export endpoints for all reports

### KITCHEN DISPLAY (RESTAURANT)
- [ ] Implement real-time WebSocket updates (replace 30s polling)
- [ ] Add audio alerts for new orders
- [ ] Add kitchen printer routing
- [ ] Calculate actual average prep time (not hardcoded)

### HOLD/RECALL ORDERS
- [ ] Fix held sales list to read from actual localStorage (uses mock data)
- [ ] Consider server-side hold persistence

### DISCOUNTS
- [ ] Add item-level discounts
- [ ] Add maximum discount limits per user role

### BACKEND IMPROVEMENTS
- [ ] Add Sentry error tracking
- [ ] Add API documentation (swagger/drf-spectacular)
- [ ] Add Celery for background tasks (expiry notifications, report generation)
- [ ] Add Redis caching for frequently accessed data
- [ ] Standardize error response format

### CI/CD
- [ ] Create Dockerfile and docker-compose.yml
- [ ] Set up GitHub Actions workflow for CI/CD
- [ ] Add database backup strategy

---

## ⚪ LOW PRIORITY (P3) - NICE TO HAVE FOR MVP

### AUTH ENHANCEMENTS
- [ ] "Remember Me" functionality
- [ ] Session timeout warnings
- [ ] Multi-tab session sync
- [ ] PIN/biometric quick re-auth

### POS ENHANCEMENTS
- [ ] Hardware settings UI to configure scanner options
- [ ] Coupon/promo code system
- [ ] Discount authorization workflow
- [ ] Automatic discount rules (buy-2-get-1-free, loyalty)
- [ ] Layaway/deposit tracking

### MOBILE
- [ ] Mobile-optimized POS interface
- [ ] Touch gestures support
- [ ] Dark mode toggle

### ADVANCED FEATURES
- [ ] Webhook endpoints for external integrations
- [ ] Field-level change tracking in audit logs
- [ ] Browser fallback printing (when QZ Tray unavailable)

---

## 📊 MVP READINESS SUMMARY

| Area | Completion | Blocking Issues |
|------|------------|-----------------|
| Backend APIs | ~80% | Rate limiting, password reset, email |
| Frontend POS | ~70% | Offline sync, split payments, tax config |
| Authentication | ~90% | Password reset |
| Multi-tenancy | ~95% | None |
| Deployment | ~30% | Gunicorn, Procfile, render.yaml, Docker |
| Testing | ~10% | No comprehensive tests |
| PWA/Offline | 0% | Critical for Malawi market |

---

## 🚀 RECOMMENDED MVP LAUNCH ORDER

1. **Week 1**: Backend security (rate limiting, password reset, email)
2. **Week 2**: Deployment infrastructure (Docker, Render config, CI/CD)
3. **Week 3**: Offline sync + PWA (service worker, IndexedDB)
4. **Week 4**: Sales/inventory fixes (your original list)
5. **Week 5**: Payments (split payments, cash drawer)
6. **Week 6**: Reports + Polish
7. **Week 7**: Testing + Bug fixes
8. **Week 8**: Soft launch + Monitoring
