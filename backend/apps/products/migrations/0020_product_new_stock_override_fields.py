from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0019_alter_product_alcohol_percentage_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='new_stock_override',
            field=models.BooleanField(blank=True, help_text='Manual storefront new-stock override. Null uses automatic logic.', null=True),
        ),
        migrations.AddField(
            model_name='product',
            name='new_stock_override_until',
            field=models.DateTimeField(blank=True, help_text='Optional expiry for manual storefront new-stock override.', null=True),
        ),
    ]
