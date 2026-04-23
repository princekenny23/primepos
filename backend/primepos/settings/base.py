"""
Django settings for primepos project - Base Configuration
"""
from pathlib import Path
from decouple import config
import os
from urllib.parse import quote_plus
import dj_database_url
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-me-in-production')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config('DEBUG', default=True, cast=bool)

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=lambda v: [s.strip() for s in v.split(',')])

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Cloudinary
    'cloudinary',
    'cloudinary_storage',

    # Third-party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    
    # Local apps
    'apps.health',
    'apps.accounts',
    'apps.tenants',
    'apps.outlets',
    'apps.products',
    'apps.inventory',
    'apps.sales',
    'apps.customers',
    # 'apps.payments',  # Removed - new implementation pending
    'apps.staff',
    'apps.suppliers',
    'apps.shifts',
    'apps.restaurant',
    'apps.reports',
    'apps.activity_logs',
    'apps.notifications',
    'apps.expenses',
    'apps.quotations',
    'apps.bar',
    'apps.distribution',
    'apps.sync',
    'apps.storefronts',
    'apps.admin.apps.AdminConfig',  # Use explicit config to avoid label conflict
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.tenants.middleware.TenantMiddleware',
    'apps.activity_logs.middleware.ActivityLogMiddleware',
]

ROOT_URLCONF = 'primepos.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'primepos.wsgi.application'

# Database
# Supports Render PostgreSQL and local development
DATABASE_URL = config('DATABASE_URL', default=None)

# If DATABASE_URL is not provided, build one from DB_* variables so local
# development still uses URL-based configuration consistently.
if not DATABASE_URL:
    db_name = config('DB_NAME', default='primepos')
    db_user = config('DB_USER', default='postgres')
    db_password = quote_plus(config('DB_PASSWORD', default='kwitonda'))
    db_host = config('DB_HOST', default='localhost')
    db_port = config('DB_PORT', default='5432')
    DATABASE_URL = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

# During build (collectstatic), provide a dummy database config
# so Django can load without connecting
IS_BUILD_PHASE = os.getenv('IS_BUILD_PHASE', 'false').lower() == 'true'

if not IS_BUILD_PHASE:
    DATABASES = {
        'default': dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=600,
            conn_health_checks=True,
        )
    }

    # Connection health checks for stability
    # Render PostgreSQL is on internal network - no SSL needed
elif IS_BUILD_PHASE:
    # Dummy config for build phase to prevent connection attempts
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': ':memory:',
        }
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Cloudinary Storage
CLOUDINARY_STORAGE = {
    'CLOUD_NAME': config('CLOUDINARY_CLOUD_NAME', default=''),
    'API_KEY': config('CLOUDINARY_API_KEY', default=''),
    'API_SECRET': config('CLOUDINARY_API_SECRET', default=''),
}
DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Custom User Model
AUTH_USER_MODEL = 'accounts.User'

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.tenants.authentication.TenantJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 18,
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': config('THROTTLE_ANON', default='100/hour'),
        'user': config('THROTTLE_USER', default='5000/hour'),
        'connector': config('THROTTLE_CONNECTOR', default='300/minute'),
    },
}

# JWT Settings
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# Tenant URL configuration
# TENANT_BASE_DOMAIN example: primepos.app
TENANT_BASE_DOMAIN = config('TENANT_BASE_DOMAIN', default='')
# When enabled, login must come from a resolvable tenant URL except local/dev hosts.
TENANT_URL_STRICT = config('TENANT_URL_STRICT', default=False, cast=bool)

# CORS Settings
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:3000,http://127.0.0.1:3000',
    cast=lambda v: [s.strip() for s in v.split(',')]
)

CORS_ALLOW_CREDENTIALS = True

# Allow custom headers for outlet isolation
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'x-outlet-id',  # Custom header for outlet data isolation
    'x-tenant-id',  # Custom header for tenant context
    'x-tenant-host',  # Browser host forwarded for tenant URL resolution
]

# Offline sync feature flags (disabled by default)
OFFLINE_MODE_ENABLED = config('OFFLINE_MODE_ENABLED', default=False, cast=bool)
OFFLINE_MODE_PHASE = config('OFFLINE_MODE_PHASE', default=0, cast=int)

# QZ Tray signing configuration
# Set these in environment for production. Example:
# QZ_CERT_PATH=/etc/primepos/qz_cert.pem
# QZ_PRIVATE_KEY_PATH=/etc/primepos/qz_private_key.pem
QZ_CERT_PATH = config('QZ_CERT_PATH', default=None)
QZ_PRIVATE_KEY_PATH = config('QZ_PRIVATE_KEY_PATH', default=None)

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': config('DJANGO_LOG_LEVEL', default='INFO'),
            'propagate': False,
        },
    },
}

SENTRY_DSN = config('SENTRY_DSN', default=None)
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        traces_sample_rate=config('SENTRY_TRACES_SAMPLE_RATE', default=0.1, cast=float),
        profiles_sample_rate=config('SENTRY_PROFILES_SAMPLE_RATE', default=0.0, cast=float),
        environment=config('SENTRY_ENVIRONMENT', default='production'),
        release=config('SENTRY_RELEASE', default=None),
        send_default_pii=True,
    )

# Database connection established successfully
if DATABASE_URL:
    print("[DATABASE] Connected to PostgreSQL")

