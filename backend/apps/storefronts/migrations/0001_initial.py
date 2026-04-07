from decimal import Decimal

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('outlets', '0010_ensure_business_type_column'),
        ('products', '0019_alter_product_alcohol_percentage_and_more'),
        ('sales', '1022_rename_sales_conne_device__7ef5e5_idx_sales_conne_device__f7d47d_idx_and_more'),
        ('tenants', '0011_tenantpermissions_office_split_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='Storefront',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('slug', models.SlugField(max_length=120)),
                ('is_active', models.BooleanField(default=True)),
                ('whatsapp_number', models.CharField(blank=True, max_length=32)),
                ('currency_override', models.CharField(blank=True, max_length=3)),
                ('theme_settings', models.JSONField(blank=True, default=dict)),
                ('checkout_settings', models.JSONField(blank=True, default=dict)),
                ('seo_settings', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('default_outlet', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='storefronts', to='outlets.outlet')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='storefronts', to='tenants.tenant')),
            ],
            options={
                'db_table': 'storefronts_storefront',
                'ordering': ['name'],
                'unique_together': {('tenant', 'slug')},
            },
        ),
        migrations.CreateModel(
            name='StorefrontDomain',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('domain', models.CharField(max_length=255, unique=True)),
                ('is_primary', models.BooleanField(default=False)),
                ('is_verified', models.BooleanField(default=False)),
                ('ssl_status', models.CharField(default='unknown', max_length=32)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('storefront', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='domains', to='storefronts.storefront')),
            ],
            options={
                'db_table': 'storefronts_domain',
                'ordering': ['-is_primary', 'domain'],
            },
        ),
        migrations.CreateModel(
            name='StorefrontDeliveryZone',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('fee', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=12)),
                ('minimum_order', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=12)),
                ('is_active', models.BooleanField(default=True)),
                ('storefront', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='delivery_zones', to='storefronts.storefront')),
            ],
            options={
                'db_table': 'storefronts_delivery_zone',
                'ordering': ['name'],
                'unique_together': {('storefront', 'name')},
            },
        ),
        migrations.CreateModel(
            name='StorefrontCatalogRule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('rule_type', models.CharField(choices=[('include', 'Include'), ('exclude', 'Exclude')], max_length=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('category', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='storefront_rules', to='products.category')),
                ('product', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='storefront_rules', to='products.product')),
                ('storefront', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='catalog_rules', to='storefronts.storefront')),
            ],
            options={
                'db_table': 'storefronts_catalog_rule',
            },
        ),
        migrations.CreateModel(
            name='StorefrontOrder',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('public_order_ref', models.CharField(max_length=32, unique=True)),
                ('channel', models.CharField(choices=[('whatsapp', 'WhatsApp')], default='whatsapp', max_length=24)),
                ('payment_method', models.CharField(default='cash', max_length=20)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('confirmed', 'Confirmed'), ('cancelled', 'Cancelled')], default='pending', max_length=20)),
                ('customer_name', models.CharField(max_length=255)),
                ('customer_phone', models.CharField(blank=True, max_length=32)),
                ('customer_address', models.TextField(blank=True)),
                ('whatsapp_message', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('sale', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='storefront_order', to='sales.sale')),
                ('storefront', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='orders', to='storefronts.storefront')),
            ],
            options={
                'db_table': 'storefronts_order',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='storefront',
            index=models.Index(fields=['tenant', 'is_active'], name='storefronts_tenant__0ed79f_idx'),
        ),
        migrations.AddIndex(
            model_name='storefront',
            index=models.Index(fields=['slug'], name='storefronts_slug_985d17_idx'),
        ),
        migrations.AddIndex(
            model_name='storefrontdomain',
            index=models.Index(fields=['domain'], name='storefronts_domain_1eb84f_idx'),
        ),
        migrations.AddIndex(
            model_name='storefrontcatalogrule',
            index=models.Index(fields=['storefront', 'rule_type'], name='storefronts_storefr_378434_idx'),
        ),
        migrations.AddIndex(
            model_name='storefrontorder',
            index=models.Index(fields=['storefront', 'status'], name='storefronts_storefr_88695f_idx'),
        ),
        migrations.AddIndex(
            model_name='storefrontorder',
            index=models.Index(fields=['public_order_ref'], name='storefronts_public__450f24_idx'),
        ),
    ]
