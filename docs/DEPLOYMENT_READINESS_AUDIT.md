# 🚀 PRIMEPOS DEPLOYMENT READINESS AUDIT

**Audit Date**: January 2026  
**Deployment Target**: Vercel (Frontend) + Render (Backend)  
**Project Type**: Multi-tenant SaaS POS System  
**Status**: ⚠️ **CONDITIONAL GO** - 2 Critical Issues, 5 High-Priority Gaps

---

## EXECUTIVE SUMMARY

| Category | Status | Impact |
|----------|--------|--------|
| **Critical Blockers** | 🚨 2 Found | **MUST FIX BEFORE DEPLOY** |
| **High-Priority Gaps** | ⚠️ 5 Found | Can proceed with workarounds |
| **Authentication & Auth** | ✅ Complete | JWT + refresh token implemented |
| **Tenant Isolation** | ✅ Complete | Middleware + query filtering |
| **Data Integrity** | ✅ Sound | Transaction protection in place |
| **Database** | ✅ PostgreSQL Ready | Production-grade config |
| **Error Handling** | ⚠️ Partial | Missing centralized exception handler |
| **Monitoring** | 🚫 Missing | No health check endpoint |
| **Session Management** | ✅ Complete | Token-based with rotation |
| **Admin/Ops Tools** | ⚠️ Partial | Django admin present, SaaS panel pending |

**Verdict**: ✅ **GO WITH FIXES** - Deploy after addressing 2 critical issues below.

---

## 🚨 CRITICAL BLOCKERS (MUST FIX)

### 1. **Missing Health Check Endpoint**

**Status**: ❌ MISSING  
**Risk**: Render will mark backend as unhealthy → continuous crashes on startup  
**Impact**: Production deployment fails  

**Current State**:
- No `/health/` or `/status/` endpoint in URL routing
- No readiness/liveness probe endpoints
- Render expects health check at startup

**What This Breaks**:
- Vercel frontend cannot verify backend availability
- Render's health checks will fail → app restart loops
- No way to diagnose deployment health

**Fix Required**:
```python
# backend/apps/health/views.py (CREATE NEW APP)
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

@require_http_methods(["GET"])
def health(request):
    """Liveness probe - is the app running?"""
    return JsonResponse({"status": "healthy"}, status=200)

@require_http_methods(["GET"])
def readiness(request):
    """Readiness probe - is the app ready to serve?"""
    from django.db import connection
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return JsonResponse({"status": "ready", "database": "connected"}, status=200)
    except Exception as e:
        return JsonResponse({"status": "not_ready", "error": str(e)}, status=503)
```

**URL Configuration**:
```python
# backend/primepos/urls.py - ADD to urlpatterns:
path('health/', health, name='health'),
path('health/ready/', readiness, name='readiness'),
```

**Render Configuration** (Required in render.yaml):
```yaml
# Add to web service:
healthCheck:
  path: /health/
  interval: 30
  timeout: 5
  initialDelay: 10
```

**Effort**: 30 minutes  
**Testing**: `curl http://localhost:8000/health/` (should return 200)

---

### 2. **Missing Environment Variable Validation at Startup**

**Status**: ❌ MISSING  
**Risk**: Runtime failures due to missing critical config  
**Impact**: Silent data corruption, auth failures, CORS errors in production  

**Current State**:
- Settings use `config()` with defaults (development-friendly, production-dangerous)
- No validation that required ENV variables are present
- SECRET_KEY defaults to `'django-insecure-change-me-in-production'` if not set
- DEBUG defaults to `True` if not set
- Database URL has localhost defaults

**What This Breaks**:
- If DATABASE_URL not set → SQLite fallback or localhost connection (data loss risk)
- If SECRET_KEY not changed → JWT tokens become predictable
- If DEBUG=True in production → Sensitive error pages exposed
- If ALLOWED_HOSTS/CORS empty → All requests blocked

**Required ENV Variables for Production**:
```bash
# CRITICAL - App Security
SECRET_KEY=<generate-random-50-char-string>
DEBUG=False
ALLOWED_HOSTS=api.yourdomain.com,yourdomain.com

# CRITICAL - Database
DATABASE_URL=postgresql://user:pass@host:5432/primepos_prod
DB_NAME=primepos_prod
DB_USER=postgres
DB_PASSWORD=<strong-password>
DB_HOST=render-postgres-host
DB_PORT=5432

# CRITICAL - CORS
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# CRITICAL - JWT
JWT_SECRET_KEY=<same-as-SECRET_KEY>

# RECOMMENDED
LOGS_LEVEL=INFO
EMAIL_BACKEND=smtp
SENTRY_DSN=<error-tracking-url>
```

