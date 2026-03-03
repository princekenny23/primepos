from django.db import migrations, models


def ensure_business_type_column(apps, schema_editor):
    Outlet = apps.get_model('outlets', 'Outlet')
    table_name = Outlet._meta.db_table

    with schema_editor.connection.cursor() as cursor:
        existing_columns = {
            col.name
            for col in schema_editor.connection.introspection.get_table_description(cursor, table_name)
        }

    if 'business_type' not in existing_columns:
        field = models.CharField(
            max_length=30,
            choices=[
                ('wholesale_and_retail', 'Wholesale and Retail'),
                ('restaurant', 'Restaurant'),
                ('bar', 'Bar'),
            ],
            null=True,
            blank=True,
            help_text='Business type for this outlet (inherits from tenant if not set)',
        )
        field.set_attributes_from_name('business_type')
        schema_editor.add_field(Outlet, field)

    schema_editor.execute(
        'CREATE INDEX IF NOT EXISTS outlets_out_tenant__3d8a20_idx '
        'ON outlets_outlet (tenant_id, business_type)'
    )


class Migration(migrations.Migration):

    dependencies = [
        ('outlets', '0009_outlet_business_type_nullable'),
    ]

    operations = [
        migrations.RunPython(ensure_business_type_column, migrations.RunPython.noop),
    ]
