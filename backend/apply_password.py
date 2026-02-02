#!/usr/bin/env python
"""
Apply password hash to Render database using psycopg2
"""
import psycopg2
from urllib.parse import urlparse

# The correct password hash generated above
password_hash = "pbkdf2_sha256$600000$DBYJnLUlNT5sRMSHJjuUSh$X3evFxx+unN2TbwiDFwwdtChSWYPF4SVp8hOwG9j6Fc="

# Render PostgreSQL credentials
db_url = "postgresql://primepos_user:YvQRZCSwD7P8vIkLu96Sp8Rrr9hGaHJY@dpg-d5uu72qqcgvc7395prkg-a.postgres.render.com/primepos"

try:
    conn = psycopg2.connect(db_url, sslmode='require')
    cursor = conn.cursor()
    
    # Update the password
    cursor.execute(
        "UPDATE accounts_user SET password = %s WHERE email = %s",
        (password_hash, 'kwitondakenny@gmail.com')
    )
    
    # Verify
    cursor.execute(
        "SELECT id, email, password, is_superuser FROM accounts_user WHERE email = %s",
        ('kwitondakenny@gmail.com',)
    )
    
    result = cursor.fetchone()
    conn.commit()
    cursor.close()
    conn.close()
    
    if result:
        print("\n" + "="*60)
        print("✅ PASSWORD UPDATED SUCCESSFULLY")
        print("="*60)
        print(f"\nUser ID: {result[0]}")
        print(f"Email: {result[1]}")
        print(f"Hash: {result[2][:50]}...")
        print(f"Is Superuser: {result[3]}")
        print("\n✅ Authentication should now work!")
        print("\nTest login at: https://primepos-5mf6.onrender.com/api/v1/auth/login/")
        print("Email: kwitondakenny@gmail.com")
        print("Password: kwitonda")
        print("="*60 + "\n")
    else:
        print("❌ User not found")
        
except Exception as e:
    print(f"❌ Error: {e}")
    print("\nAlternative: Use pgAdmin 4 to run this SQL manually:")
    print(f"UPDATE accounts_user SET password = '{password_hash}' WHERE email = 'kwitondakenny@gmail.com';")
