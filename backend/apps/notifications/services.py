"""
Notification Service for creating notifications automatically when events occur.
Square POS-like notification system.
"""
from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Notification
from .serializers import NotificationSerializer

channel_layer = get_channel_layer()


class NotificationService:
    """Service for creating and managing notifications"""
    
    @staticmethod
    def _send_websocket_notification(notification):
        """Send notification via WebSocket to relevant users"""
        if not channel_layer:
            return
        
        try:
            # Serialize notification
            serializer = NotificationSerializer(notification)
            notification_data = serializer.data
            
            # Send to specific user if notification is user-specific
            if notification.user:
                async_to_sync(channel_layer.group_send)(
                    f'notifications_{notification.user.id}',
                    {
                        'type': 'notification_message',
                        'notification': notification_data
                    }
                )
                # Also send unread count update
                unread_count = Notification.objects.filter(
                    tenant=notification.tenant,
                    user=notification.user,
                    read=False
                ).count()
                async_to_sync(channel_layer.group_send)(
                    f'notifications_{notification.user.id}',
                    {
                        'type': 'notification_count',
                        'unread_count': unread_count
                    }
                )
            else:
                # Send to all users in the tenant (general notifications)
                from django.contrib.auth import get_user_model
                User = get_user_model()
                tenant_users = User.objects.filter(tenant=notification.tenant)
                for user in tenant_users:
                    async_to_sync(channel_layer.group_send)(
                        f'notifications_{user.id}',
                        {
                            'type': 'notification_message',
                            'notification': notification_data
                        }
                    )
                    # Also send unread count update
                    unread_count = Notification.objects.filter(
                        tenant=notification.tenant,
                        user=user,
                        read=False
                    ).count()
                    async_to_sync(channel_layer.group_send)(
                        f'notifications_{user.id}',
                        {
                            'type': 'notification_count',
                            'unread_count': unread_count
                        }
                    )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to send WebSocket notification: {str(e)}")
    
    @staticmethod
    def _send_sale_update(sale, action='created'):
        """Send sale update via WebSocket to relevant users for real-time sales list updates"""
        if not channel_layer:
            return
        
        try:
            # Refresh sale with all relationships to avoid N+1 queries
            from apps.sales.models import Sale
            sale = Sale.objects.select_related(
                'tenant', 'outlet', 'user', 'shift', 'customer'
            ).prefetch_related(
                'items',
                'items__product'
            ).get(id=sale.id)
            
            # Serialize sale data
            from apps.sales.serializers import SaleSerializer
            serializer = SaleSerializer(sale)
            sale_data = serializer.data
            
            # Get tenant users who should receive this update
            from django.contrib.auth import get_user_model
            User = get_user_model()
            
            # Send to all users in the tenant (or optionally filter by outlet)
            tenant_users = User.objects.filter(tenant=sale.tenant)
            
            for user in tenant_users:
                # Send sale update to user's notification channel
                async_to_sync(channel_layer.group_send)(
                    f'notifications_{user.id}',
                    {
                        'type': 'sale_update',
                        'sale': sale_data,
                        'action': action  # 'created', 'updated', 'refunded'
                    }
                )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to send sale update via WebSocket: {str(e)}")
    
    @staticmethod
    def notify_sale_completed(sale):
        """Create notification when a sale is completed"""
        notification = Notification.objects.create(
            tenant=sale.tenant,
            type=Notification.TYPE_SALE,
            priority=Notification.PRIORITY_NORMAL,
            title=f"Sale Completed: {sale.receipt_number}",
            message=f"Sale #{sale.receipt_number} completed for {sale.total} {sale.tenant.currency or 'MWK'}",
            resource_type='Sale',
            resource_id=str(sale.id),
            link=f"/dashboard/sales/{sale.id}",
            metadata={
                'sale_id': sale.id,
                'receipt_number': sale.receipt_number,
                'total': str(sale.total),
                'outlet': sale.outlet.name if sale.outlet else None,
                'outlet_id': sale.outlet.id if sale.outlet else None,
            }
        )
        NotificationService._send_websocket_notification(notification)
        
        # Also send real-time sale update to all users in the tenant/outlet
        NotificationService._send_sale_update(sale, 'created')
    
    @staticmethod
    def notify_low_stock(product_or_unit, outlet=None):
        """Create notification when stock is low (product or product unit)"""
        # Support both ProductUnit (unit) and Product
        try:
            product = product_or_unit.product
        except Exception:
            product = product_or_unit

        product_name = product.name
        # Determine current stock and threshold from the given object if available
        try:
            current_stock = product_or_unit.get_total_stock(outlet) if outlet else product_or_unit.get_total_stock()
        except Exception:
            # Fallback to inventory helpers
            from apps.inventory.stock_helpers import get_available_stock
            current_stock = get_available_stock(product, outlet) if outlet else get_available_stock(product, None)

        threshold = getattr(product_or_unit, 'low_stock_threshold', getattr(product, 'low_stock_threshold', None))

        notification = Notification.objects.create(
            tenant=product.tenant,
            type=Notification.TYPE_STOCK,
            priority=Notification.PRIORITY_HIGH,
            title=f"Low Stock Alert: {product_name}",
            message=f"{product_name} is running low. Current stock: {current_stock}, Threshold: {threshold}",
            resource_type='Product',
            resource_id=str(product.id),
            link=f"/dashboard/products/{product.id}",
            metadata={
                'product_id': product.id,
                'product_name': product_name,
                'current_stock': current_stock,
                'threshold': threshold,
                'outlet': outlet.name if outlet else None,
                'outlet_id': outlet.id if outlet else None,
            }
        )
        NotificationService._send_websocket_notification(notification)
    
    @staticmethod
    def notify_shift_opened(shift):
        """Create notification when a shift is opened"""
        notification = Notification.objects.create(
            tenant=shift.outlet.tenant,
            type=Notification.TYPE_SYSTEM,
            priority=Notification.PRIORITY_NORMAL,
            title=f"Shift Opened: {shift.outlet.name}",
            message=f"Shift opened at {shift.outlet.name} by {shift.user.name or shift.user.email}",
            resource_type='Shift',
            resource_id=str(shift.id),
            link=f"/dashboard/office/shift-management/active",
            metadata={
                'shift_id': shift.id,
                'outlet': shift.outlet.name,
                'outlet_id': shift.outlet.id,
                'user': shift.user.email,
                'opening_cash': str(shift.opening_cash_balance),
            }
        )
        NotificationService._send_websocket_notification(notification)
    
    @staticmethod
    def notify_shift_closed(shift):
        """Create notification when a shift is closed"""
        difference = shift.difference if hasattr(shift, 'difference') else None
        message = f"Shift closed at {shift.outlet.name} by {shift.user.name or shift.user.email}"
        if difference is not None:
            if difference != 0:
                message += f". Difference: {difference} {shift.outlet.tenant.currency or 'MWK'}"
        
        notification = Notification.objects.create(
            tenant=shift.outlet.tenant,
            type=Notification.TYPE_SYSTEM,
            priority=Notification.PRIORITY_NORMAL if difference == 0 else Notification.PRIORITY_HIGH,
            title=f"Shift Closed: {shift.outlet.name}",
            message=message,
            resource_type='Shift',
            resource_id=str(shift.id),
            link=f"/dashboard/office/shift-management",
            metadata={
                'shift_id': shift.id,
                'outlet': shift.outlet.name,
                'outlet_id': shift.outlet.id,
                'user': shift.user.email,
                'closing_cash': str(shift.closing_cash_balance) if hasattr(shift, 'closing_cash_balance') else None,
                'difference': str(difference) if difference is not None else None,
            }
        )
        NotificationService._send_websocket_notification(notification)
    
    @staticmethod
    def notify_customer_created(customer):
        """Create notification when a new customer is created"""
        notification = Notification.objects.create(
            tenant=customer.tenant,
            type=Notification.TYPE_CUSTOMER,
            priority=Notification.PRIORITY_LOW,
            title=f"New Customer: {customer.name}",
            message=f"New customer {customer.name} has been added to the system",
            resource_type='Customer',
            resource_id=str(customer.id),
            link=f"/dashboard/customers/{customer.id}",
            metadata={
                'customer_id': customer.id,
                'customer_name': customer.name,
                'email': customer.email,
                'phone': customer.phone,
            }
        )
        NotificationService._send_websocket_notification(notification)
    
    @staticmethod
    def notify_staff_added(staff):
        """Create notification when a new staff member is added"""
        notification = Notification.objects.create(
            tenant=staff.tenant,
            type=Notification.TYPE_STAFF,
            priority=Notification.PRIORITY_NORMAL,
            title=f"New Staff Member: {staff.user.name or staff.user.email}",
            message=f"New staff member {staff.user.name or staff.user.email} has been added",
            resource_type='Staff',
            resource_id=str(staff.id),
            link=f"/dashboard/staff/{staff.id}",
            metadata={
                'staff_id': staff.id,
                'user_id': staff.user.id,
                'email': staff.user.email,
                'role': staff.role.name if staff.role else None,
            }
        )
        NotificationService._send_websocket_notification(notification)
    
    @staticmethod
    def notify_delivery_created(delivery):
        """Create notification when a delivery is created"""
        notification = Notification.objects.create(
            tenant=delivery.tenant,
            type=Notification.TYPE_SYSTEM,
            priority=Notification.PRIORITY_NORMAL,
            title=f"New Delivery: {delivery.delivery_number}",
            message=f"New delivery {delivery.delivery_number} created for {delivery.customer_name or 'customer'}",
            resource_type='Delivery',
            resource_id=str(delivery.id),
            link=f"/dashboard/wholesale and retail/deliveries",
            metadata={
                'delivery_id': delivery.id,
                'delivery_number': delivery.delivery_number,
                'customer_name': delivery.customer_name,
                'status': delivery.status,
            }
        )
        NotificationService._send_websocket_notification(notification)
    
    @staticmethod
    def notify_delivery_status_changed(delivery, old_status, new_status):
        """Create notification when delivery status changes"""
        status_messages = {
            'confirmed': 'Delivery confirmed',
            'ready': 'Delivery ready for dispatch',
            'in_transit': 'Delivery in transit',
            'delivered': 'Delivery delivered',
            'completed': 'Delivery completed',
            'cancelled': 'Delivery cancelled',
        }
        
        message = status_messages.get(new_status, f"Delivery status changed from {old_status} to {new_status}")
        
        # Set priority based on status
        priority = Notification.PRIORITY_NORMAL
        if new_status in ['cancelled', 'failed']:
            priority = Notification.PRIORITY_HIGH
        elif new_status == 'completed':
            priority = Notification.PRIORITY_LOW
        
        notification = Notification.objects.create(
            tenant=delivery.tenant,
            type=Notification.TYPE_SYSTEM,
            priority=priority,
            title=f"Delivery Update: {delivery.delivery_number}",
            message=f"{message} for delivery {delivery.delivery_number}",
            resource_type='Delivery',
            resource_id=str(delivery.id),
            link=f"/dashboard/wholesale and retail/deliveries",
            metadata={
                'delivery_id': delivery.id,
                'delivery_number': delivery.delivery_number,
                'old_status': old_status,
                'new_status': new_status,
            }
        )
        NotificationService._send_websocket_notification(notification)
    
    @staticmethod
    def notify_payment_received(payment):
        """Create notification when a payment is received"""
        payment_method_display = payment.payment_method.replace('_', ' ').title()
        notification = Notification.objects.create(
            tenant=payment.tenant,
            type=Notification.TYPE_PAYMENT,
            priority=Notification.PRIORITY_NORMAL,
            title=f"Payment Received: {payment.transaction_id}",
            message=f"{payment_method_display} payment of {payment.amount} {payment.tenant.currency or 'MWK'} received",
            resource_type='Payment',
            resource_id=str(payment.id),
            link=f"/dashboard/payments/{payment.id}",
            metadata={
                'payment_id': payment.id,
                'transaction_id': payment.transaction_id,
                'amount': str(payment.amount),
                'payment_method': payment.payment_method,
                'sale_id': payment.sale.id if payment.sale else None,
            }
        )
        NotificationService._send_websocket_notification(notification)
