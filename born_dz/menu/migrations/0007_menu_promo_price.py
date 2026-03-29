from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('menu', '0006_menu_offer_menu_choice'),
    ]

    operations = [
        migrations.AddField(
            model_name='menu',
            name='promo_price',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text="Prix promotionnel (l'ancien prix sera barré)",
                max_digits=10,
                null=True,
            ),
        ),
    ]
