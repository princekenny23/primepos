# Generated manually for Phase 1 import engine foundation
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('outlets', '0012_remove_outlet_distribution_active'),
        ('tenants', '0014_backfill_tenant_subdomain_domain'),
    ]

    operations = [
        migrations.CreateModel(
            name='ImportBatch',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('entity_type', models.CharField(choices=[('products', 'Products')], default='products', max_length=50)),
                ('sync_mode', models.CharField(choices=[('upsert_adjust', 'Upsert + Adjust')], default='upsert_adjust', max_length=50)),
                ('status', models.CharField(choices=[('uploaded', 'Uploaded'), ('preview_ready', 'Preview Ready'), ('applying', 'Applying'), ('applied', 'Applied'), ('failed', 'Failed')], default='uploaded', max_length=50)),
                ('source_filename', models.CharField(max_length=255)),
                ('source_file', models.FileField(upload_to='imports/%Y/%m/%d/')),
                ('idempotency_key', models.CharField(blank=True, max_length=128, null=True)),
                ('total_rows', models.IntegerField(default=0)),
                ('valid_rows', models.IntegerField(default=0)),
                ('invalid_rows', models.IntegerField(default=0)),
                ('warning_rows', models.IntegerField(default=0)),
                ('applied_rows', models.IntegerField(default=0)),
                ('preview_summary', models.JSONField(blank=True, default=dict)),
                ('apply_summary', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('previewed_at', models.DateTimeField(blank=True, null=True)),
                ('applied_at', models.DateTimeField(blank=True, null=True)),
                ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approved_import_batches', to=settings.AUTH_USER_MODEL)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_import_batches', to=settings.AUTH_USER_MODEL)),
                ('outlet', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='import_batches', to='outlets.outlet')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='import_batches', to='tenants.tenant')),
            ],
            options={
                'db_table': 'imports_importbatch',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='ImportAuditEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(max_length=64)),
                ('message', models.TextField(blank=True)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('batch', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='events', to='imports.importbatch')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='import_audit_events', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'imports_importauditevent',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='ImportRowResult',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('row_number', models.IntegerField()),
                ('status', models.CharField(choices=[('valid', 'Valid'), ('invalid', 'Invalid'), ('warning', 'Warning')], max_length=20)),
                ('action', models.CharField(choices=[('create', 'Create'), ('update', 'Update'), ('skip', 'Skip')], default='skip', max_length=20)),
                ('identity_key', models.CharField(blank=True, max_length=255)),
                ('errors', models.JSONField(blank=True, default=list)),
                ('warnings', models.JSONField(blank=True, default=list)),
                ('raw_data', models.JSONField(blank=True, default=dict)),
                ('normalized_data', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('batch', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rows', to='imports.importbatch')),
            ],
            options={
                'db_table': 'imports_importrowresult',
                'ordering': ['row_number'],
                'unique_together': {('batch', 'row_number')},
            },
        ),
        migrations.AddIndex(
            model_name='importbatch',
            index=models.Index(fields=['tenant', 'entity_type', 'status'], name='imports_imp_tenant__3c704a_idx'),
        ),
        migrations.AddIndex(
            model_name='importbatch',
            index=models.Index(fields=['tenant', 'outlet', 'created_at'], name='imports_imp_tenant__983c65_idx'),
        ),
        migrations.AddIndex(
            model_name='importbatch',
            index=models.Index(fields=['idempotency_key'], name='imports_imp_idempot_3ed4be_idx'),
        ),
        migrations.AddConstraint(
            model_name='importbatch',
            constraint=models.UniqueConstraint(fields=('tenant', 'entity_type', 'idempotency_key'), name='uniq_import_batch_idempotency_per_tenant_entity'),
        ),
        migrations.AddIndex(
            model_name='importauditevent',
            index=models.Index(fields=['batch', 'created_at'], name='imports_imp_batch_i_7dd0e1_idx'),
        ),
        migrations.AddIndex(
            model_name='importauditevent',
            index=models.Index(fields=['event_type'], name='imports_imp_event_t_7f602d_idx'),
        ),
        migrations.AddIndex(
            model_name='importrowresult',
            index=models.Index(fields=['batch', 'status'], name='imports_imp_batch_i_0948b7_idx'),
        ),
        migrations.AddIndex(
            model_name='importrowresult',
            index=models.Index(fields=['batch', 'action'], name='imports_imp_batch_i_651d9f_idx'),
        ),
    ]
