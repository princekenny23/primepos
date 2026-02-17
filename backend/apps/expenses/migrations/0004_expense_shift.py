from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("expenses", "0003_expense_approval_notes_expense_approved_at_and_more"),
        ("shifts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="expense",
            name="shift",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="expenses", to="shifts.shift"),
        ),
    ]
