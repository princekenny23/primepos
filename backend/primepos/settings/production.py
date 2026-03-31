"""
Production settings
"""
from .base import *
import os
from decouple import config

DEBUG = False

# Security settings for production
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=False, cast=bool)
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# Hosts and CORS
ALLOWED_HOSTS = config(
    'ALLOWED_HOSTS',
    default='localhost,127.0.0.1',
    cast=lambda v: [s.strip() for s in v.split(',')]
)
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:3000',
    cast=lambda v: [s.strip() for s in v.split(',')]
)

# Allow any Render.com subdomain so the frontend service can reach the backend
# regardless of the auto-generated Render URL, while still keeping CORS strict
# for non-Render origins.  Override via CORS_ALLOWED_ORIGINS env var for custom domains.
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://primepos[\w-]*\.onrender\.com$",
]

# Static files
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

