from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('restaurant', '0008_add_remote_url_to_kioskconfig'),
    ]

    operations = [
        migrations.AddField(
            model_name='kioskconfig',
            name='screensaver_image_remote_url',
            field=models.URLField(blank=True, null=True),
        ),
    ]
