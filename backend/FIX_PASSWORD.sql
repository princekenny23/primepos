-- PrimeOS Authentication Fix Script
-- Run this in pgAdmin 4 or psql to fix the password hash

-- First, verify the user exists
SELECT id, email, is_superuser, password FROM accounts_user WHERE email = 'kwitondakenny@gmail.com';

-- Update the password with the correct hash
UPDATE accounts_user 
SET password = 'pbkdf2_sha256$600000$DBYJnLUlNT5sRMSHJjuUSh$X3evFxx+unN2TbwiDFwwdtChSWYPF4SVp8hOwG9j6Fc='
WHERE email = 'kwitondakenny@gmail.com';

-- Verify the update
SELECT id, email, is_superuser, password FROM accounts_user WHERE email = 'kwitondakenny@gmail.com';

-- Now login should work with:
-- Email: kwitondakenny@gmail.com
-- Password: kwitonda
-- Endpoint: POST https://primepos-5mf6.onrender.com/api/v1/auth/login/
