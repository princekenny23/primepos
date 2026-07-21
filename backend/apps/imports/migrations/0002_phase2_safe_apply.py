from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('imports', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='importbatch',
            name='is_approved',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='importbatch',
            name='approved_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='importbatch',
            name='apply_idempotency_key',
            field=models.CharField(blank=True, max_length=128, null=True),
        ),
        migrations.CreateModel(
            name='ImportApplyError',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('row_number', models.IntegerField(blank=True, null=True)),
                ('chunk_index', models.IntegerField(default=0)),
                ('error_code', models.CharField(default='apply_error', max_length=64)),
                ('message', models.TextField()),
                ('details', models.JSONField(blank=True, default=dict)),
                ('raw_data', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('batch', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='apply_errors', to='imports.importbatch')),
            ],
            options={
                'db_table': 'imports_importapplyerror',
                'ordering': ['created_at', 'row_number'],
            },
        ),
        migrations.AddIndex(
            model_name='importapplyerror',
            index=models.Index(fields=['batch', 'chunk_index'], name='imports_imp_batch_i_d72d43_idx'),
        ),
        migrations.AddIndex(
            model_name='importapplyerror',
            index=models.Index(fields=['batch', 'row_number'], name='imports_imp_batch_i_a38f41_idx'),
        ),
        migrations.AddIndex(
            model_name='importapplyerror',
            index=models.Index(fields=['error_code'], name='imports_imp_error_c_9f9fc5_idx'),
        ),
    ]