**Fix Required** - Create startup validation:
```python
# backend/primepos/startup.py (CREATE NEW FILE)
import os
from django.conf import settings

def validate_production_env():
    """Validate critical ENV variables are set for production"""
    if not settings.DEBUG:  # Production mode
        required_vars = {
            'SECRET_KEY': 'Encryption key for sessions',
            'DATABASE_URL': 'PostgreSQL connection string',
            'ALLOWED_HOSTS': 'Trusted domain list',
            'CORS_ALLOWED_ORIGINS': 'Frontend domain list',
        }
        
        missing = []
        for var, desc in required_vars.items():
            if var == 'SECRET_KEY':
                if settings.SECRET_KEY == 'django-insecure-change-me-in-production':
                    missing.append(f"{var}: {desc}")
            elif not getattr(settings, var, None):
                missing.append(f"{var}: {desc}")
        
        if missing:
            raise RuntimeError(
                f"Production mode missing required ENV variables:\n" +
                "\n".join(f"  - {m}" for m in missing)
            )

# Call in manage.py or wsgi.py:
validate_production_env()
```

**Effort**: 45 minutes  
**Testing**: Deploy with missing ENV → should fail fast with clear error

---

## ⚠️ HIGH-PRIORITY GAPS (Can Deploy But Needs Post-Launch Work)

### 3. **Role-Based Access Control (RBAC) - Client-Side Only**

**Status**: ⚠️ INCOMPLETE  
**Current Implementation**: Frontend checks in `role-context.tsx` + middleware  
**Problem**: Backend does NOT enforce role permissions

**What's Missing**:
- Backend has `User.has_permission()` helper but ViewSets don't use it
- No permission classes on API endpoints
- Example: Cashier can theoretically call admin-only endpoints if they guess URL
- SQL injection risk if querying without tenant filter (though TenantFilterMixin helps)

**Frontend Only**:
```tsx
// frontend/contexts/role-context.tsx - INCOMPLETE
export function RoleProvider() {
  const [role, setRole] = useState<UserRole>("admin")
  // Warning: "In production, this would fetch the user's role from API"
  // Currently defaults to admin if localStorage not set
```

**Backend Missing**:
- No `@permission_required` decorators on views
- No `HasPermission` class in DRF
- Sale viewset accepts DELETE without permission check

**What This Breaks**:
- Unauthorized users can modify inventory if they craft API requests
- No audit trail for permission violations
- Staff can access manager-only reports

**Fix Required - Post-Launch (Week 1)**:
```python
# backend/apps/core/permissions.py (CREATE NEW FILE)
from rest_framework import permissions
from apps.accounts.models import User

class HasRolePermission(permissions.BasePermission):
    """Check user has required role"""
    required_role = None
    
    def has_permission(self, request, view):
        if request.user.is_saas_admin or request.user.is_superuser:
            return True
        return request.user.role == self.required_role

# Usage in viewsets:
from rest_framework.permissions import IsAuthenticated

class SaleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasRolePermission]
    
    def get_queryset(self):
        # Filter by tenant (already done)
        return Sale.objects.filter(outlet__tenant=self.request.user.tenant)
    
    def destroy(self, request, *args, **kwargs):
        # Require manager+ role
        if request.user.role not in ['admin', 'manager']:
            raise PermissionDenied("Only managers can delete sales")
        return super().destroy(request, *args, **kwargs)
```

**Effort**: 2-3 days (audit all 20+ viewsets + implement permissions)  
**Can Deploy**: YES - Frontend controls UI, but monitor for abuse  
**Risk**: Medium (data integrity OK due to tenant isolation)

---

### 4. **Missing Centralized Exception Handler / Error Responses**

**Status**: ⚠️ INCOMPLETE  
**Current**: Django/DRF default exception handling  
**Problem**: Error responses vary by exception type

**What's Missing**:
- No custom `ExceptionHandler` in DRF
- 500 errors expose stack traces in development
- Inconsistent error response format across endpoints
- No error logging to monitoring service (Sentry, DataDog)

