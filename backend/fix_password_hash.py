#!/usr/bin/env python
"""
Generate and set a proper Django password hash without database connection.
This avoids psycopg2 issues by generating the hash locally, then providing SQL to update.
"""

import os
import sys
import django

# Setup Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'primepos.settings')

# Configure Django without hitting the database
from django.conf import settings
settings.configure(
    DEBUG=True,
    USE_TZ=True,
    PASSWORD_HASHERS=[
        'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    ]
)

from django.contrib.auth.hashers import make_password

# Generate password hash
password = "kwitonda"
password_hash = make_password(password)

print("\n" + "="*60)
print("PASSWORD HASH GENERATION")
print("="*60)
print(f"\nPassword: {password}")
print(f"Generated Hash: {password_hash}")
print("\n" + "="*60)
print("SQL UPDATE COMMAND")
print("="*60)
print(f"\nRun this SQL in your database (pgAdmin or psql):\n")
print(f"""UPDATE accounts_user 
SET password = '{password_hash}'
WHERE email = 'kwitondakenny@gmail.com';
""")

print("="*60)
print("For Render Database:")
print("="*60)
print("\n1. Open pgAdmin 4 (or use psql)")
print("2. Connect to: dpg-d5uu72qqcgvc7395prkg-a.postgres.render.com")
print("3. Copy and paste the SQL above")
print("4. Execute the query")
print("5. Verify: SELECT id, email, password FROM accounts_user WHERE email = 'kwitondakenny@gmail.com';")
print("\nThen test login at: https://primepos-5mf6.onrender.com/api/v1/auth/login/")
print("="*60 + "\n")
