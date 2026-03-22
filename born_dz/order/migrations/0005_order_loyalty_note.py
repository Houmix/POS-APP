from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('order', '0004_alter_order_kds_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='loyalty_note',
            field=models.TextField(blank=True, default=''),
        ),
    ]
