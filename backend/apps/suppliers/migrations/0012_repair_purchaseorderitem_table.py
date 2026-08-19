from django.db import migrations


class Migration(migrations.Migration):
    """Recreate a table missing from databases where 0003 was recorded as applied."""

    dependencies = [
        ('suppliers', '0011_rename_suppliers_purchasereturnitem_tenant_idx_suppliers_p_tenant__972a13_idx_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS suppliers_purchaseorderitem (
                id BIGSERIAL PRIMARY KEY,
                quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
                unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
                total NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
                received_quantity INTEGER NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
                notes TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                purchase_order_id BIGINT NOT NULL REFERENCES suppliers_purchaseorder(id) DEFERRABLE INITIALLY DEFERRED,
                product_id BIGINT NOT NULL REFERENCES products_product(id) DEFERRABLE INITIALLY DEFERRED,
                supplier_id BIGINT NULL REFERENCES suppliers_supplier(id) DEFERRABLE INITIALLY DEFERRED,
                supplier_status VARCHAR(20) NOT NULL DEFAULT 'no_supplier'
            );
            CREATE INDEX IF NOT EXISTS suppliers_p_purchas_f035df_idx ON suppliers_purchaseorderitem (purchase_order_id);
            CREATE INDEX IF NOT EXISTS suppliers_p_product_60b559_idx ON suppliers_purchaseorderitem (product_id);
            CREATE INDEX IF NOT EXISTS suppliers_p_supplie_620340_idx ON suppliers_purchaseorderitem (supplier_id);
            CREATE INDEX IF NOT EXISTS suppliers_p_supplie_993f97_idx ON suppliers_purchaseorderitem (supplier_status);
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]