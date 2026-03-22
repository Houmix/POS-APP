from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('customer', '0004_loyaltyreward_menu_option'),
    ]

    operations = [
        migrations.AddField(
            model_name='loyaltyreward',
            name='is_solo',
            field=models.BooleanField(default=False),
        ),
    ]
