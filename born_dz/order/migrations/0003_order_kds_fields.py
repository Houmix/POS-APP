from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('order', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='kds_status',
            field=models.CharField(
                choices=[
                    ('pending_validation', 'En attente de validation'),
                    ('new', 'Nouvelle'),
                    ('in_progress', 'En préparation'),
                    ('done', 'Prête'),
                ],
                default='pending_validation',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='customer_identifier',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='order',
            name='delivery_type',
            field=models.CharField(
                choices=[
                    ('sur_place', 'Sur place'),
                    ('emporter', 'À emporter'),
                    ('livraison', 'Livraison'),
                ],
                default='sur_place',
                max_length=20,
            ),
        ),
    ]