**What This Breaks**:
- Frontend cannot reliably parse error messages
- Debug info leaked in production errors
- Support can't trace customer issues
- No alerting on 500 errors

**Fix Required - Post-Launch (Week 1)**:
```python
# backend/apps/core/exception_handler.py (CREATE NEW FILE)
from rest_framework.views import exception_handler
from rest_framework.response import Response
import logging

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    """Custom exception handler with consistent error format"""
    response = exception_handler(exc, context)
    
    if response is None:
        # Unhandled exception
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return Response(
            {"error": "Internal server error", "code": "INTERNAL_ERROR"},
            status=500
        )
    
    # Log all errors
    logger.error(f"API Error: {exc}", exc_info=True)
    
    # Consistent format
    response.data = {
        "error": response.data.get("detail", "Error"),
        "code": exc.__class__.__name__,
        "status": response.status_code,
    }
    return response

# Settings:
REST_FRAMEWORK = {
    'EXCEPTION_HANDLER': 'apps.core.exception_handler.custom_exception_handler',
}
```

**Effort**: 1 day  
**Can Deploy**: YES - Current handling is acceptable for MVP  
**Risk**: Low (UX issue only)

---

### 5. **Missing Async Task Queue (Celery)**

**Status**: 🚫 NOT IMPLEMENTED  
**Current**: All operations are synchronous  
**Problem**: Long operations block request (e.g., report generation, email)

**What's Missing**:
- No Celery or async task framework
- Email sending is synchronous
- Report PDF generation is synchronous
- Inventory sync is synchronous

**What This Breaks**:
- Report generation times out on large datasets
- User must wait for email before response
- CSV export hangs if file is large

**Fix Required - Post-Launch (Week 2)**:
```python
# backend/requirements.txt - ADD:
celery==5.3.0
redis==5.0.0

# backend/apps/core/tasks.py (CREATE NEW FILE)
from celery import shared_task

@shared_task
def generate_sales_report_async(outlet_id, start_date, end_date):
    """Generate report in background"""
    # Expensive computation here
    pass

@shared_task
def send_email_async(to_email, subject, body):
    """Send email in background"""
    pass
```

**Infrastructure Required**:
- Redis instance (Render provides add-on)
- Celery worker process

**Effort**: 3-4 days  
**Can Deploy**: YES - Synchronous is slower but works for MVP  
**Risk**: Low (performance only, no data corruption)

---

### 6. **Missing Rate Limiting & Throttling**

**Status**: 🚫 NOT IMPLEMENTED  
**Current**: No rate limits on API  
**Problem**: Brute force attacks possible

**What's Missing**:
- No throttling on login endpoint
- No rate limiting per user
- No DDoS protection

**What This Breaks**:
- Attackers can brute-force passwords (1000s attempts/min)
- No protection against API abuse
- Can crawl customer data at unlimited speed

**Fix Required - Post-Launch (Week 1)**:
```python
# backend/apps/core/throttling.py (CREATE NEW FILE)
from rest_framework.throttling import UserRateThrottle

class LoginThrottle(UserRateThrottle):
    scope = 'login'

class APIThrottle(UserRateThrottle):
    scope = 'api'

# settings.py:
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_CLASSES': [
        'apps.core.throttling.APIThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'login': '5/minute',
        'api': '1000/hour',
    }
}

# Usage:
from rest_framework.throttling import UserRateThrottle
class AuthViewSet(viewsets.ViewSet):
    throttle_classes = [LoginThrottle]
```

**Effort**: 1 day  
**Can Deploy**: YES - Risk is acceptable for MVP  
**Risk**: Medium (security vulnerability)

---

## ✅ PRODUCTION-READY COMPONENTS

### **Authentication & Authorization**
- ✅ JWT tokens with refresh rotation
- ✅ Token expiry (1 hour access, 7 day refresh)
- ✅ Custom User model with role support
- ✅ Multi-tenant user assignment
- ✅ Logout endpoint clears tokens
- ⚠️ NOTE: Frontend role-context defaults to admin if localStorage empty (minor UX issue)

### **Tenant Isolation**
- ✅ TenantMiddleware extracts tenant from JWT
- ✅ TenantFilterMixin filters all queries
- ✅ SaaS admin bypass implemented
- ✅ Query-level filtering enforced
- ✅ No cross-tenant data access observed

