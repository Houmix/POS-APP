from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('restaurant', '0006_kioskconfig_screensaver_image'),
    ]

    operations = [
        migrations.AddField(
            model_name='kioskconfig',
            name='composition_mode',
            field=models.CharField(
                choices=[('modal', 'Modale intégrée'), ('page', 'Page dédiée')],
                default='page',
                max_length=10,
            ),
        ),
    ]
