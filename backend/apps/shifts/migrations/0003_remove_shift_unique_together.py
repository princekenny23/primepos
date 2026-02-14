from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('shifts', '0002_shift_device_id_shift_sync_status_and_more'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='shift',
            unique_together=set(),
        ),
    ]
