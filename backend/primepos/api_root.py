"""
API Root view - Lists all available endpoints
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@permission_classes([AllowAny])
def api_root(request):
    """API root endpoint listing all available endpoints"""
    return Response({
        'message': 'PrimePOS API v1',
        'version': '1.0.0',
        'endpoints': {
            'authentication': {
                'login': '/api/v1/auth/login/',
                'register': '/api/v1/auth/register/',
                'refresh': '/api/v1/auth/refresh/',
                'logout': '/api/v1/auth/logout/',
                'me': '/api/v1/auth/me/',
            },
            'tenants': {
                'list': '/api/v1/tenants/',
                'current': '/api/v1/tenants/current/',
            },
            'outlets': {
                'list': '/api/v1/outlets/',
                'tills': '/api/v1/tills/',
            },
            'products': {
                'list': '/api/v1/products/',
                'categories': '/api/v1/categories/',
                'low_stock': '/api/v1/products/low_stock/',
            },
            'sales': {
                'list': '/api/v1/sales/',
                'stats': '/api/v1/sales/stats/',
            },
            'customers': {
                'list': '/api/v1/customers/',
            },
            'inventory': {
                'movements': '/api/v1/inventory/movements/',
                'adjust': '/api/v1/inventory/adjust/',
                'transfer': '/api/v1/inventory/transfer/',
                'stock_take': '/api/v1/inventory/stock-take/',
            },
            'shifts': {
                'list': '/api/v1/shifts/',
                'start': '/api/v1/shifts/start/',
                'active': '/api/v1/shifts/active/',
                'history': '/api/v1/shifts/history/',
                'check': '/api/v1/shifts/check/',
            },
            'staff': {
                'list': '/api/v1/staff/',
                'roles': '/api/v1/roles/',
                'attendance': '/api/v1/attendance/',
            },
            'reports': {
                'sales': '/api/v1/reports/sales/',
                'products': '/api/v1/reports/products/',
                'customers': '/api/v1/reports/customers/',
                'profit_loss': '/api/v1/reports/profit-loss/',
                'stock_movement': '/api/v1/reports/stock-movement/',
            },
            'distribution': {
                'vehicles': '/api/v1/distribution/vehicles/',
                'drivers': '/api/v1/distribution/drivers/',
                'delivery_orders': '/api/v1/distribution/delivery-orders/',
                'create_delivery_order_from_sale': '/api/v1/distribution/delivery-orders/create-from-sale/',
                'trips': '/api/v1/distribution/trips/',
                'active_trips': '/api/v1/distribution/trips/active/',
                'available_vehicles': '/api/v1/distribution/vehicles/available/',
                'available_drivers': '/api/v1/distribution/drivers/available/',
            },
            'admin': {
                'tenants': '/api/v1/admin/tenants/',
                'analytics': '/api/v1/admin/analytics/',
            },
        },
        'documentation': 'Visit /admin/ for Django admin interface',
    })

