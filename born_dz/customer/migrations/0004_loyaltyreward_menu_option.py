from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('customer', '0003_customerloyalty_loyaltyreward_loyaltyredemption'),
        ('menu', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='loyaltyreward',
            name='reward_type',
            field=models.CharField(
                choices=[('menu', 'Menu (plat)'), ('option', 'Option (supplément)'), ('custom', 'Récompense personnalisée')],
                default='custom',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='loyaltyreward',
            name='menu',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='loyalty_rewards',
                to='menu.menu',
            ),
        ),
        migrations.AddField(
            model_name='loyaltyreward',
            name='option',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='loyalty_rewards',
                to='menu.option',
            ),
        ),
        migrations.AlterField(
            model_name='loyaltyreward',
            name='name',
            field=models.CharField(blank=True, max_length=128),
        ),
    ]
