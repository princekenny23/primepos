# 🧪 CRITICAL BLOCKERS - QUICK TEST GUIDE

**Created**: January 29, 2026  
**Time to Complete**: 10-15 minutes  

---

## Step 1: Verify Health Endpoints Exist

Run these commands to test that the health endpoints are properly registered:

```bash
cd backend

# Test Blocker #1: Health endpoint
python manage.py shell

# In Python shell:
>>> from django.test import Client
>>> c = Client()
>>> response = c.get('/health/')
>>> print(f"Status: {response.status_code}")
Status: 200
>>> import json
>>> print(json.dumps(response.json(), indent=2))
{
  "status": "healthy",
  "service": "primepos-backend",
  "version": "1.0.0"
}
```

**Expected**: 200 status code with JSON response

---

## Step 2: Verify Readiness Endpoint (Database Check)

```bash
# Still in Python shell:
>>> response = c.get('/health/ready/')
>>> print(f"Status: {response.status_code}")
Status: 200
>>> print(json.dumps(response.json(), indent=2))
{
  "status": "ready",
  "service": "primepos-backend",
  "database": "connected",
  "version": "1.0.0"
}
```

**Expected**: 200 status code (if database is running)  
**If database down**: 503 status code with error message

---

## Step 3: Test Environment Variable Validation

### Test 3A: Validation runs in production mode

```bash
# Set production environment
export DEBUG=False
export ALLOWED_HOSTS=""

# Try to run Django
python manage.py check

# Expected: RuntimeError with clear message about missing env vars
# Message should show: "🚨 PRODUCTION MODE - MISSING REQUIRED ENV VARIABLES"
```

### Test 3B: Validation passes with proper config

```bash
# Set proper production environment
export DEBUG=False
export DATABASE_URL=postgresql://postgres:kwitonda@localhost:5432/primepos
export ALLOWED_HOSTS=yourdomain.com
export CORS_ALLOWED_ORIGINS=https://yourdomain.com
export SECRET_KEY=my-super-secret-key-at-least-50-characters-long-123456

# Run Django check
python manage.py check --deploy

# Expected: [OK]: 0 Errors, 0 Warnings
```

---

## Step 4: Test via curl (Simulating Render)

If the app is running locally:

```bash
# Terminal 1: Start development server
cd backend
python manage.py runserver 8000

# Terminal 2: Test health endpoints
curl http://localhost:8000/health/
# Expected: {"status": "healthy", "service": "primepos-backend", "version": "1.0.0"}

curl http://localhost:8000/health/ready/
# Expected: {"status": "ready", "service": "primepos-backend", "database": "connected", ...}
```

---

## Step 5: Verify Startup Logging

```bash
# Run Django with production environment to see startup logs
export DEBUG=False
export DATABASE_URL=postgresql://postgres:kwitonda@localhost:5432/primepos
export ALLOWED_HOSTS=localhost
export CORS_ALLOWED_ORIGINS=http://localhost:3000

python manage.py shell

# Expected in console output:
# ============================================================
# 🚀 PRIMEPOS BACKEND STARTUP INFO
# ============================================================
#   DEBUG: False
#   DATABASE: primepos (from URL)
#   ALLOWED_HOSTS: ['localhost']
#   CORS_ORIGINS: 1 domain(s) configured
# ============================================================
```

---

## Step 6: Verify Files Were Created

Check these files exist:

```bash
# Health app files
ls -la backend/apps/health/
# Should show: __init__.py, apps.py, views.py, urls.py

# Startup validation
ls -la backend/primepos/startup.py
# Should exist

# Environment example
ls -la backend/.env.example
# Should exist

# Updated render.yaml
ls -la backend/render.yaml
# Should exist with backend service config
```

---

## Step 7: Verify Django Checks Pass

```bash
cd backend

# Development mode check
python manage.py check

# Expected: System check identified no issues (0 silenced).

# Production mode check (with env vars set)
DEBUG=False \
DATABASE_URL=postgresql://postgres:kwitonda@localhost:5432/primepos \
ALLOWED_HOSTS=localhost \
CORS_ALLOWED_ORIGINS=http://localhost \
python manage.py check --deploy

# Expected: System check identified no issues (0 silenced).
```

---

## Quick Test Checklist

- [ ] Health endpoint returns 200 at `/health/`
- [ ] Readiness endpoint returns 200 at `/health/ready/`
- [ ] Missing env vars in production = clear error message
- [ ] Proper env vars = no errors on startup
- [ ] Startup logs show configuration info
- [ ] Health app files created correctly
- [ ] startup.py file created correctly
- [ ] .env.example file created correctly
- [ ] render.yaml updated with backend service
- [ ] requirements.txt has gunicorn and whitenoise

---

## Troubleshooting

### ❌ Problem: "apps.health not found"
**Solution**: Ensure `apps.health` is in INSTALLED_APPS in settings/base.py
```bash
grep "apps.health" backend/primepos/settings/base.py
# Should show: 'apps.health',
```

### ❌ Problem: Health endpoint returns 404
**Solution**: Ensure health URLs are included in main urls.py
```bash
grep "apps.health" backend/primepos/urls.py
# Should show: path('', include('apps.health.urls')),
```

### ❌ Problem: Validation not running
**Solution**: Ensure wsgi.py and manage.py import startup
```bash
grep "validate_production_env" backend/primepos/wsgi.py
grep "validate_production_env" backend/manage.py
# Both should have the import and function call
```

### ❌ Problem: "ModuleNotFoundError: No module named 'gunicorn'"
**Solution**: Ensure gunicorn is in requirements.txt and installed
```bash
grep gunicorn backend/requirements.txt
# Should show: gunicorn==21.2.0

pip install -r backend/requirements.txt
```

---

## Next Steps After Verification

✅ **All tests passing?** Great! You're ready to deploy.

1. **Commit changes**
   ```bash
   git add .
   git commit -m "fix: implement critical deployment blockers"
   git push origin main
   ```

2. **Set Render environment variables**
   - Go to Render dashboard
   - Add to primepos-backend service:
     ```
     SECRET_KEY=<generate-random>
     DEBUG=False
     DATABASE_URL=<from-render-postgres>
     ALLOWED_HOSTS=api.yourdomain.com,yourdomain.com
     CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
     ```

3. **Deploy**
   - Push to main branch
   - Render auto-deploys

4. **Verify deployment**
   ```bash
   curl https://api.yourdomain.com/health/
   # Should return 200 with healthy status
   ```

---

## Reference Documentation

- Full Implementation Guide: [CRITICAL_BLOCKERS_FIXED.md](./CRITICAL_BLOCKERS_FIXED.md)
- Deployment Audit: [DEPLOYMENT_READINESS_AUDIT.md](./DEPLOYMENT_READINESS_AUDIT.md)
- Environment Variables: [backend/.env.example](./backend/.env.example)
- Health Views: [backend/apps/health/views.py](./backend/apps/health/views.py)
- Startup Validation: [backend/primepos/startup.py](./backend/primepos/startup.py)

---

**Testing Status**: Ready to test  
**Time Estimate**: 15 minutes  
**Difficulty**: Easy  
**Prerequisites**: Local development environment running

Good luck! 🚀
