# Generated migration for supplier-optional purchase orders

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('suppliers', '0006_autopoauditlog'),
    ]

    operations = [
        # Make PurchaseOrder.supplier nullable
        migrations.AlterField(
            model_name='purchaseorder',
            name='supplier',
            field=models.ForeignKey(
                blank=True,
                help_text='Optional: Can be assigned later. Item-level suppliers take precedence.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='purchase_orders',
                to='suppliers.supplier'
            ),
        ),
        
        # Add supplier field to PurchaseOrderItem
        migrations.AddField(
            model_name='purchaseorderitem',
            name='supplier',
            field=models.ForeignKey(
                blank=True,
                help_text='Optional: Supplier for this specific item. Takes precedence over PO-level supplier.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='purchase_order_items',
                to='suppliers.supplier'
            ),
        ),
        
        # Add supplier_status field to PurchaseOrderItem
        migrations.AddField(
            model_name='purchaseorderitem',
            name='supplier_status',
            field=models.CharField(
                choices=[('no_supplier', 'No Supplier'), ('supplier_assigned', 'Supplier Assigned')],
                default='no_supplier',
                help_text='Status of supplier assignment for this item',
                max_length=20
            ),
        ),
        
        # Add new constraints that allow same product with different suppliers
        migrations.AddConstraint(
            model_name='purchaseorderitem',
            constraint=models.UniqueConstraint(
                condition=models.Q(('product__isnull', False)),
                fields=('purchase_order', 'product', 'supplier'),
                name='unique_po_product_supplier'
            ),
        ),
        migrations.AddConstraint(
            model_name='purchaseorderitem',
            constraint=models.UniqueConstraint(
                condition=models.Q(('product__isnull', False), ('supplier__isnull', True)),
                fields=('purchase_order', 'product'),
                name='unique_po_product_no_supplier'
            ),
        ),
        
        # Add indexes
        migrations.AddIndex(
            model_name='purchaseorderitem',
            index=models.Index(fields=['supplier'], name='suppliers_p_supplie_idx'),
        ),
        migrations.AddIndex(
            model_name='purchaseorderitem',
            index=models.Index(fields=['supplier_status'], name='suppliers_p_supplie_status_idx'),
        ),
    ]

