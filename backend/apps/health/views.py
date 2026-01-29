from django.http import JsonResponse
from django.views.decorators.http import require_http_methods


@require_http_methods(["GET"])
def health(request):
    """
    Liveness probe - is the app running?
    Used by Render to check if the service is alive.
    Returns 200 if the app is running, regardless of dependencies.
    """
    return JsonResponse(
        {
            "status": "healthy",
            "service": "primepos-backend",
            "version": "1.0.0",
        },
        status=200,
    )


@require_http_methods(["GET"])
def readiness(request):
    """
    Readiness probe - is the app ready to serve requests?
    Checks database connectivity and critical services.
    Returns 200 if ready, 503 if not ready.
    """
    from django.db import connection

    try:
        # Check database connectivity
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")

        return JsonResponse(
            {
                "status": "ready",
                "service": "primepos-backend",
                "database": "connected",
                "version": "1.0.0",
            },
            status=200,
        )
    except Exception as e:
        return JsonResponse(
            {
                "status": "not_ready",
                "service": "primepos-backend",
                "database": "disconnected",
                "error": str(e),
            },
            status=503,
        )
