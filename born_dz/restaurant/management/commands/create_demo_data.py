"""
python manage.py create_demo_data
  --reset   Supprime et recrée toutes les données démo
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta


class Command(BaseCommand):
    help = 'Crée un restaurant démo avec menus, étapes et un compte caissier.'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Supprime les données démo existantes avant de recréer')

    def handle(self, *args, **options):
        from chain.models import Chain
        from restaurant.models import Restaurant, KioskConfig
        from menu.models import GroupMenu, Menu, Step, MenuStep, Option, StepOption
        from user.models import User, Role, Employee
        from terminal.models import License

        # ── Reset si demandé ──────────────────────────────────────
        if options['reset']:
            Restaurant.objects.filter(name='ClickGo Démo').delete()
            User.objects.filter(phone='0600000000').delete()
            self.stdout.write(self.style.WARNING('Données démo supprimées.'))

        # ── 1. Restaurant ─────────────────────────────────────────
        chain, _ = Chain.objects.get_or_create(name='ClickGo Demo Chain')
        restaurant, created = Restaurant.objects.get_or_create(
            name='ClickGo Démo',
            defaults={
                'address': '12 Rue de la Démo, Alger',
                'phone': '0550000000',
                'immat': 'DEMO-2024',
                'chain': chain,
            }
        )
        if not created:
            self.stdout.write(self.style.WARNING('Restaurant démo déjà existant — on complète les données manquantes.'))

        # ── 2. KioskConfig ────────────────────────────────────────
        KioskConfig.objects.get_or_create(
            restaurant=restaurant,
            defaults={
                'primary_color': '#F97316',
                'secondary_color': '#0f172a',
                'background_color': '#F8F9FA',
                'sidebar_color': '#0f172a',
                'category_bg_color': '#0f172a',
                'selected_category_bg_color': '#1e293b',
                'category_text_color': '#94a3b8',
                'card_style': 'macdo',
            }
        )

        # ── 3. Licence démo (2 ans) ───────────────────────────────
        if not restaurant.licenses.filter(status='active').exists():
            License.objects.create(
                key=License.generate_key(),
                restaurant=restaurant,
                plan='premium',
                status='active',
                max_terminals=10,
                expires_at=timezone.now() + timedelta(days=730),
                features=['kds', 'analytics', 'multi_language'],
            )

        # ── 4. Catégories ─────────────────────────────────────────
        cat_burgers, _ = GroupMenu.objects.get_or_create(
            name='Burgers', restaurant=restaurant,
            defaults={'description': 'Nos burgers signature', 'position': 0}
        )
        cat_sandwichs, _ = GroupMenu.objects.get_or_create(
            name='Sandwichs', restaurant=restaurant,
            defaults={'description': 'Sandwichs & wraps', 'position': 1}
        )
        cat_boissons, _ = GroupMenu.objects.get_or_create(
            name='Boissons', restaurant=restaurant,
            defaults={'description': 'Boissons fraîches', 'position': 2}
        )
        cat_desserts, _ = GroupMenu.objects.get_or_create(
            name='Desserts', restaurant=restaurant,
            defaults={'description': 'Douceurs & desserts', 'position': 3}
        )

        # ── 5. Options ────────────────────────────────────────────
        def opt(name, extra=0):
            o, _ = Option.objects.get_or_create(name=name, defaults={'extra_price': extra})
            return o

        o_bbq        = opt('BBQ')
        o_ketchup    = opt('Ketchup')
        o_mayo       = opt('Mayonnaise')
        o_harissa    = opt('Harissa')
        o_blanche    = opt('Sauce blanche')
        o_saignant   = opt('Saignant')
        o_apoint     = opt('À point')
        o_biencuit   = opt('Bien cuit')
        o_coca       = opt('Coca-Cola')
        o_orangina   = opt('Orangina')
        o_eau        = opt('Eau minérale')
        o_caramel    = opt('Caramel')
        o_choco      = opt('Chocolat')
        o_fraise     = opt('Fraise')
        o_coco       = opt('Noix de coco')

        # ── 6. Étapes (niveau restaurant) ─────────────────────────
        def step(name, max_opt=1):
            s, _ = Step.objects.get_or_create(
                name=name, restaurant=restaurant,
                defaults={'max_options': max_opt}
            )
            return s

        s_sauce    = step('Sauce', max_opt=2)
        s_cuisson  = step('Cuisson', max_opt=1)
        s_boisson  = step('Boisson du menu', max_opt=1)
        s_garni    = step('Garniture glace', max_opt=2)

        # Lier options aux étapes
        def link_so(step_obj, option_obj, is_default=False):
            StepOption.objects.get_or_create(
                step=step_obj, option=option_obj,
                defaults={'is_default': is_default}
            )

        for o in [o_bbq, o_ketchup, o_mayo, o_harissa, o_blanche]:
            link_so(s_sauce, o, is_default=(o == o_ketchup))
        for o in [o_saignant, o_apoint, o_biencuit]:
            link_so(s_cuisson, o, is_default=(o == o_apoint))
        for o in [o_coca, o_orangina, o_eau]:
            link_so(s_boisson, o, is_default=(o == o_coca))
        for o in [o_caramel, o_choco, o_fraise, o_coco]:
            link_so(s_garni, o)

        # ── 7. Menus ──────────────────────────────────────────────
        def menu(name, desc, price, solo_price, cat, mtype, offer_choice=True, pos=0):
            m, _ = Menu.objects.get_or_create(
                name=name, group_menu=cat,
                defaults={
                    'description': desc,
                    'price': price,
                    'solo_price': solo_price,
                    'type': mtype,
                    'offer_menu_choice': offer_choice,
                    'position': pos,
                }
            )
            return m

        # Burgers
        classic  = menu('Classic Burger',  'Bœuf, cheddar, salade, tomate',       490, 350, cat_burgers,  'burger', pos=0)
        double   = menu('Double Cheese',   'Double steak, double cheddar fondu',   650, 490, cat_burgers,  'burger', pos=1)
        crispy   = menu('Crispy Chicken',  'Filet poulet croustillant, coleslaw',  580, 420, cat_burgers,  'burger', pos=2)

        # Sandwichs
        wrap     = menu('Chicken Wrap',    'Poulet grillé, légumes, sauce blanche', 450, 320, cat_sandwichs, 'wrap', pos=0)
        shawa    = menu('Shawarma',        'Viande marinée, légumes, sauce harissa',420, 300, cat_sandwichs, 'sandwich', pos=1)

        # Boissons (pas de choix solo/menu)
        coca_m   = menu('Coca-Cola',       'Boisson gazeuse 33cl',                 150, 150, cat_boissons, 'drink', offer_choice=False, pos=0)
        orng_m   = menu('Orangina',        'Boisson gazeuse à l\'orange 33cl',     150, 150, cat_boissons, 'drink', offer_choice=False, pos=1)
        eau_m    = menu('Eau minérale',    'Eau minérale 50cl',                     80,  80, cat_boissons, 'drink', offer_choice=False, pos=2)

        # Desserts (glace → toujours vers garniture)
        glace    = menu('Glace Vanille',   'Glace artisanale, choisissez votre garniture', 200, 200, cat_desserts, 'dessert', offer_choice=False, pos=0)
        brownie  = menu('Brownie',         'Brownie chocolat moelleux',            250, 250, cat_desserts, 'dessert', offer_choice=False, pos=1)

        # ── 8. MenuSteps ──────────────────────────────────────────
        def ms(menu_obj, step_obj, number, solo=True, full=True):
            MenuStep.objects.get_or_create(
                menu=menu_obj, step=step_obj,
                defaults={'number': number, 'show_for_solo': solo, 'show_for_full': full}
            )

        for burger in [classic, double, crispy]:
            ms(burger, s_sauce,   1, solo=True,  full=True)
            ms(burger, s_cuisson, 2, solo=True,  full=True)
            ms(burger, s_boisson, 3, solo=False, full=True)

        for sandwich in [wrap, shawa]:
            ms(sandwich, s_sauce,   1, solo=True,  full=True)
            ms(sandwich, s_boisson, 2, solo=False, full=True)

        ms(glace, s_garni, 1, solo=True, full=True)

        # ── 9. Compte caissier démo ───────────────────────────────
        role_cashier, _ = Role.objects.get_or_create(role='cashier')
        role_owner, _   = Role.objects.get_or_create(role='owner')

        # Caissier démo
        if not User.objects.filter(phone='0600000000').exists():
            cashier_user = User(
                phone='0600000000',
                username='demo_caissier',
                role=role_cashier,
            )
            cashier_user.password = '123456'
            cashier_user.save()
            Employee.objects.create(
                user=cashier_user,
                restaurant=restaurant,
                first_name='Demo',
                last_name='Caissier',
            )

        # Manager démo
        if not User.objects.filter(phone='0600000001').exists():
            manager_user = User(
                phone='0600000001',
                username='demo_manager',
                role=role_owner,
            )
            manager_user.password = '123456'
            manager_user.save()
            Employee.objects.create(
                user=manager_user,
                restaurant=restaurant,
                first_name='Demo',
                last_name='Manager',
            )

        self.stdout.write(self.style.SUCCESS(
            '\n✅ Données démo créées avec succès !\n'
            '─────────────────────────────────────\n'
            f'  Restaurant : ClickGo Démo (ID={restaurant.id})\n'
            '  Caissier   : 0600000000 / 123456\n'
            '  Manager    : 0600000001 / 123456\n'
            '  Catégories : Burgers, Sandwichs, Boissons, Desserts\n'
            '  Menus      : 10 articles\n'
            '  Étapes     : Sauce, Cuisson, Boisson, Garniture\n'
            f'  Display    : /order/display/{restaurant.id}/\n'
            '─────────────────────────────────────'
        ))