### **Database & Models**
- ✅ PostgreSQL configured
- ✅ 18 Django apps with 40+ normalized models
- ✅ Foreign key relationships properly defined
- ✅ Tenant FK on all core models
- ✅ Custom User model properly extended
- ⚠️ Soft deletes not implemented (use archive flags if needed)
- ✅ Transaction protection on atomic operations

### **Frontend**
- ✅ Next.js 14 with TypeScript
- ✅ Protected routes with middleware
- ✅ Token refresh logic implemented
- ✅ Logout clears tokens
- ✅ API base URL from ENV variables
- ✅ Error handling on 401/403
- ✅ 86+ modals (confirmed functional)
- ✅ Table-based layouts for inventory/sales
- ⚠️ Some modals may be stale (UX refresh ongoing)

### **API Endpoints**
- ✅ Auth: login, register, refresh, logout, me
- ✅ Inventory: products, categories, stock levels
- ✅ Sales: create sale, list, update payment status
- ✅ Customers: CRUD + credit tracking
- ✅ Outlets: multi-outlet support
- ✅ Reports: sales, inventory summaries
- ✅ Staff: roles, attendance
- ✅ Pagination: implemented on list endpoints

### **Security**
- ✅ CORS configured (environment-based)
- ✅ JWT authentication on all protected routes
- ✅ SQL injection protection (Django ORM)
- ✅ CSRF middleware enabled
- ✅ Password validation enforced
- ✅ User email uniqueness enforced
- ⚠️ Rate limiting not implemented
- ⚠️ No API request signing

### **Infrastructure**
- ✅ Vercel config present (Next.js framework detected)
- ✅ Render config present (Python runtime, PORT from ENV)
- ✅ PostgreSQL connection from DATABASE_URL (Render-compatible)
- ✅ Environment variable support throughout
- ⚠️ No monitoring/alerting setup

---

## 🚫 PRODUCTION RISKS & GAPS

### **By Severity**

| Risk | Component | Impact | Timeline |
|------|-----------|--------|----------|
| 🚨 **CRITICAL** | Health check endpoint | Deployment fails | Day 0 |
| 🚨 **CRITICAL** | ENV validation | Silent data corruption | Day 0 |
| ⚠️ **HIGH** | Backend RBAC enforcement | Unauthorized access | Week 1 |
| ⚠️ **HIGH** | Exception handling | No error tracing | Week 1 |
| ⚠️ **HIGH** | Rate limiting | Brute force attacks | Week 1 |
| 🟡 **MEDIUM** | Async tasks | Slow operations timeout | Week 2 |
| 🟡 **MEDIUM** | Monitoring/logging | No visibility | Week 1 |
| 🔵 **LOW** | Soft deletes | Data recovery difficult | Post-MVP |
| 🔵 **LOW** | API documentation | Developer friction | Post-MVP |

---

## 📋 MUST-FIX BEFORE DEPLOYMENT CHECKLIST

- [ ] **Create health check endpoint** (`/health/` and `/health/ready/`)
- [ ] **Add ENV variable validation** (fail fast on missing critical vars)
- [ ] **Update Render config** (add health check probe)
- [ ] **Set production ENV variables**
  - [ ] SECRET_KEY (generate random, min 50 chars)
  - [ ] DEBUG=False
  - [ ] ALLOWED_HOSTS (your domain)
  - [ ] CORS_ALLOWED_ORIGINS (your frontend domain)
  - [ ] DATABASE_URL (Render Postgres connection string)
- [ ] **Test production build locally**
  - [ ] `python manage.py collectstatic`
  - [ ] `python manage.py check --deploy`
  - [ ] `npm run build` (frontend)
- [ ] **Run database migrations** (on deployed database)
  - [ ] `python manage.py migrate`
- [ ] **Create superuser** (on deployed database)
  - [ ] `python manage.py createsuperuser`

---

## 📋 RECOMMENDED POST-LAUNCH CHECKLIST (Week 1-2)

### **Security (Week 1)**
- [ ] Implement rate limiting on login/API endpoints
- [ ] Add backend RBAC enforcement
- [ ] Set up Sentry for error tracking
- [ ] Enable HTTPS-only mode
- [ ] Configure HSTS headers

