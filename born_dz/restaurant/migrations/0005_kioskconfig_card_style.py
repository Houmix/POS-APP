from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('restaurant', '0004_kioskconfig_category_bg_color_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='kioskconfig',
            name='card_style',
            field=models.CharField(
                choices=[('gradient', 'Gradient sombre'), ('macdo', 'MacD (image + barre blanche)'), ('magazine', 'Magazine (badge flottant)')],
                default='gradient',
                max_length=20,
            ),
        ),
    ]
