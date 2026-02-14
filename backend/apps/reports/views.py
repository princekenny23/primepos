from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Sum, Count, Avg, Q, F
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.http import HttpResponse
from datetime import datetime, timedelta, date
from decimal import Decimal
from io import BytesIO
from apps.sales.models import Sale, SaleItem
from apps.products.models import Product, Category
from apps.customers.models import Customer
from apps.inventory.models import StockMovement, StockTake, StockTakeItem
from apps.shifts.models import Shift
from apps.expenses.models import Expense
import pandas as pd
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet


def get_outlet_id_from_request(request):
    """Helper to get outlet ID from request (header or query param)"""
    # Check header first (X-Outlet-ID)
    outlet_id = request.headers.get('X-Outlet-ID')
    # Fall back to query param
    if not outlet_id:
        outlet_id = request.query_params.get('outlet_id') or request.query_params.get('outlet')
    return outlet_id


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sales_report(request):
    """Sales report with filters"""
    tenant = getattr(request, 'tenant', None) or request.user.tenant
    if not tenant:
        return Response({"detail": "User must have a tenant"}, status=400)
    
    # Filters
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    outlet_id = get_outlet_id_from_request(request)
    payment_method = request.query_params.get('payment_method')
    
    queryset = Sale.objects.filter(tenant=tenant, status='completed')
    
    # Always filter by outlet if provided (required for outlet isolation)
    if outlet_id:
        queryset = queryset.filter(outlet_id=outlet_id)
    else:
        # If no outlet specified, return empty results (reports are outlet-specific)
        queryset = queryset.none()
    
    if start_date:
        queryset = queryset.filter(created_at__gte=start_date)
    if end_date:
        queryset = queryset.filter(created_at__lte=end_date)
    if payment_method:
        queryset = queryset.filter(payment_method=payment_method)
    
    # Aggregations
    total_transactions = queryset.count()
    total_revenue = queryset.aggregate(Sum('total'))['total__sum'] or 0
    total_tax = queryset.aggregate(Sum('tax'))['tax__sum'] or 0
    total_discount = queryset.aggregate(Sum('discount'))['discount__sum'] or 0

    by_payment_method = queryset.values('payment_method').annotate(
        count=Count('id'),
        total=Sum('total')
    )
    
    # Top products
    top_products = SaleItem.objects.filter(sale__in=queryset).values('product_name').annotate(
        total_quantity=Sum('quantity'),
        total_revenue=Sum('total')
    ).order_by('-total_revenue')[:10]
    
    return Response({
        'total_sales': total_transactions,
        'total_transactions': total_transactions,
        'total_revenue': float(total_revenue),
        'total_tax': float(total_tax),
        'total_discount': float(total_discount),
        'by_payment_method': list(by_payment_method),
        'top_products': list(top_products),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def products_report(request):
    """Products performance report - outlet-specific"""
    tenant = getattr(request, 'tenant', None) or request.user.tenant
    if not tenant:
        return Response({"detail": "User must have a tenant"}, status=400)
    
    outlet_id = get_outlet_id_from_request(request)
    if not outlet_id:
        return Response({"detail": "Outlet is required. Please specify X-Outlet-ID header or ?outlet=id query parameter."}, status=400)
    
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    
    # Products are now outlet-specific
    queryset = Product.objects.filter(tenant=tenant, outlet_id=outlet_id)
    sales_queryset = Sale.objects.filter(tenant=tenant, outlet_id=outlet_id, status='completed')
    
    if start_date:
        sales_queryset = sales_queryset.filter(created_at__gte=start_date)
    if end_date:
        sales_queryset = sales_queryset.filter(created_at__lte=end_date)
    
    # Product performance
    product_performance = []
    for product in queryset:
        items = SaleItem.objects.filter(
            product=product,
            sale__in=sales_queryset
        )
        total_sold = items.aggregate(Sum('quantity'))['quantity__sum'] or 0
        total_revenue = items.aggregate(Sum('total'))['total__sum'] or 0
        
        product_performance.append({
            'product_id': product.id,
            'product_name': product.name,
            'product_sku': product.sku or '',
            'category': product.category.name if product.category else 'Uncategorized',
            'total_sold': total_sold,
            'total_revenue': float(total_revenue),
            'current_stock': product.stock,
            'is_low_stock': product.is_low_stock,
        })
    
    return Response({
        'products': sorted(product_performance, key=lambda x: x['total_revenue'], reverse=True),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def customers_report(request):
    """Customers report"""
    tenant = getattr(request, 'tenant', None) or request.user.tenant
    if not tenant:
        return Response({"detail": "User must have a tenant"}, status=400)
    
    queryset = Customer.objects.filter(tenant=tenant, is_active=True)
    
    total_customers = queryset.count()
    total_points = queryset.aggregate(Sum('loyalty_points'))['loyalty_points__sum'] or 0
    total_spent = queryset.aggregate(Sum('total_spent'))['total_spent__sum'] or 0
    avg_points = queryset.aggregate(Avg('loyalty_points'))['loyalty_points__avg'] or 0
    
    # Customers list (ranked)
    customers_list = queryset.order_by('-total_spent').values(
        'id', 'name', 'email', 'phone', 'loyalty_points', 'total_spent', 'last_visit'
    )

    # Top customers
    top_customers = list(customers_list[:10])
    
    return Response({
        'total_customers': total_customers,
        'total_points': total_points,
        'total_spent': float(total_spent),
        'avg_points': float(avg_points),
        'customers': list(customers_list),
        'top_customers': top_customers,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profit_loss_report(request):
    """Profit & Loss report"""
    tenant = getattr(request, 'tenant', None) or request.user.tenant
    if not tenant:
        return Response({"detail": "User must have a tenant"}, status=400)
    
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    outlet_id = get_outlet_id_from_request(request)
    
    if not outlet_id:
        return Response({"detail": "Outlet is required. Please specify X-Outlet-ID header or ?outlet=id query parameter."}, status=400)
    
    sales_queryset = Sale.objects.filter(tenant=tenant, outlet_id=outlet_id, status='completed')
    
    if start_date:
        sales_queryset = sales_queryset.filter(created_at__gte=start_date)
    if end_date:
        sales_queryset = sales_queryset.filter(created_at__lte=end_date)
    if outlet_id:
        sales_queryset = sales_queryset.filter(outlet_id=outlet_id)
    
    # Revenue
    total_revenue = sales_queryset.aggregate(Sum('total'))['total__sum'] or 0
    
    # Cost of goods sold
    sale_items = SaleItem.objects.filter(sale__in=sales_queryset)
    total_cost = 0
    for item in sale_items:
        if item.product and item.product.cost:
            total_cost += item.product.cost * item.quantity
    
    # Expenses
    expense_qs = Expense.objects.filter(tenant=tenant, status='approved')
    if outlet_id:
        expense_qs = expense_qs.filter(outlet_id=outlet_id)
    if start_date:
        expense_qs = expense_qs.filter(expense_date__gte=start_date)
    if end_date:
        expense_qs = expense_qs.filter(expense_date__lte=end_date)
    total_expenses = expense_qs.aggregate(Sum('amount'))['amount__sum'] or 0

    # Gross profit
    gross_profit = total_revenue - total_cost
    gross_margin = (gross_profit / total_revenue * 100) if total_revenue > 0 else 0
    
    return Response({
        'total_revenue': float(total_revenue),
        'total_cost': float(total_cost),
        'gross_profit': float(gross_profit),
        'gross_margin': float(gross_margin),
        'expenses': float(total_expenses),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stock_movement_report(request):
    """Stock movement report"""
    tenant = getattr(request, 'tenant', None) or request.user.tenant
    if not tenant:
        return Response({"detail": "User must have a tenant"}, status=400)
    
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    outlet_id = get_outlet_id_from_request(request)
    movement_type = request.query_params.get('movement_type')
    
    if not outlet_id:
        return Response({"detail": "Outlet is required. Please specify X-Outlet-ID header or ?outlet=id query parameter."}, status=400)
    
    queryset = StockMovement.objects.filter(tenant=tenant, outlet_id=outlet_id)
    
    if start_date:
        queryset = queryset.filter(created_at__gte=start_date)
    if end_date:
        queryset = queryset.filter(created_at__lte=end_date)
    if movement_type:
        queryset = queryset.filter(movement_type=movement_type)
    
    # Group by movement type
    movements_by_type = queryset.values('movement_type').annotate(
        total_quantity=Sum('quantity'),
        count=Count('id')
    )
    
    return Response({
        'movements_by_type': list(movements_by_type),
        'total_movements': queryset.count(),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def daily_sales_report(request):
    """Daily sales report filtered by tenant and date"""
    tenant = getattr(request, 'tenant', None) or request.user.tenant
    if not tenant:
        return Response({"detail": "User must have a tenant"}, status=status.HTTP_400_BAD_REQUEST)
    
    # Get date filter (default to today) or date range
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    date_str = request.query_params.get('date', timezone.now().date().isoformat())
    report_date = None
    if not start_date and not end_date:
        try:
            report_date = date.fromisoformat(date_str)
        except ValueError:
            return Response({"detail": "Invalid date format. Use YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)
    
    outlet_id = get_outlet_id_from_request(request)
    
    if not outlet_id:
        return Response({"detail": "Outlet is required. Please specify X-Outlet-ID header or ?outlet=id query parameter."}, status=400)
    
    # Filter sales
    queryset = Sale.objects.filter(
        tenant=tenant,
        outlet_id=outlet_id,
        status='completed'
    )

    if start_date or end_date:
        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)

        daily = queryset.annotate(day=TruncDate('created_at')).values('day').annotate(
            total_sales=Sum('total'),
            total_tax=Sum('tax'),
            total_discount=Sum('discount'),
            transactions=Count('id')
        ).order_by('day')

        return Response({
            'start_date': start_date,
            'end_date': end_date,
            'daily': [
                {
                    'date': row['day'].isoformat() if row.get('day') else None,
                    'total_sales': float(row.get('total_sales') or 0),
                    'total_tax': float(row.get('total_tax') or 0),
                    'total_discount': float(row.get('total_discount') or 0),
                    'transactions': row.get('transactions') or 0,
                }
                for row in daily
            ],
        })

    queryset = queryset.filter(created_at__date=report_date)
    
    # Aggregations
    total_sales = queryset.count()
    total_revenue = queryset.aggregate(Sum('total'))['total__sum'] or Decimal('0')
    total_tax = queryset.aggregate(Sum('tax'))['tax__sum'] or Decimal('0')
    total_discount = queryset.aggregate(Sum('discount'))['discount__sum'] or Decimal('0')
    
    # By payment method
    by_payment_method = queryset.values('payment_method').annotate(
        count=Count('id'),
        total=Sum('total')
    )
    
    # By shift
    by_shift = queryset.values('shift__id', 'shift__operating_date').annotate(
        count=Count('id'),
        total=Sum('total')
    )
    
    return Response({
        'date': report_date.isoformat(),
        'total_sales': total_sales,
        'total_revenue': float(total_revenue),
        'total_tax': float(total_tax),
        'total_discount': float(total_discount),
        'by_payment_method': list(by_payment_method),
        'by_shift': list(by_shift),
        'daily': [
            {
                'date': report_date.isoformat(),
                'total_sales': float(total_revenue),
                'total_tax': float(total_tax),
                'total_discount': float(total_discount),
                'transactions': total_sales,
            }
        ],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def top_products_report(request):
    """Top products report filtered by tenant, outlet, and date range"""
    tenant = getattr(request, 'tenant', None) or request.user.tenant
    if not tenant:
        return Response({"detail": "User must have a tenant"}, status=status.HTTP_400_BAD_REQUEST)
    
    outlet_id = get_outlet_id_from_request(request)
    if not outlet_id:
        return Response({"detail": "Outlet is required. Please specify X-Outlet-ID header or ?outlet=id query parameter."}, status=400)
    
    # Get date filters
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    limit = int(request.query_params.get('limit', 10))
    
    # Filter sales by outlet
    sales_queryset = Sale.objects.filter(tenant=tenant, outlet_id=outlet_id, status='completed')
    
    if start_date:
        sales_queryset = sales_queryset.filter(created_at__gte=start_date)
    if end_date:
        sales_queryset = sales_queryset.filter(created_at__lte=end_date)
    
    # Get top products by revenue
    top_products = SaleItem.objects.filter(
        sale__in=sales_queryset
    ).values('product_id', 'product_name').annotate(
        total_quantity=Sum('quantity'),
        total_revenue=Sum('total'),
        sale_count=Count('sale', distinct=True)
    ).order_by('-total_revenue')[:limit]
    
    return Response({
        'top_products': list(top_products),
        'period': {
            'start_date': start_date,
            'end_date': end_date,
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def cash_summary_report(request):
    """Cash summary report filtered by tenant and date"""
    tenant = getattr(request, 'tenant', None) or request.user.tenant
    if not tenant:
        return Response({"detail": "User must have a tenant"}, status=status.HTTP_400_BAD_REQUEST)
    
    # Get date filter (default to today)
    date_str = request.query_params.get('date', timezone.now().date().isoformat())
    try:
        report_date = date.fromisoformat(date_str)
    except ValueError:
        return Response({"detail": "Invalid date format. Use YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)
    
    outlet_id = get_outlet_id_from_request(request)
    
    # Filter cash sales
    queryset = Sale.objects.filter(
        tenant=tenant,
        payment_method='cash',
        status='completed',
        created_at__date=report_date
    )
    
    if outlet_id:
        queryset = queryset.filter(outlet_id=outlet_id)
    
    # Aggregations
    total_cash_sales = queryset.count()
    total_cash_received = queryset.aggregate(Sum('cash_received'))['cash_received__sum'] or Decimal('0')
    total_change_given = queryset.aggregate(Sum('change_given'))['change_given__sum'] or Decimal('0')
    total_cash_amount = queryset.aggregate(Sum('total'))['total__sum'] or Decimal('0')
    
    # By shift
    shifts = Shift.objects.filter(
        outlet__tenant=tenant,
        outlet_id=outlet_id,
        operating_date=report_date,
        status='CLOSED'
    )
    
    shift_summaries = []
    for shift in shifts:
        shift_sales = queryset.filter(shift=shift)
        shift_summaries.append({
            'shift_id': shift.id,
            'outlet': shift.outlet.name,
            'till': shift.till.name,
            'opening_cash': float(shift.opening_cash_balance),
            'closing_cash': float(shift.closing_cash_balance) if shift.closing_cash_balance else None,
            'system_total': float(shift.system_total) if shift.system_total else None,
            'difference': float(shift.difference) if shift.difference else None,
            'cash_sales_count': shift_sales.count(),
            'cash_sales_total': float(shift_sales.aggregate(Sum('total'))['total__sum'] or Decimal('0')),
        })
    
    return Response({
        'date': report_date.isoformat(),
        'total_cash_sales': total_cash_sales,
        'total_cash_received': float(total_cash_received),
        'total_change_given': float(total_change_given),
        'total_cash_amount': float(total_cash_amount),
        'shifts': shift_summaries,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def shift_summary_report(request):
    """Shift summary report filtered by tenant and date range"""
    tenant = getattr(request, 'tenant', None) or request.user.tenant
    if not tenant:
        return Response({"detail": "User must have a tenant"}, status=status.HTTP_400_BAD_REQUEST)
    
    # Get date filters
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    outlet_id = get_outlet_id_from_request(request)
    
    if not outlet_id:
        return Response({"detail": "Outlet is required. Please specify X-Outlet-ID header or ?outlet=id query parameter."}, status=400)
    
    # Filter shifts
    queryset = Shift.objects.filter(outlet__tenant=tenant, outlet_id=outlet_id)
    
    if start_date:
        queryset = queryset.filter(operating_date__gte=start_date)
    if end_date:
        queryset = queryset.filter(operating_date__lte=end_date)
    
    # Get closed shifts with summaries (include all statuses for now to allow testing)
    shifts_to_report = queryset.select_related('outlet', 'till', 'user')
    
    shift_summaries = []
    for shift in shifts_to_report:
        # Get sales for this shift
        shift_sales = Sale.objects.filter(shift=shift, status='completed')
        cash_sales = shift_sales.filter(payment_method='cash')
        
        shift_summaries.append({
            'shift_id': shift.id,
            'outlet': shift.outlet.name,
            'till': shift.till.name,
            'cashier': shift.user.email if shift.user else None,
            'operating_date': shift.operating_date.isoformat(),
            'start_time': shift.start_time.isoformat() if shift.start_time else None,
            'end_time': shift.end_time.isoformat() if shift.end_time else None,
            'opening_cash': float(shift.opening_cash_balance),
            'closing_cash': float(shift.closing_cash_balance) if shift.closing_cash_balance else None,
            'system_total': float(shift.system_total) if shift.system_total else None,
            'difference': float(shift.difference) if shift.difference else None,
            'total_sales': shift_sales.count(),
            'total_revenue': float(shift_sales.aggregate(Sum('total'))['total__sum'] or Decimal('0')),
            'cash_sales_count': cash_sales.count(),
            'cash_sales_total': float(cash_sales.aggregate(Sum('total'))['total__sum'] or Decimal('0')),
        })
    
    return Response({
        'shifts': shift_summaries,
        'total_shifts': len(shift_summaries),
        'period': {
            'start_date': start_date,
            'end_date': end_date,
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def inventory_valuation_report(request):
    """
    Comprehensive Inventory Valuation Report
    Shows stock movements, values, and discrepancies for all products
    Similar to stock take/valuation spreadsheet
    """
    tenant = getattr(request, 'tenant', None) or request.user.tenant
    if not tenant:
        return Response({"detail": "User must have a tenant"}, status=status.HTTP_400_BAD_REQUEST)
    
    outlet_id = get_outlet_id_from_request(request)
    if not outlet_id:
        return Response({"detail": "Outlet is required. Please specify X-Outlet-ID header or ?outlet=id query parameter."}, status=400)
    
    # Date filters
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    category_id = request.query_params.get('category')
    
    # Default to current month if no dates provided
    if not start_date:
        start_date = timezone.now().replace(day=1).date().isoformat()
    if not end_date:
        end_date = timezone.now().date().isoformat()
    
    try:
        start_dt = date.fromisoformat(start_date)
        end_dt = date.fromisoformat(end_date)
    except ValueError:
        return Response({"detail": "Invalid date format. Use YYYY-MM-DD"}, status=400)
    
    # Get all products for this outlet
    products = Product.objects.filter(tenant=tenant, outlet_id=outlet_id, is_active=True)
    if category_id:
        products = products.filter(category_id=category_id)
    
    products = products.select_related('category').order_by('category__name', 'name')
    
    # Get stock movements for the period
    movements = StockMovement.objects.filter(
        tenant=tenant,
        outlet_id=outlet_id,
        created_at__date__gte=start_dt,
        created_at__date__lte=end_dt
    )
    
    # Get latest stock take (if any)
    latest_stock_take = StockTake.objects.filter(
        tenant=tenant,
        outlet_id=outlet_id,
        status='completed',
        operating_date__gte=start_dt,
        operating_date__lte=end_dt
    ).order_by('-completed_at').first()
    
    # Build report data
    report_items = []
    totals = {
        'open_qty': 0, 'open_value': Decimal('0'),
        'received_qty': 0, 'received_value': Decimal('0'),
        'transferred_qty': 0, 'transferred_value': Decimal('0'),
        'adjusted_qty': 0, 'adjusted_value': Decimal('0'),
        'sold_qty': 0, 'sold_value': Decimal('0'),
        'stock_qty': 0, 'stock_value': Decimal('0'),
        'counted_qty': 0, 'counted_value': Decimal('0'),
        'discrepancy': 0,
        'surplus_qty': 0, 'surplus_value': Decimal('0'),
        'shortage_qty': 0, 'shortage_value': Decimal('0'),
    }
    
    for product in products:
        retail_price = product.retail_price or Decimal('0')
        cost_price = product.cost or retail_price  # Use cost if available, else retail
        
        # Get movements by type for this product
        product_movements = movements.filter(product=product)
        
        # Calculate quantities by movement type
        received = product_movements.filter(movement_type='purchase').aggregate(
            qty=Sum('quantity'))['qty'] or 0
        
        transferred_in = product_movements.filter(movement_type='transfer_in').aggregate(
            qty=Sum('quantity'))['qty'] or 0
        transferred_out = product_movements.filter(movement_type='transfer_out').aggregate(
            qty=Sum('quantity'))['qty'] or 0
        transferred = transferred_in - transferred_out
        
        adjusted = product_movements.filter(movement_type='adjustment').aggregate(
            qty=Sum('quantity'))['qty'] or 0
        
        sold = product_movements.filter(movement_type='sale').aggregate(
            qty=Sum('quantity'))['qty'] or 0
        
        returns = product_movements.filter(movement_type='return').aggregate(
            qty=Sum('quantity'))['qty'] or 0
        
        damage = product_movements.filter(movement_type='damage').aggregate(
            qty=Sum('quantity'))['qty'] or 0
        
        expiry = product_movements.filter(movement_type='expiry').aggregate(
            qty=Sum('quantity'))['qty'] or 0
        
        # Current stock (from product or calculate)
        current_stock = product.stock or 0
        
        # Calculate opening stock: current + sold + transferred_out + damage + expiry - received - transferred_in - returns - adjusted
        opening_stock = current_stock + sold + transferred_out + damage + expiry - received - transferred_in - returns - adjusted
        
        # Get stock take data if available
        counted_qty = 0
        if latest_stock_take:
            stock_take_item = StockTakeItem.objects.filter(
                stock_take=latest_stock_take,
                product=product
            ).first()
            if stock_take_item:
                counted_qty = stock_take_item.counted_quantity
        
        # Calculate discrepancy
        discrepancy = counted_qty - current_stock if counted_qty > 0 else 0
        surplus = max(0, discrepancy)
        shortage = abs(min(0, discrepancy))
        
        # Calculate values
        open_value = opening_stock * cost_price
        received_value = received * cost_price
        transferred_value = transferred * cost_price
        adjusted_value = adjusted * cost_price
        sold_value = sold * retail_price  # Use retail for sold
        stock_value = current_stock * cost_price
        counted_value = counted_qty * cost_price
        surplus_value = surplus * cost_price
        shortage_value = shortage * cost_price
        
        item_data = {
            'id': product.id,
            'code': product.sku or f"P{product.id:06d}",
            'name': product.name,
            'retail_price': float(retail_price),
            'cost_price': float(cost_price),
            'category': product.category.name if product.category else 'Uncategorized',
            'category_id': product.category.id if product.category else None,
            'low_stock_threshold': product.low_stock_threshold,
            
            # Opening
            'open_qty': opening_stock,
            'open_value': float(open_value),
            
            # Received
            'received_qty': received,
            'received_value': float(received_value),
            
            # Transferred
            'transferred_qty': transferred,
            'transferred_value': float(transferred_value),
            
            # Adjusted
            'adjusted_qty': adjusted,
            'adjusted_value': float(adjusted_value),
            
            # Sold
            'sold_qty': sold,
            'sold_value': float(sold_value),
            
            # Current Stock
            'stock_qty': current_stock,
            'stock_value': float(stock_value),
            
            # Stock Take
            'counted_qty': counted_qty,
            'counted_value': float(counted_value),
            
            # Discrepancy
            'discrepancy': discrepancy,
            
            # Surplus/Shortage
            'surplus_qty': surplus,
            'surplus_value': float(surplus_value),
            'shortage_qty': shortage,
            'shortage_value': float(shortage_value),
        }
        
        report_items.append(item_data)
        
        # Update totals
        totals['open_qty'] += opening_stock
        totals['open_value'] += open_value
        totals['received_qty'] += received
        totals['received_value'] += received_value
        totals['transferred_qty'] += transferred
        totals['transferred_value'] += transferred_value
        totals['adjusted_qty'] += adjusted
        totals['adjusted_value'] += adjusted_value
        totals['sold_qty'] += sold
        totals['sold_value'] += sold_value
        totals['stock_qty'] += current_stock
        totals['stock_value'] += stock_value
        totals['counted_qty'] += counted_qty
        totals['counted_value'] += counted_value
        totals['discrepancy'] += discrepancy
        totals['surplus_qty'] += surplus
        totals['surplus_value'] += surplus_value
        totals['shortage_qty'] += shortage
        totals['shortage_value'] += shortage_value
    
    # Convert totals to float
    totals = {k: float(v) if isinstance(v, Decimal) else v for k, v in totals.items()}
    
    # Get categories for filter
    categories = Category.objects.filter(tenant=tenant).values('id', 'name')
    
    return Response({
        'items': report_items,
        'totals': totals,
        'period': {
            'start_date': start_date,
            'end_date': end_date,
        },
        'categories': list(categories),
        'has_stock_take': latest_stock_take is not None,
        'stock_take_date': latest_stock_take.operating_date.isoformat() if latest_stock_take else None,
        'item_count': len(report_items),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def expenses_report(request):
    """Expenses report filtered by tenant, outlet and date range"""
    tenant = getattr(request, 'tenant', None) or request.user.tenant
    if not tenant:
        return Response({"detail": "User must have a tenant"}, status=status.HTTP_400_BAD_REQUEST)

    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    outlet_id = get_outlet_id_from_request(request)

    queryset = Expense.objects.filter(tenant=tenant, status='approved')
    if outlet_id:
        queryset = queryset.filter(outlet_id=outlet_id)
    if start_date:
        queryset = queryset.filter(expense_date__gte=start_date)
    if end_date:
        queryset = queryset.filter(expense_date__lte=end_date)

    total_expenses = queryset.aggregate(Sum('amount'))['amount__sum'] or 0
    by_category = queryset.values('category').annotate(
        total=Sum('amount'),
        count=Count('id')
    ).order_by('-total')

    expenses_list = queryset.values(
        'id', 'expense_number', 'title', 'category', 'vendor', 'description',
        'amount', 'payment_method', 'payment_reference', 'expense_date', 'status'
    ).order_by('-expense_date')

    return Response({
        'total_expenses': float(total_expenses),
        'by_category': list(by_category),
        'expenses': list(expenses_list),
        'period': {
            'start_date': start_date,
            'end_date': end_date,
        }
    })


def _xlsx_response_from_sheets(filename, sheets):
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        for sheet_name, (headers, rows) in sheets.items():
            df = pd.DataFrame(rows, columns=headers)
            df.to_excel(writer, index=False, sheet_name=sheet_name[:31])
    output.seek(0)
    response = HttpResponse(
        output.read(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}.xlsx"'
    return response


def _pdf_response_from_tables(filename, title, tables):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4))
    styles = getSampleStyleSheet()
    elements = [Paragraph(title, styles['Title']), Spacer(1, 12)]

    for table_title, headers, rows in tables:
        if table_title:
            elements.append(Paragraph(table_title, styles['Heading2']))
            elements.append(Spacer(1, 6))
        table_data = [headers] + rows
        table = Table(table_data, repeatRows=1)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
            ('TOPPADDING', (0, 0), (-1, 0), 6),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 12))

    doc.build(elements)
    buffer.seek(0)
    response = HttpResponse(buffer.read(), content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}.pdf"'
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_sales_report_xlsx(request):
    response = sales_report(request)
    if response.status_code != 200:
        return response
    data = response.data

    summary_headers = ['Metric', 'Value']
    summary_rows = [
        ['Total Sales', data.get('total_sales')],
        ['Total Revenue', data.get('total_revenue')],
        ['Total Tax', data.get('total_tax')],
        ['Total Discount', data.get('total_discount')],
    ]
    top_headers = ['Product', 'Quantity', 'Revenue']
    top_rows = [
        [row.get('product_name'), row.get('total_quantity'), row.get('total_revenue')]
        for row in data.get('top_products', [])
    ]

    return _xlsx_response_from_sheets(
        'sales_report',
        {
            'Summary': (summary_headers, summary_rows),
            'Top Products': (top_headers, top_rows),
        }
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_sales_report_pdf(request):
    response = sales_report(request)
    if response.status_code != 200:
        return response
    data = response.data

    summary_headers = ['Metric', 'Value']
    summary_rows = [
        ['Total Sales', data.get('total_sales')],
        ['Total Revenue', data.get('total_revenue')],
        ['Total Tax', data.get('total_tax')],
        ['Total Discount', data.get('total_discount')],
    ]
    top_headers = ['Product', 'Quantity', 'Revenue']
    top_rows = [
        [row.get('product_name'), row.get('total_quantity'), row.get('total_revenue')]
        for row in data.get('top_products', [])
    ]

    return _pdf_response_from_tables(
        'sales_report',
        'Sales Report',
        [
            ('Summary', summary_headers, summary_rows),
            ('Top Products', top_headers, top_rows),
        ]
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_products_report_xlsx(request):
    response = products_report(request)
    if response.status_code != 200:
        return response
    data = response.data

    headers = ['Product', 'SKU', 'Category', 'Total Sold', 'Total Revenue', 'Current Stock', 'Low Stock']
    rows = [
        [
            row.get('product_name'),
            row.get('product_sku'),
            row.get('category'),
            row.get('total_sold'),
            row.get('total_revenue'),
            row.get('current_stock'),
            row.get('is_low_stock'),
        ]
        for row in data.get('products', [])
    ]

    return _xlsx_response_from_sheets('products_report', {'Products': (headers, rows)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_products_report_pdf(request):
    response = products_report(request)
    if response.status_code != 200:
        return response
    data = response.data

    headers = ['Product', 'SKU', 'Category', 'Total Sold', 'Revenue', 'Stock', 'Low']
    rows = [
        [
            row.get('product_name'),
            row.get('product_sku'),
            row.get('category'),
            row.get('total_sold'),
            row.get('total_revenue'),
            row.get('current_stock'),
            'Yes' if row.get('is_low_stock') else 'No',
        ]
        for row in data.get('products', [])
    ]

    return _pdf_response_from_tables('products_report', 'Products Report', [('Products', headers, rows)])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_customers_report_xlsx(request):
    response = customers_report(request)
    if response.status_code != 200:
        return response
    data = response.data

    headers = ['Name', 'Email', 'Phone', 'Loyalty Points', 'Total Spent', 'Last Visit']
    rows = [
        [
            row.get('name'),
            row.get('email'),
            row.get('phone'),
            row.get('loyalty_points'),
            row.get('total_spent'),
            row.get('last_visit'),
        ]
        for row in data.get('customers', [])
    ]

    return _xlsx_response_from_sheets('customers_report', {'Customers': (headers, rows)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_customers_report_pdf(request):
    response = customers_report(request)
    if response.status_code != 200:
        return response
    data = response.data

    headers = ['Name', 'Email', 'Phone', 'Points', 'Total Spent']
    rows = [
        [
            row.get('name'),
            row.get('email'),
            row.get('phone'),
            row.get('loyalty_points'),
            row.get('total_spent'),
        ]
        for row in data.get('customers', [])
    ]

    return _pdf_response_from_tables('customers_report', 'Customers Report', [('Customers', headers, rows)])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_profit_loss_report_xlsx(request):
    response = profit_loss_report(request)
    if response.status_code != 200:
        return response
    data = response.data

    headers = ['Metric', 'Value']
    rows = [
        ['Revenue', data.get('total_revenue')],
        ['Cost of Goods', data.get('total_cost')],
        ['Gross Profit', data.get('gross_profit')],
        ['Gross Margin (%)', data.get('gross_margin')],
        ['Expenses', data.get('expenses')],
    ]

    return _xlsx_response_from_sheets('profit_loss_report', {'Summary': (headers, rows)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_profit_loss_report_pdf(request):
    response = profit_loss_report(request)
    if response.status_code != 200:
        return response
    data = response.data

    headers = ['Metric', 'Value']
    rows = [
        ['Revenue', data.get('total_revenue')],
        ['Cost of Goods', data.get('total_cost')],
        ['Gross Profit', data.get('gross_profit')],
        ['Gross Margin (%)', data.get('gross_margin')],
        ['Expenses', data.get('expenses')],
    ]

    return _pdf_response_from_tables('profit_loss_report', 'Profit & Loss', [('Summary', headers, rows)])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_stock_movement_report_xlsx(request):
    response = stock_movement_report(request)
    if response.status_code != 200:
        return response
    data = response.data

    headers = ['Movement Type', 'Total Quantity', 'Count']
    rows = [
        [row.get('movement_type'), row.get('total_quantity'), row.get('count')]
        for row in data.get('movements_by_type', [])
    ]

    return _xlsx_response_from_sheets('stock_movement_report', {'Movements': (headers, rows)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_stock_movement_report_pdf(request):
    response = stock_movement_report(request)
    if response.status_code != 200:
        return response
    data = response.data

    headers = ['Movement Type', 'Total Quantity', 'Count']
    rows = [
        [row.get('movement_type'), row.get('total_quantity'), row.get('count')]
        for row in data.get('movements_by_type', [])
    ]

    return _pdf_response_from_tables('stock_movement_report', 'Stock Movement Report', [('Movements', headers, rows)])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_inventory_valuation_report_xlsx(request):
    response = inventory_valuation_report(request)
    if response.status_code != 200:
        return response
    data = response.data

    headers = [
        'Code', 'Name', 'Category', 'Open Qty', 'Received Qty', 'Transferred Qty',
        'Adjusted Qty', 'Sold Qty', 'Stock Qty', 'Counted Qty', 'Discrepancy'
    ]
    rows = [
        [
            row.get('code'),
            row.get('name'),
            row.get('category'),
            row.get('open_qty'),
            row.get('received_qty'),
            row.get('transferred_qty'),
            row.get('adjusted_qty'),
            row.get('sold_qty'),
            row.get('stock_qty'),
            row.get('counted_qty'),
            row.get('discrepancy'),
        ]
        for row in data.get('items', [])
    ]

    return _xlsx_response_from_sheets('inventory_valuation_report', {'Inventory': (headers, rows)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_inventory_valuation_report_pdf(request):
    response = inventory_valuation_report(request)
    if response.status_code != 200:
        return response
    data = response.data

    headers = ['Code', 'Name', 'Category', 'Open', 'Received', 'Sold', 'Stock', 'Counted', 'Discrepancy']
    rows = [
        [
            row.get('code'),
            row.get('name'),
            row.get('category'),
            row.get('open_qty'),
            row.get('received_qty'),
            row.get('sold_qty'),
            row.get('stock_qty'),
            row.get('counted_qty'),
            row.get('discrepancy'),
        ]
        for row in data.get('items', [])
    ]

    return _pdf_response_from_tables('inventory_valuation_report', 'Inventory Valuation', [('Inventory', headers, rows)])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_expenses_report_xlsx(request):
    response = expenses_report(request)
    if response.status_code != 200:
        return response
    data = response.data

    headers = ['Expense #', 'Title', 'Category', 'Vendor', 'Amount', 'Payment Method', 'Expense Date']
    rows = [
        [
            row.get('expense_number'),
            row.get('title'),
            row.get('category'),
            row.get('vendor'),
            row.get('amount'),
            row.get('payment_method'),
            row.get('expense_date'),
        ]
        for row in data.get('expenses', [])
    ]

    return _xlsx_response_from_sheets('expenses_report', {'Expenses': (headers, rows)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_expenses_report_pdf(request):
    response = expenses_report(request)
    if response.status_code != 200:
        return response
    data = response.data

    headers = ['Expense #', 'Title', 'Category', 'Amount', 'Date']
    rows = [
        [
            row.get('expense_number'),
            row.get('title'),
            row.get('category'),
            row.get('amount'),
            row.get('expense_date'),
        ]
        for row in data.get('expenses', [])
    ]

    return _pdf_response_from_tables('expenses_report', 'Expenses Report', [('Expenses', headers, rows)])

