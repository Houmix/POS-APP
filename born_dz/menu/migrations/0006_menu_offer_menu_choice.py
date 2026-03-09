from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('menu', '0005_refactor_step_restaurant_level'),
    ]

    operations = [
        migrations.AddField(
            model_name='menu',
            name='offer_menu_choice',
            field=models.BooleanField(default=True),
        ),
    ]
