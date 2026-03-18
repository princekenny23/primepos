from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '1018_print_architecture_upgrade'),
    ]

    operations = [
        migrations.AddField(
            model_name='printdevice',
            name='api_key_created_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='printdevice',
            name='api_key_last_used_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='printdevice',
            name='api_key_pending',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='printdevice',
            name='api_key_revoked',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='printdevice',
            name='api_key_revoked_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='printdevice',
            name='paired_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='printdevice',
            name='pairing_code',
            field=models.CharField(blank=True, default='', max_length=6),
        ),
        migrations.AddField(
            model_name='printdevice',
            name='pairing_expires_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
