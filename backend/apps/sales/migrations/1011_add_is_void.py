from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("sales", "1010_add_discount_amount"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    "ALTER TABLE sales_sale "
                    "ADD COLUMN IF NOT EXISTS is_void boolean DEFAULT false NOT NULL;"
                ),
                migrations.RunSQL(
                    "UPDATE sales_sale SET is_void = false WHERE is_void IS NULL;"
                ),
                migrations.RunSQL(
                    "ALTER TABLE sales_sale ALTER COLUMN is_void SET DEFAULT false;"
                ),
                migrations.RunSQL(
                    "ALTER TABLE sales_sale ALTER COLUMN is_void SET NOT NULL;"
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="sale",
                    name="is_void",
                    field=models.BooleanField(default=False),
                ),
            ],
        )
    ]
