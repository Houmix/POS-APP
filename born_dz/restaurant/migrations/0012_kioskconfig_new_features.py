from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('restaurant', '0011_sidebar_display_selected_text_color'),
    ]

    operations = [
        migrations.AddField(
            model_name='kioskconfig',
            name='category_display_mode',
            field=models.CharField(
                choices=[('sidebar', "Barre latérale (défaut)"), ('grid_macdo', "Grille plein écran (style McDonald's)")],
                default='sidebar',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='kioskconfig',
            name='tva_rate',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=5),
        ),
        migrations.AddField(
            model_name='kioskconfig',
            name='ticket_header',
            field=models.CharField(blank=True, default='', max_length=256),
        ),
        migrations.AddField(
            model_name='kioskconfig',
            name='ticket_footer',
            field=models.CharField(blank=True, default='', max_length=256),
        ),
        migrations.AddField(
            model_name='kioskconfig',
            name='ticket_show_tva',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='kioskconfig',
            name='delivery_modes',
            field=models.CharField(
                choices=[('both', 'Sur place et emporter'), ('sur_place_only', 'Sur place uniquement'), ('emporter_only', 'Emporter uniquement')],
                default='both',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='kioskconfig',
            name='kitchen_printer_ip',
            field=models.CharField(blank=True, default='', max_length=15),
        ),
        migrations.AddField(
            model_name='kioskconfig',
            name='kitchen_printer_port',
            field=models.IntegerField(default=9100),
        ),
        migrations.AddField(
            model_name='kioskconfig',
            name='kitchen_printer_enabled',
            field=models.BooleanField(default=False),
        ),
    ]
