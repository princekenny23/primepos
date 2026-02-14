from django.urls import path
from .views import (
    sales_report, products_report, customers_report, profit_loss_report, stock_movement_report,
    daily_sales_report, top_products_report, cash_summary_report, shift_summary_report,
    inventory_valuation_report, expenses_report,
    export_sales_report_xlsx, export_sales_report_pdf,
    export_products_report_xlsx, export_products_report_pdf,
    export_customers_report_xlsx, export_customers_report_pdf,
    export_profit_loss_report_xlsx, export_profit_loss_report_pdf,
    export_stock_movement_report_xlsx, export_stock_movement_report_pdf,
    export_inventory_valuation_report_xlsx, export_inventory_valuation_report_pdf,
    export_expenses_report_xlsx, export_expenses_report_pdf
)

urlpatterns = [
    path('reports/sales/', sales_report, name='sales-report'),
    path('reports/products/', products_report, name='products-report'),
    path('reports/customers/', customers_report, name='customers-report'),
    path('reports/profit-loss/', profit_loss_report, name='profit-loss-report'),
    path('reports/stock-movement/', stock_movement_report, name='stock-movement-report'),
    path('reports/expenses/', expenses_report, name='expenses-report'),
    # New reporting endpoints
    path('reports/daily-sales/', daily_sales_report, name='daily-sales-report'),
    path('reports/top-products/', top_products_report, name='top-products-report'),
    path('reports/cash-summary/', cash_summary_report, name='cash-summary-report'),
    path('reports/shift-summary/', shift_summary_report, name='shift-summary-report'),
    # Comprehensive inventory valuation report
    path('reports/inventory-valuation/', inventory_valuation_report, name='inventory-valuation-report'),
    # Export endpoints (XLSX/PDF)
    path('reports/sales/export/xlsx/', export_sales_report_xlsx, name='sales-report-xlsx'),
    path('reports/sales/export/pdf/', export_sales_report_pdf, name='sales-report-pdf'),
    path('reports/products/export/xlsx/', export_products_report_xlsx, name='products-report-xlsx'),
    path('reports/products/export/pdf/', export_products_report_pdf, name='products-report-pdf'),
    path('reports/customers/export/xlsx/', export_customers_report_xlsx, name='customers-report-xlsx'),
    path('reports/customers/export/pdf/', export_customers_report_pdf, name='customers-report-pdf'),
    path('reports/profit-loss/export/xlsx/', export_profit_loss_report_xlsx, name='profit-loss-report-xlsx'),
    path('reports/profit-loss/export/pdf/', export_profit_loss_report_pdf, name='profit-loss-report-pdf'),
    path('reports/stock-movement/export/xlsx/', export_stock_movement_report_xlsx, name='stock-movement-report-xlsx'),
    path('reports/stock-movement/export/pdf/', export_stock_movement_report_pdf, name='stock-movement-report-pdf'),
    path('reports/inventory-valuation/export/xlsx/', export_inventory_valuation_report_xlsx, name='inventory-valuation-report-xlsx'),
    path('reports/inventory-valuation/export/pdf/', export_inventory_valuation_report_pdf, name='inventory-valuation-report-pdf'),
    path('reports/expenses/export/xlsx/', export_expenses_report_xlsx, name='expenses-report-xlsx'),
    path('reports/expenses/export/pdf/', export_expenses_report_pdf, name='expenses-report-pdf'),
]

