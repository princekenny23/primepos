"""
WSGI config for primepos project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application
from primepos.startup import validate_production_env, log_startup_info

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'primepos.settings.production')

# Validate production environment BEFORE app loads
validate_production_env()
log_startup_info()

application = get_wsgi_application()

