import json
from django.utils.deprecation import MiddlewareMixin
from django.utils import timezone
from .models import ActivityLog
from django.contrib.auth import get_user_model

User = get_user_model()


class ActivityLogMiddleware(MiddlewareMixin):
    """
    Middleware to automatically log system actions.
    Captures API requests and logs them as activity logs.
    """
    
    # Paths to exclude from logging
    EXCLUDED_PATHS = [
        '/admin/',
        '/static/',
        '/media/',
        '/api/v1/activity-logs/',  # Don't log activity log reads
        '/api/v1/auth/login/',  # Login is logged separately
        '/api/v1/auth/refresh/',
    ]
    
    # HTTP methods to log
    LOGGED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']
    
    def process_response(self, request, response):
        """Log the request after processing"""
        
        # Skip excluded paths
        if any(request.path.startswith(path) for path in self.EXCLUDED_PATHS):
            return response
        
        # Only log specific HTTP methods
        if request.method not in self.LOGGED_METHODS:
            return response
        
        # Skip if no tenant (unauthenticated or SaaS admin viewing all)
        if not hasattr(request, 'tenant') or not request.tenant:
            return response
        
        # Skip if no authenticated user
        if not hasattr(request, 'user') or not request.user.is_authenticated:
            return response
        
        # Skip if response is an error (4xx, 5xx) - we only log successful actions
        if response.status_code >= 400:
            return response
        
        try:
            # Determine action type from HTTP method
            action_map = {
                'POST': ActivityLog.ACTION_CREATE,
                'PUT': ActivityLog.ACTION_UPDATE,
                'PATCH': ActivityLog.ACTION_UPDATE,
                'DELETE': ActivityLog.ACTION_DELETE,
            }
            action = action_map.get(request.method)
            
            if not action:
                return response
            
            # Determine module from path
            module = self._get_module_from_path(request.path)
            if not module:
                return response
            
            # Extract resource information
            resource_type, resource_id = self._extract_resource_info(request.path, response)
            
            # Build description
            description = self._build_description(request, action, resource_type, resource_id)
            
            # Extract metadata from request body
            metadata = self._extract_metadata(request, response)
            
            # Get IP address
            ip_address = self._get_client_ip(request)
            
            # Create activity log
            ActivityLog.objects.create(
                tenant=request.tenant,
                user=request.user,
                action=action,
                module=module,
                resource_type=resource_type,
                resource_id=resource_id,
                description=description,
                metadata=metadata,
                ip_address=ip_address,
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                request_path=request.path,
                request_method=request.method,
            )
        except Exception as e:
            # Don't break the request if logging fails
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to create activity log: {str(e)}")
        
        return response
    
    def _get_module_from_path(self, path):
        """Extract module name from API path"""
        path_parts = path.strip('/').split('/')
        if len(path_parts) >= 2 and path_parts[0] == 'api' and path_parts[1] == 'v1':
            module = path_parts[2] if len(path_parts) > 2 else None
            
            # Map API endpoints to modules
            module_map = {
                'sales': ActivityLog.MODULE_SALES,
                'products': ActivityLog.MODULE_PRODUCTS,
                'inventory': ActivityLog.MODULE_INVENTORY,
                'customers': ActivityLog.MODULE_CUSTOMERS,
                'payments': ActivityLog.MODULE_PAYMENTS,
                'shifts': ActivityLog.MODULE_SHIFTS,
                'cash': ActivityLog.MODULE_CASH,
                'suppliers': ActivityLog.MODULE_SUPPLIERS,
                'restaurant': ActivityLog.MODULE_RESTAURANT,
                'accounts': ActivityLog.MODULE_USERS,
                'tenants': ActivityLog.MODULE_SETTINGS,
                'outlets': ActivityLog.MODULE_SETTINGS,
            }
            
            return module_map.get(module)
        return None
    
    def _extract_resource_info(self, path, response):
        """Extract resource type and ID from path or response"""
        path_parts = path.strip('/').split('/')
        resource_type = None
        resource_id = None
        
        # Try to get resource ID from path
        if len(path_parts) >= 4:
            # Check if last part is an ID (numeric or UUID-like)
            potential_id = path_parts[-1]
            if potential_id and potential_id not in ['', 'checkout-cash', 'open', 'close', 'current']:
                resource_id = potential_id
        
        # Try to get resource type and ID from response
        if hasattr(response, 'data') and isinstance(response.data, dict):
            # Check for common resource fields
            if 'id' in response.data:
                resource_id = str(response.data['id'])
            if 'resource_type' in response.data:
                resource_type = response.data['resource_type']
        
        # Infer resource type from path
        if not resource_type:
            module_map = {
                'sales': 'Sale',
                'products': 'Product',
                'inventory': 'StockMovement',
                'customers': 'Customer',
                'payments': 'Payment',
                'shifts': 'Shift',
                'cash': 'CashMovement',
                'suppliers': 'Supplier',
                'restaurant': 'Order',
                'accounts': 'User',
                'tenants': 'Tenant',
                'outlets': 'Outlet',
            }
            path_parts = path.strip('/').split('/')
            if len(path_parts) >= 3 and path_parts[0] == 'api' and path_parts[1] == 'v1':
                module = path_parts[2]
                resource_type = module_map.get(module, module.title())
        
        return resource_type or '', resource_id or ''
    
    def _build_description(self, request, action, resource_type, resource_id):
        """Build human-readable description"""
        action_display = {
            ActivityLog.ACTION_CREATE: 'created',
            ActivityLog.ACTION_UPDATE: 'updated',
            ActivityLog.ACTION_DELETE: 'deleted',
        }.get(action, action)
        
        if resource_type and resource_id:
            return f"{action_display.title()} {resource_type} (ID: {resource_id})"
        elif resource_type:
            return f"{action_display.title()} {resource_type}"
        else:
            return f"{action_display.title()} resource"
    
    def _extract_metadata(self, request, response):
        """Extract relevant metadata from request and response"""
        metadata = {}
        
        # Get request body if available (avoid accessing if already consumed)
        if hasattr(request, 'body') and request.body:
            try:
                # Check if body has been consumed by checking if _load_post_and_files has been called
                if not hasattr(request, '_post') or not hasattr(request, '_files'):
                    body = json.loads(request.body)
                    # Only include non-sensitive fields
                    safe_fields = ['quantity', 'amount', 'status', 'type']
                    for field in safe_fields:
                        if field in body:
                            metadata[field] = body[field]
            except (json.JSONDecodeError, TypeError, AttributeError):
                pass
        
        # Get response data if available
        if hasattr(response, 'data') and isinstance(response.data, dict):
            # Include summary fields
            summary_fields = ['total', 'amount', 'status', 'id']
            for field in summary_fields:
                if field in response.data:
                    metadata[f'response_{field}'] = response.data[field]
        
        return metadata
    
    def _get_client_ip(self, request):
        """Get client IP address from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

