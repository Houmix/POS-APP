from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('restaurant', '0010_loyalty_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='kioskconfig',
            name='selected_category_text_color',
            field=models.CharField(default='#ff69b4', max_length=7),
        ),
        migrations.AddField(
            model_name='kioskconfig',
            name='sidebar_display_mode',
            field=models.CharField(
                choices=[('with_image', 'Avec image de catégorie'), ('without_image', 'Sans image')],
                default='with_image',
                max_length=20,
            ),
        ),
    ]
