"""
Production startup validation.
Ensures critical environment variables and configurations are set before app starts.
"""

import os
from django.conf import settings


def validate_production_env():
    """
    Validate critical environment variables are set for production.
    Fails fast with clear error messages if production config is incomplete.

    Raises:
        RuntimeError: If production environment variables are missing or invalid.
    """
    # Only validate in production mode
    if not settings.DEBUG:
        required_checks = {
            "SECRET_KEY": (
                settings.SECRET_KEY != "django-insecure-change-me-in-production",
                "SECRET_KEY not changed from default (CRITICAL SECURITY RISK)",
            ),
            "DATABASE_URL": (
                bool(os.environ.get("DATABASE_URL")),
                "DATABASE_URL not set (will use SQLite - data loss risk)",
            ),
            "ALLOWED_HOSTS": (
                bool(
                    getattr(settings, "ALLOWED_HOSTS", None)
                    and any(host != "*" for host in settings.ALLOWED_HOSTS)
                ),
                "ALLOWED_HOSTS not properly configured",
            ),
            "CORS_ALLOWED_ORIGINS": (
                bool(getattr(settings, "CORS_ALLOWED_ORIGINS", None)),
                "CORS_ALLOWED_ORIGINS not set (frontend requests will fail)",
            ),
        }

        failures = []
        for check_name, (check_result, error_msg) in required_checks.items():
            if not check_result:
                failures.append(f"  ❌ {check_name}: {error_msg}")

        if failures:
            error_text = (
                "🚨 PRODUCTION MODE - MISSING REQUIRED ENV VARIABLES:\n\n"
                + "\n".join(failures)
                + "\n\nSet these env variables before deploying:\n"
                "  1. SECRET_KEY (min 50 random chars)\n"
                "  2. DATABASE_URL (PostgreSQL connection)\n"
                "  3. ALLOWED_HOSTS (your domain)\n"
                "  4. CORS_ALLOWED_ORIGINS (frontend domain)\n\n"
                "See DEPLOYMENT_READINESS_AUDIT.md for details."
            )
            raise RuntimeError(error_text)


def log_startup_info():
    """Log sanitized startup configuration for debugging."""
    print("\n" + "=" * 60)
    print("🚀 PRIMEPOS BACKEND STARTUP INFO")
    print("=" * 60)
    print(f"  DEBUG: {settings.DEBUG}")
    db_url = os.environ.get("DATABASE_URL", "NOT SET")
    if db_url != "NOT SET":
        # Sanitize database URL (hide password)
        db_url = db_url.split("@")[-1] if "@" in db_url else db_url[:30] + "..."
    print(f"  DATABASE: {db_url}")
    print(f"  ALLOWED_HOSTS: {settings.ALLOWED_HOSTS}")
    cors_origins = getattr(settings, "CORS_ALLOWED_ORIGINS", [])
    print(f"  CORS_ORIGINS: {len(cors_origins)} domain(s) configured")
    print("=" * 60 + "\n")
