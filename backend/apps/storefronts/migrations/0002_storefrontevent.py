from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('storefronts', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='StorefrontEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_name', models.CharField(max_length=64)),
                ('session_id', models.CharField(blank=True, max_length=64)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('storefront', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='events', to='storefronts.storefront')),
            ],
            options={
                'db_table': 'storefronts_event',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='storefrontevent',
            index=models.Index(fields=['storefront', 'created_at'], name='storefronts_storefr_created_19f90a_idx'),
        ),
        migrations.AddIndex(
            model_name='storefrontevent',
            index=models.Index(fields=['storefront', 'event_name'], name='storefronts_storefr_event_n_a757f8_idx'),
        ),
    ]
