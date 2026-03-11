from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('restaurant', '0005_kioskconfig_card_style'),
    ]

    operations = [
        migrations.AddField(
            model_name='kioskconfig',
            name='screensaver_image',
            field=models.ImageField(blank=True, null=True, upload_to='kiosk/screensaver/'),
        ),
    ]
