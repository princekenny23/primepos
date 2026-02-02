# 🔐 Authentication Fix Guide

## Problem
Password hash authentication was failing because the hash wasn't properly set in the database.

## Solution

### Option 1: Use pgAdmin 4 (Recommended - Fastest)

1. **Open pgAdmin 4**
   - Navigate to: https://pgadmin4.com or your local pgAdmin instance
   - Server: dpg-d5uu72qqcgvc7395prkg-a.postgres.render.com
   - Database: primepos

2. **Run the SQL script**
   - Open: `backend/FIX_PASSWORD.sql`
   - Copy all queries
   - Paste in pgAdmin 4 Query Tool
   - Execute (F5 or Execute button)

3. **Expected Output**
   ```
   id | email | is_superuser | password
   ---|-------|--------------|----------
   1  | kwitondakenny@gmail.com | t | pbkdf2_sha256$600000$...
   ```

### Option 2: Use Django Management Command (Requires Local DB Setup)

Once you have a working local PostgreSQL with Django shell:

```bash
cd backend
python manage.py set_user_password kwitondakenny@gmail.com kwitonda
```

This uses Django's built-in `set_password()` method which automatically handles hashing.

### Option 3: Manual SQL Execution

If you have psql or database client:

```bash
psql "postgresql://primepos_user:YvQRZCSwD7P8vIkLu96Sp8Rrr9hGaHJY@dpg-d5uu72qqcgvc7395prkg-a.postgres.render.com/primepos"
```

Then run:
```sql
UPDATE accounts_user 
SET password = 'pbkdf2_sha256$600000$DBYJnLUlNT5sRMSHJjuUSh$X3evFxx+unN2TbwiDFwwdtChSWYPF4SVp8hOwG9j6Fc='
WHERE email = 'kwitondakenny@gmail.com';
```

## Test Login

After applying the password hash:

**Endpoint:** `POST https://primepos-5mf6.onrender.com/api/v1/auth/login/`

**Request Body:**
```json
{
  "email": "kwitondakenny@gmail.com",
  "password": "kwitonda"
}
```

**Expected Response (200 OK):**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "kwitondakenny@gmail.com",
    "name": "Admin User",
    "is_superuser": true,
    "role": "saas_admin"
  }
}
```

## Troubleshooting

### "Invalid credentials" after applying hash
- **Check:** Verify user exists: `SELECT * FROM accounts_user WHERE email = 'kwitondakenny@gmail.com';`
- **Check:** Hash was updated: `SELECT password FROM accounts_user WHERE email = 'kwitondakenny@gmail.com';`
- **Check:** Password matches: Should be exactly `pbkdf2_sha256$600000$DBYJnLUlNT5sRMSHJjuUSh$X3evFxx+unN2TbwiDFwwdtChSWYPF4SVp8hOwG9j6Fc=`

### User doesn't exist
Create user first:
```sql
INSERT INTO accounts_user (email, name, password, is_superuser, is_staff, is_active, created_at, updated_at, phone)
VALUES (
  'kwitondakenny@gmail.com',
  'Admin User',
  'pbkdf2_sha256$600000$DBYJnLUlNT5sRMSHJjuUSh$X3evFxx+unN2TbwiDFwwdtChSWYPF4SVp8hOwG9j6Fc=',
  true,
  true,
  true,
  NOW(),
  NOW(),
  ''
);
```

### Network error connecting from Python
This is expected on local machine without Render VPN. Use pgAdmin 4 instead (Option 1).

## Key Files Created

- **FIX_PASSWORD.sql** - SQL script with hash already generated
- **fix_password_hash.py** - Generates the hash locally (no DB needed)
- **apply_password.py** - Applies hash to Render DB (requires network)
- **apps/accounts/management/commands/set_user_password.py** - Django management command for local dev

## Next Steps After Login Works

1. ✅ Test login endpoint → get JWT tokens
2. ✅ Use token to test API endpoints (products, sales, inventory)
3. ✅ Implement critical modals (Quick Sale, Add Product, etc.)
4. ✅ Complete frontend-backend integration
5. ✅ Plan Firebase migration once billing account ready
