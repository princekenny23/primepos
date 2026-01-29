#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'primepos.settings.development')
    try:
        from django.core.management import execute_from_command_line
        from primepos.startup import validate_production_env, log_startup_info
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    
    # Validate environment (will raise RuntimeError if production config missing)
    try:
        validate_production_env()
    except RuntimeError as e:
        # In development, just warn. In production, fail hard.
        if not os.environ.get('DEBUG', 'True').lower() == 'true':
            raise
        print(f"⚠️  Development mode - skipping validation: {e}")
    
    log_startup_info()
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()

