from django.db import migrations, models


def ensure_has_distribution_column(apps, schema_editor):
    Tenant = apps.get_model('tenants', 'Tenant')
    table_name = Tenant._meta.db_table

    with schema_editor.connection.cursor() as cursor:
        existing_columns = {
            col.name
            for col in schema_editor.connection.introspection.get_table_description(cursor, table_name)
        }

    if 'has_distribution' not in existing_columns:
        field = models.BooleanField(default=False)
        field.set_attributes_from_name('has_distribution')
        schema_editor.add_field(Tenant, field)


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0007_tenant_has_distribution'),
    ]

    operations = [
        migrations.RunPython(ensure_has_distribution_column, migrations.RunPython.noop),
    ]