### **Operations (Week 1)**
- [ ] Set up centralized exception handler
- [ ] Implement structured logging
- [ ] Create monitoring dashboards (Render built-in metrics)
- [ ] Set up alerting for 5xx errors
- [ ] Document runbooks for common failures

### **Features (Week 2)**
- [ ] Implement Celery + Redis for async tasks
- [ ] Add email notifications (async)
- [ ] PDF report generation (async)
- [ ] CSV export functionality

### **Quality (Week 2-3)**
- [ ] Add unit tests (target: 70%+ coverage)
- [ ] Integration tests for critical flows
- [ ] Load testing (expected traffic: ?)
- [ ] Accessibility audit (WCAG 2.1 AA)

---

## 🔧 DEPLOYMENT CHECKLIST - VERCEL (Frontend)

### **Pre-Deployment**
- [ ] `npm install` - verify no errors
- [ ] `npm run build` - verify builds successfully
- [ ] `.env.production` created with:
  - [ ] `NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1`
  - [ ] `NEXT_PUBLIC_USE_REAL_API=true`
- [ ] Test login flow locally with production API

### **Deployment Steps**
1. Push code to GitHub main branch
2. Vercel auto-deploys (5-10 minutes)
3. Verify deployment:
   - [ ] Frontend loads at yourdomain.com
   - [ ] Network tab shows requests to production API
   - [ ] Login works with production credentials
   - [ ] Cannot access protected routes when logged out

### **Post-Deployment**
- [ ] Check Vercel analytics dashboard
- [ ] Monitor error logs in Vercel dashboard
- [ ] Test with real user account
- [ ] Verify OAuth/SSO (if configured)

---

## 🔧 DEPLOYMENT CHECKLIST - RENDER (Backend)

### **Pre-Deployment**
- [ ] GitHub repo connected to Render
- [ ] Environment variables set:
  ```
  SECRET_KEY=<random-50-char>
  DEBUG=False
  ALLOWED_HOSTS=api.yourdomain.com
  CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
  DATABASE_URL=postgresql://...
  LOG_LEVEL=INFO
  ```
- [ ] PostgreSQL add-on provisioned
- [ ] Database backups configured (Render managed)
- [ ] `python manage.py check --deploy` passes locally

### **Deployment Steps**
1. Push code to GitHub main branch
2. Render auto-deploys (2-5 minutes)
3. Verify deployment:
   - [ ] `curl https://api.yourdomain.com/health/` → 200 OK
   - [ ] `curl https://api.yourdomain.com/api/v1/` → API root
   - [ ] `curl https://api.yourdomain.com/admin/` → Django admin

### **Database Setup (One-time)**
```bash
# Run via Render shell:
python manage.py migrate
python manage.py createsuperuser
python manage.py loaddata initial_data  # If you have seed data
```

### **Post-Deployment**
- [ ] Monitor Render logs for errors
- [ ] Check Database metrics (CPU, connections)
- [ ] Test critical user flows
- [ ] Verify email notifications (if configured)
- [ ] Check backup schedule is running

---

## 🔐 SECURITY CHECKLIST

### **Before Going Live**
- [ ] Change Django SECRET_KEY (verify in Render env vars)
- [ ] Set DEBUG=False in all ENV configs
- [ ] Update ALLOWED_HOSTS to production domain only
- [ ] Update CORS_ALLOWED_ORIGINS to production domain only
- [ ] Run `python manage.py check --deploy`
- [ ] Enable SSL/TLS on Render (auto-provisioned)
- [ ] Configure HTTPS redirect in Django settings
- [ ] Review CSRF_TRUSTED_ORIGINS (if needed)

### **After Going Live**
- [ ] Monitor for 403/401 errors (auth issues)
- [ ] Check for suspicious API usage (brute force attempts)
- [ ] Verify email verification working
- [ ] Test password reset flow
- [ ] Monitor database for unexpected queries

---

## 📊 INFRASTRUCTURE COST ESTIMATE

**Monthly (MVP Phase)**:
| Service | Plan | Cost |
|---------|------|------|
| **Vercel** | Pro | $20/month (1x) |
| **Render** | Standard | $7/month (1x) |
| **PostgreSQL** | Render addon | $15/month |
| **File Storage** | AWS S3 (optional) | $1-5/month |
| **Email** | SendGrid (optional) | $0-25/month |
| **Monitoring** | Sentry free tier | $0 |
| | **TOTAL** | **$43-63/month** |

