from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tourism', '0003_package_type_normal'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='cancellation_reason',
            field=models.CharField(blank=True, choices=[('payment_timeout', 'Payment Timeout'), ('cancelled_by_user', 'Cancelled By User')], max_length=40),
        ),
        migrations.AddField(
            model_name='booking',
            name='payment_due_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
