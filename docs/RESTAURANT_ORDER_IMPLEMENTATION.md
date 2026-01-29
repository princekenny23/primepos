# RestaurantOrder Implementation Guide

## 1. Backend Model (apps/restaurant/models.py)
Add this class after KitchenOrderTicket:

```python
class RestaurantOrder(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='restaurant_orders')
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='restaurant_orders')
    till = models.ForeignKey('outlets.Till', on_delete=models.SET_NULL, null=True, blank=True, related_name='restaurant_orders')
    shift = models.ForeignKey('shifts.Shift', on_delete=models.SET_NULL, null=True, blank=True, related_name='restaurant_orders')
    
    customer = models.ForeignKey('customers.Customer', on_delete=models.SET_NULL, null=True, blank=True, related_name='restaurant_orders')
    customer_name = models.CharField(max_length=255)
    
    table = models.ForeignKey(Table, on_delete=models.SET_NULL, null=True, blank=True, related_name='restaurant_orders')
    
    order_number = models.CharField(max_length=50, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    order_type = models.CharField(max_length=20, choices=[
        ('dine_in', 'Dine In'),
        ('takeout', 'Takeout'),
        ('delivery', 'Delivery'),
    ], default='dine_in')
    
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_type = models.CharField(max_length=20, choices=[('percentage', 'Percentage'), ('amount', 'Amount')], null=True, blank=True)
    discount_reason = models.CharField(max_length=255, blank=True)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    payment_method = models.CharField(max_length=20, choices=[
        ('cash', 'Cash'),
        ('card', 'Card'),
        ('mobile', 'Mobile Money'),
        ('credit', 'Credit/On Account'),
    ], null=True, blank=True)
    
    sale = models.OneToOneField('sales.Sale', on_delete=models.SET_NULL, null=True, blank=True, related_name='restaurant_order')
    
    notes = models.TextField(blank=True)
    guests = models.PositiveIntegerField(null=True, blank=True)
    priority = models.CharField(max_length=20, choices=[('normal', 'Normal'), ('high', 'High'), ('urgent', 'Urgent')], default='normal')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'restaurant_restaurantorder'
        verbose_name = 'Restaurant Order'
        verbose_name_plural = 'Restaurant Orders'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant']),
            models.Index(fields=['outlet']),
            models.Index(fields=['table']),
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        table_info = f"Table {self.table.number}" if self.table else self.order_type.replace('_', ' ').title()
        return f"Order #{self.order_number} - {self.customer_name} ({table_info})"
```

## 2. Serializer (apps/restaurant/serializers.py)

Add:
```python
class RestaurantOrderSerializer(serializers.ModelSerializer):
    customer_detail = CustomerSerializer(source='customer', read_only=True)
    table_detail = TableSerializer(source='table', read_only=True)
    sale_detail = SaleSerializer(source='sale', read_only=True)
    
    class Meta:
        model = RestaurantOrder
        fields = [
            'id', 'order_number', 'customer_name', 'customer', 'customer_detail',
            'table', 'table_detail', 'status', 'order_type',
            'subtotal', 'tax', 'discount', 'discount_type', 'discount_reason', 'total',
            'payment_method', 'sale', 'sale_detail',
            'notes', 'guests', 'priority',
            'created_at', 'updated_at', 'completed_at'
        ]
        read_only_fields = ['id', 'order_number', 'created_at', 'updated_at']
```

## 3. ViewSet (apps/restaurant/views.py)

Add:
```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

class RestaurantOrderViewSet(viewsets.ModelViewSet):
    serializer_class = RestaurantOrderSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return RestaurantOrder.objects.filter(
            tenant=self.request.tenant
        ).select_related('customer', 'table', 'sale', 'outlet')
    
    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)
    
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        order = self.get_object()
        if order.status == 'completed':
            return Response({'detail': 'Order already completed'}, status=status.HTTP_400_BAD_REQUEST)
        order.status = 'completed'
        order.completed_at = timezone.now()
        order.save()
        return Response(RestaurantOrderSerializer(order).data)
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        order = self.get_object()
        order.status = 'cancelled'
        order.save()
        return Response(RestaurantOrderSerializer(order).data)
    
    @action(detail=True, methods=['post'])
    def add_items(self, request, pk=None):
        """Add items to pending order"""
        order = self.get_object()
        if order.status != 'pending':
            return Response({'detail': 'Order must be pending'}, status=status.HTTP_400_BAD_REQUEST)
        # Items would be linked via separate SaleItem/OrderItem model
        return Response(RestaurantOrderSerializer(order).data)
```

## 4. URL Configuration (apps/restaurant/urls.py)

Add to router:
```python
from rest_framework.routers import DefaultRouter
router.register(r'orders', RestaurantOrderViewSet, basename='restaurantorder')
```

## 5. Create Migration

```bash
python manage.py makemigrations restaurant
python manage.py migrate
```

## 6. Frontend Service (frontend/lib/services/restaurantOrderService.ts)

```typescript
import { api, apiEndpoints } from "@/lib/api"

export interface RestaurantOrder {
  id: string
  order_number: string
  customer_id?: string
  customer_name: string
  table_id?: string
  table_detail?: any
  status: 'pending' | 'completed' | 'cancelled'
  order_type: 'dine_in' | 'takeout' | 'delivery'
  subtotal: number
  tax: number
  discount: number
  discount_type?: 'percentage' | 'amount'
  discount_reason?: string
  total: number
  payment_method?: string
  notes?: string
  guests?: number
  priority: 'normal' | 'high' | 'urgent'
  created_at: string
  updated_at: string
  completed_at?: string
}

export const restaurantOrderService = {
  async list(filters?: { outlet?: string; status?: string }): Promise<{ results: RestaurantOrder[] }> {
    const params = new URLSearchParams()
    if (filters?.outlet) params.append('outlet', filters.outlet)
    if (filters?.status) params.append('status', filters.status)
    
    const query = params.toString()
    const response = await api.get<any>(
      `/api/v1/restaurant/orders/${query ? `?${query}` : ''}`
    )
    return { results: response.results || (Array.isArray(response) ? response : []) }
  },

  async get(id: string): Promise<RestaurantOrder> {
    return api.get(`/api/v1/restaurant/orders/${id}/`)
  },

  async create(data: Partial<RestaurantOrder>): Promise<RestaurantOrder> {
    return api.post('/api/v1/restaurant/orders/', data)
  },

  async update(id: string, data: Partial<RestaurantOrder>): Promise<RestaurantOrder> {
    return api.patch(`/api/v1/restaurant/orders/${id}/`, data)
  },

  async complete(id: string): Promise<RestaurantOrder> {
    return api.post(`/api/v1/restaurant/orders/${id}/complete/`, {})
  },

  async cancel(id: string): Promise<RestaurantOrder> {
    return api.post(`/api/v1/restaurant/orders/${id}/cancel/`, {})
  },
}
```

## 7. Wire in Restaurant POS

Update `restaurant-pos.tsx` to:
- Load orders from RestaurantOrder (not just pending sales)
- Create RestaurantOrder on "New Order"
- Update order on item add/remove
- Link to sale when payment processed

---

This provides the full backend structure for persistent order sessions.
Next: Wire frontend to use this persistent model.