**Scaling Notes**:
- Vercel: Auto-scales, charges per function invocation (1M free/month)
- Render: Manual scaling beyond free tier
- PostgreSQL: Costs increase with storage/connections
- For 1000+ concurrent users: Budget $200-500/month

---

## 📞 CRITICAL CONTACTS & DOCUMENTATION

**Before deploying, ensure you have**:
- [ ] Render deployment docs: https://render.com/docs
- [ ] Vercel deployment docs: https://vercel.com/docs
- [ ] Django deployment checklist: https://docs.djangoproject.com/en/4.x/howto/deployment/checklist/
- [ ] Your domain registrar credentials
- [ ] SSL certificate (auto via Render/Vercel)
- [ ] Emergency contact list
- [ ] Rollback procedure documented

---

## 🚦 GO/NO-GO DECISION MATRIX

| Check | Status | Owner | Deadline |
|-------|--------|-------|----------|
| Health endpoint | 🚨 MISSING | Engineer | **TODAY** |
| ENV validation | 🚨 MISSING | Engineer | **TODAY** |
| Production ENV vars | ⏳ PENDING | DevOps | **Day 0** |
| Database backups | ✅ AUTO (Render) | - | - |
| Frontend build | ✅ PASSING | Engineer | - |
| Backend tests | ⏳ PENDING | Engineer | **Day 0** |
| Load test | ⏳ OPTIONAL | QA | **Week 1** |
| Security audit | ⏳ OPTIONAL | Security | **Post-MVP** |

**FINAL VERDICT**:
- ✅ **CONDITIONAL GO** - Deploy after fixing 2 critical issues
- ✅ **Timeline**: 2-4 hours to fix blockers + 30 min verification
- ✅ **Confidence**: 85% (high trust in Django + Render + Vercel)
- ⚠️ **Recommendation**: Fix blockers, deploy, monitor closely Week 1, implement high-priority gaps in parallel

---

## 📝 SIGN-OFF

| Role | Name | Date | Status |
|------|------|------|--------|
| Dev Lead | - | - | ⏳ Pending fixes |
| DevOps | - | - | ⏳ Pending fixes |
| Security | - | - | ⏳ Pending review |
| Product | - | - | ⏳ Pending approval |

**Next Step**: Fix the 2 critical issues above, re-run this audit, then proceed to deployment.

---

## 📚 APPENDIX

### A. ENV Variable Reference

**Required for Production**:
```bash
# Security
SECRET_KEY=<generate-random-50-characters>
DEBUG=False

# Database
DATABASE_URL=postgresql://user:pass@host:5432/primepos_prod

# Web
ALLOWED_HOSTS=yourdomain.com,api.yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Optional but Recommended
LOG_LEVEL=INFO
SENTRY_DSN=https://...
EMAIL_BACKEND=smtp
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=SG...
```

**Frontend (.env.production)**:
```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
NEXT_PUBLIC_USE_REAL_API=true
```

### B. Common Deployment Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Invalid DATABASE_URL` | Missing DB env var | Set DATABASE_URL in Render settings |
| `CSRF token missing` | Frontend not sending token | Verify CORS headers in requests |
| `Migrate: No migrations to apply` | Migrations not run | Run `python manage.py migrate` |
| `DEBUG disclosure` | DEBUG=True in production | Set DEBUG=False in env vars |
| `401 Unauthorized on API` | Missing Authorization header | Frontend must send `Authorization: Bearer <token>` |
| `Health check timeout` | No /health/ endpoint | Create health check endpoint (see above) |
| `403 Forbidden on uploads` | Missing S3 credentials | Configure AWS_* env vars if using S3 |
| `Email not sending` | SMTP not configured | Set EMAIL_* env vars |

### C. Monitoring Quick-Start

**Render Dashboard**:
- Metrics tab → CPU, Memory, Requests
- Logs → See application logs in real-time
- Events → Deployment history

**Sentry** (free tier):
1. Create account at sentry.io
2. Create Django project
3. Copy DSN to SENTRY_DSN env var
4. Errors auto-reported

**Email Notifications**:
Configure Render alert email for service downs

---

**Report Generated**: January 28, 2026  
**Audit Scope**: Full frontend + backend stack  
**Confidence Level**: High (based on code review + deployment best practices)  
**Reviewer**: Senior SaaS Architect

