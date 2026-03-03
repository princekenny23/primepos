from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '1014_alter_sale_is_void_alter_sale_void_reason_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='sale',
            name='delivery_required',
            field=models.BooleanField(default=False),
        ),
    ]
