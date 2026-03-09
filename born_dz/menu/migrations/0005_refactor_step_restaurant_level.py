"""
Migration : Refactoring des étapes au niveau restaurant.

Avant :
  - Step.menu FK → lié à un menu spécifique
  - Step.number, Step.type, Step.show_for_solo, Step.show_for_full
  - Option.type avec choices fixes

Après :
  - Step.restaurant FK → étape réutilisable au niveau restaurant
  - Nouveau modèle MenuStep (menu, step, number, show_for_solo, show_for_full)
  - Option.type devient un champ libre (sans choices)
"""

from django.db import migrations, models
import django.db.models.deletion


def migrate_steps_to_restaurant_level(apps, schema_editor):
    """
    Pour chaque Step existant :
    1. Récupère le restaurant via step.menu.group_menu.restaurant
    2. Crée un MenuStep (lien menu ↔ step)
    3. Assigne le restaurant à la step
    """
    Step = apps.get_model('menu', 'Step')
    MenuStep = apps.get_model('menu', 'MenuStep')

    for step in Step.objects.select_related('menu__group_menu__restaurant').all():
        menu = step.menu
        if not menu or not menu.group_menu or not menu.group_menu.restaurant:
            # Pas de restaurant trouvable → on supprime cette step orpheline
            step.delete()
            continue

        # Assigner le restaurant
        step.restaurant = menu.group_menu.restaurant
        step.save()

        # Créer le MenuStep correspondant
        MenuStep.objects.get_or_create(
            menu=menu,
            step=step,
            defaults={
                'number': step.number,
                'show_for_solo': step.show_for_solo,
                'show_for_full': step.show_for_full,
            }
        )


class Migration(migrations.Migration):

    dependencies = [
        ('menu', '0004_menu_show_in_crosssell_alter_menu_type'),
        ('restaurant', '0001_initial'),
    ]

    operations = [
        # 1. Ajouter restaurant FK (nullable temporairement pour la data migration)
        migrations.AddField(
            model_name='step',
            name='restaurant',
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='steps',
                to='restaurant.restaurant',
            ),
        ),

        # 2. Créer le modèle MenuStep
        migrations.CreateModel(
            name='MenuStep',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('number', models.IntegerField(default=0)),
                ('show_for_solo', models.BooleanField(default=True)),
                ('show_for_full', models.BooleanField(default=True)),
                ('menu', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='menu_steps', to='menu.menu')),
                ('step', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='menu_steps', to='menu.step')),
            ],
            options={
                'ordering': ['number'],
                'unique_together': {('menu', 'step')},
            },
        ),

        # 3. Data migration : peupler restaurant + créer MenuSteps
        migrations.RunPython(
            migrate_steps_to_restaurant_level,
            reverse_code=migrations.RunPython.noop,
        ),

        # 4. Rendre restaurant FK non-nullable
        migrations.AlterField(
            model_name='step',
            name='restaurant',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='steps',
                to='restaurant.restaurant',
            ),
        ),

        # 5. Supprimer les anciens champs de Step
        migrations.RemoveField(model_name='step', name='menu'),
        migrations.RemoveField(model_name='step', name='number'),
        migrations.RemoveField(model_name='step', name='type'),
        migrations.RemoveField(model_name='step', name='show_for_solo'),
        migrations.RemoveField(model_name='step', name='show_for_full'),

        # 6. Option.type → champ libre (supprimer les choices, autoriser blank)
        migrations.AlterField(
            model_name='option',
            name='type',
            field=models.CharField(max_length=50, blank=True, default=''),
        ),
    ]
