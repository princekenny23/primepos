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
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1').split(',')
# When CORS_ALLOW_ALL_ORIGINS is True, all origins are accepted (useful during initial
# deployment setup). Otherwise, specify allowed origins via CORS_ALLOWED_ORIGINS.
CORS_ALLOW_ALL_ORIGINS = config('CORS_ALLOW_ALL_ORIGINS', default=False, cast=bool)
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:3000,http://127.0.0.1:3000',
    cast=lambda v: [s.strip() for s in v.split(',') if s.strip()]
)

# Static files
STATIC_ROOT = '/var/www/primepos/staticfiles/'
MEDIA_ROOT = '/var/www/primepos/media/'

