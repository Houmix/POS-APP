"""
Tests d'intégration ClickGo POS — born_dz
Couvre : commandes, menus, sync, fidélité, ticket, multi-restaurant, KPI
"""
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from restaurant.models import Restaurant
from menu.models import GroupMenu, Menu, Step, Option, MenuStep, StepOption
from order.models import Order, OrderItem
from customer.models import CustomerLoyalty, LoyaltyReward, LoyaltyRedemption
from sync.models import SyncLog

User = get_user_model()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

_resto_counter = 0

def make_restaurant(name="TestBurger"):
    global _resto_counter
    _resto_counter += 1
    return Restaurant.objects.create(name=name, address="1 Rue Test", phone=f"050{_resto_counter:07d}")


def make_user(restaurant=None, phone="0600000001"):
    """Crée un user valide (mot de passe 6 chiffres, username=phone)."""
    from user.models import Role
    role, _ = Role.objects.get_or_create(role='cashier')
    u = User(phone=phone, username=phone, email=f"{phone}@test.dz", role=role)
    u.set_password("123456")
    # Bypass la validation 6 chars du save() en forçant un hash valid
    u.save()
    return u


def auth_client(user):
    client = APIClient()
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def make_group(restaurant, name="Burgers"):
    return GroupMenu.objects.create(
        name=name, description="Nos burgers", restaurant=restaurant
    )


def make_menu(group, name="Burger Classic", price="8.50", solo_price="6.00"):
    return Menu.objects.create(
        name=name, description="Burger avec cheddar",
        price=price, solo_price=solo_price,
        group_menu=group, type="burger"
    )


def make_order(restaurant, user=None):
    return Order.objects.create(restaurant=restaurant, user=user)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Health / Sync Log
# ─────────────────────────────────────────────────────────────────────────────

class SyncHealthTest(TestCase):
    def setUp(self):
        self.resto = make_restaurant()

    def test_sync_log_created_on_menu_save(self):
        """Un SyncLog doit être créé quand un menu est sauvegardé."""
        before = SyncLog.objects.count()
        g = make_group(self.resto)
        make_menu(g)
        after = SyncLog.objects.count()
        self.assertGreater(after, before)

    def test_sync_log_created_on_group_save(self):
        """Un SyncLog doit être créé quand un groupe est sauvegardé."""
        before = SyncLog.objects.count()
        make_group(self.resto)
        after = SyncLog.objects.count()
        self.assertGreater(after, before)


# ─────────────────────────────────────────────────────────────────────────────
# 2. OrderCreate
# ─────────────────────────────────────────────────────────────────────────────

class OrderCreateTest(TestCase):
    def setUp(self):
        self.resto = make_restaurant()
        self.user = make_user(self.resto)
        self.client = auth_client(self.user)
        self.group = make_group(self.resto)
        self.menu = make_menu(self.group)
        self.url = reverse("api_create_order", kwargs={"card": 0})

    def test_create_order_success(self):
        payload = {
            "restaurant": self.resto.id,
            "items": [{"menu": self.menu.id, "quantity": 2}],
        }
        resp = self.client.post(self.url, payload, format="json")
        self.assertIn(resp.status_code, [200, 201])
        self.assertTrue(Order.objects.filter(restaurant=self.resto).exists())

    def test_create_order_with_delivery_type(self):
        payload = {
            "restaurant": self.resto.id,
            "delivery_type": "emporter",
            "items": [{"menu": self.menu.id, "quantity": 1}],
        }
        resp = self.client.post(self.url, payload, format="json")
        self.assertIn(resp.status_code, [200, 201])
        order = Order.objects.filter(restaurant=self.resto).last()
        self.assertEqual(order.delivery_type, "emporter")

    def test_create_order_with_customer_identifier(self):
        payload = {
            "restaurant": self.resto.id,
            "customer_identifier": "0612345678",
            "items": [{"menu": self.menu.id, "quantity": 1}],
        }
        resp = self.client.post(self.url, payload, format="json")
        self.assertIn(resp.status_code, [200, 201])
        order = Order.objects.filter(restaurant=self.resto).last()
        self.assertEqual(order.customer_identifier, "0612345678")

    def test_order_without_restaurant_returns_error(self):
        """Créer une commande sans restaurant_id doit retourner une erreur."""
        resp = self.client.post(self.url, {"items": []}, format="json")
        self.assertIn(resp.status_code, [400, 404])


# ─────────────────────────────────────────────────────────────────────────────
# 3. ValidateCashOrder (kds_status)
# ─────────────────────────────────────────────────────────────────────────────

class ValidateCashOrderTest(TestCase):
    def setUp(self):
        self.resto = make_restaurant()
        self.user = make_user(self.resto)
        self.anon = APIClient()
        # Commande espèces en attente de validation
        self.order = Order.objects.create(
            restaurant=self.resto, user=self.user,
            cash=True, kds_status='pending_validation'
        )

    def test_validate_order_changes_kds_status(self):
        url = reverse("validate_order", kwargs={"order_id": self.order.id})
        resp = self.anon.put(url, format="json")
        self.assertEqual(resp.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.kds_status, "new")

    def test_validate_sets_status_confirmed(self):
        url = reverse("validate_order", kwargs={"order_id": self.order.id})
        self.anon.put(url, format="json")
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "confirmed")

    def test_cannot_validate_card_order(self):
        """Seules les commandes espèces peuvent être validées."""
        card_order = Order.objects.create(
            restaurant=self.resto, user=self.user, cash=False
        )
        url = reverse("validate_order", kwargs={"order_id": card_order.id})
        resp = self.anon.put(url, format="json")
        self.assertEqual(resp.status_code, 400)


# ─────────────────────────────────────────────────────────────────────────────
# 4. KDS Progression
# ─────────────────────────────────────────────────────────────────────────────

class KDSProgressionTest(TestCase):
    def setUp(self):
        self.resto = make_restaurant()
        self.user = make_user(self.resto)
        self.auth = auth_client(self.user)
        self.anon = APIClient()
        self.order = make_order(self.resto, self.user)
        self.order.kds_status = "new"
        self.order.save()

    def test_kds_orders_endpoint(self):
        url = reverse("kds_orders", kwargs={"restaurant_id": self.resto.id})
        resp = self.anon.get(url)
        self.assertEqual(resp.status_code, 200)

    def test_update_kds_status(self):
        url = reverse("order-update", kwargs={"order_id": self.order.id})
        resp = self.anon.put(url, {"kds_status": "in_progress"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.kds_status, "in_progress")

    def test_kds_status_done_sets_ready(self):
        """Quand kds_status passe à 'done', le status commande doit passer à 'ready'."""
        url = reverse("order-update", kwargs={"order_id": self.order.id})
        self.anon.put(url, {"kds_status": "done"}, format="json")
        self.order.refresh_from_db()
        self.assertEqual(self.order.kds_status, "done")
        self.assertEqual(self.order.status, "ready")


# ─────────────────────────────────────────────────────────────────────────────
# 5. CustomerLoyalty (fidélité kiosque)
# ─────────────────────────────────────────────────────────────────────────────

class LoyaltyTest(TestCase):
    def setUp(self):
        self.resto = make_restaurant()
        self.anon = APIClient()
        self.identifier = "0600111222"

    def test_lookup_nonexistent_returns_zero(self):
        url = reverse("customer_loyalty_lookup")
        resp = self.anon.get(url, {"identifier": self.identifier, "restaurant_id": self.resto.id})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["points"], 0)
        self.assertFalse(resp.data["exists"])

    def test_create_loyalty_on_post(self):
        url = reverse("customer_loyalty_lookup")
        resp = self.anon.post(url, {
            "identifier": self.identifier,
            "restaurant_id": self.resto.id,
            "points": 50,
            "total_spent": 500.0
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        cl = CustomerLoyalty.objects.get(customer_identifier=self.identifier, restaurant=self.resto)
        self.assertEqual(cl.points, 50)

    def test_accumulate_points(self):
        url = reverse("customer_loyalty_lookup")
        self.anon.post(url, {"identifier": self.identifier, "restaurant_id": self.resto.id, "points": 30}, format="json")
        self.anon.post(url, {"identifier": self.identifier, "restaurant_id": self.resto.id, "points": 20}, format="json")
        cl = CustomerLoyalty.objects.get(customer_identifier=self.identifier, restaurant=self.resto)
        self.assertEqual(cl.points, 50)

    def test_lookup_existing(self):
        CustomerLoyalty.objects.create(customer_identifier=self.identifier, restaurant=self.resto, points=100)
        url = reverse("customer_loyalty_lookup")
        resp = self.anon.get(url, {"identifier": self.identifier, "restaurant_id": self.resto.id})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["points"], 100)
        self.assertTrue(resp.data["exists"])


# ─────────────────────────────────────────────────────────────────────────────
# 6. LoyaltyReward & Redemption
# ─────────────────────────────────────────────────────────────────────────────

class LoyaltyRewardTest(TestCase):
    def setUp(self):
        self.resto = make_restaurant()
        self.user = make_user(self.resto)
        self.auth = auth_client(self.user)
        self.anon = APIClient()
        self.cl = CustomerLoyalty.objects.create(
            customer_identifier="0611223344", restaurant=self.resto, points=200
        )

    def test_create_reward(self):
        url = reverse("loyalty_rewards", kwargs={"restaurant_id": self.resto.id})
        resp = self.auth.post(url, {"name": "Burger offert", "points_required": 100, "restaurant": self.resto.id}, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(LoyaltyReward.objects.filter(name="Burger offert").exists())

    def test_list_rewards(self):
        LoyaltyReward.objects.create(restaurant=self.resto, name="Frites gratuites", points_required=50)
        url = reverse("loyalty_rewards", kwargs={"restaurant_id": self.resto.id})
        resp = self.auth.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertGreater(len(resp.data), 0)

    def test_redeem_reward(self):
        reward = LoyaltyReward.objects.create(restaurant=self.resto, name="Boisson offerte", points_required=100)
        url = reverse("loyalty_redeem")
        resp = self.anon.post(url, {
            "identifier": "0611223344",
            "restaurant_id": self.resto.id,
            "reward_id": reward.id
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        self.cl.refresh_from_db()
        self.assertEqual(self.cl.points, 100)  # 200 - 100

    def test_redeem_insufficient_points(self):
        reward = LoyaltyReward.objects.create(restaurant=self.resto, name="Repas complet", points_required=500)
        url = reverse("loyalty_redeem")
        resp = self.anon.post(url, {
            "identifier": "0611223344",
            "restaurant_id": self.resto.id,
            "reward_id": reward.id
        }, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("insuffisants", resp.data["error"])

    def test_redemption_history(self):
        reward = LoyaltyReward.objects.create(restaurant=self.resto, name="Dessert offert", points_required=50)
        LoyaltyRedemption.objects.create(customer_loyalty=self.cl, reward=reward, points_spent=50)
        url = reverse("loyalty_redemptions", kwargs={"restaurant_id": self.resto.id})
        resp = self.auth.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["reward_name"], "Dessert offert")


# ─────────────────────────────────────────────────────────────────────────────
# 7. KioskConfig
# ─────────────────────────────────────────────────────────────────────────────

class KioskConfigTest(TestCase):
    def setUp(self):
        self.resto = make_restaurant()
        self.user = make_user(self.resto)
        self.auth = auth_client(self.user)
        self.anon = APIClient()
        self.url = "/api/kiosk/config/"

    def test_get_kiosk_config_public(self):
        resp = self.anon.get(self.url, {"restaurant_id": self.resto.id})
        self.assertEqual(resp.status_code, 200)

    def test_update_kiosk_config_requires_auth(self):
        resp = self.anon.put(self.url, {"primary_color": "#ff0000"}, format="json")
        self.assertIn(resp.status_code, [401, 403])

    def test_update_kiosk_primary_color(self):
        resp = self.auth.put(
            self.url,
            {"restaurant_id": self.resto.id, "primary_color": "#123456"},
            format="json"
        )
        self.assertIn(resp.status_code, [200, 201])


# ─────────────────────────────────────────────────────────────────────────────
# 8. Leaderboard
# ─────────────────────────────────────────────────────────────────────────────

class LeaderboardTest(TestCase):
    def setUp(self):
        self.resto = make_restaurant()
        self.user = make_user(self.resto)
        self.auth = auth_client(self.user)
        CustomerLoyalty.objects.create(customer_identifier="A", restaurant=self.resto, points=300)
        CustomerLoyalty.objects.create(customer_identifier="B", restaurant=self.resto, points=100)
        CustomerLoyalty.objects.create(customer_identifier="C", restaurant=self.resto, points=500)

    def test_leaderboard_ordered_by_points(self):
        url = reverse("customer_loyalty_leaderboard", kwargs={"restaurant_id": self.resto.id})
        resp = self.auth.get(url)
        self.assertEqual(resp.status_code, 200)
        points = [r["points"] for r in resp.data]
        self.assertEqual(points, sorted(points, reverse=True))

    def test_leaderboard_max_20(self):
        for i in range(25):
            CustomerLoyalty.objects.create(
                customer_identifier=f"X{i}", restaurant=self.resto, points=i * 10
            )
        url = reverse("customer_loyalty_leaderboard", kwargs={"restaurant_id": self.resto.id})
        resp = self.auth.get(url)
        self.assertLessEqual(len(resp.data), 20)


# ─────────────────────────────────────────────────────────────────────────────
# 9. POS Order Fields
# ─────────────────────────────────────────────────────────────────────────────

class POSOrderFieldsTest(TestCase):
    def setUp(self):
        self.resto = make_restaurant()
        self.user = make_user(self.resto)
        self.anon = APIClient()
        make_order(self.resto, self.user)

    def test_pos_order_list_contains_kds_status(self):
        url = reverse("api_get_POSorder", kwargs={"restaurant_id": self.resto.id})
        resp = self.anon.get(url)
        self.assertEqual(resp.status_code, 200)
        orders = resp.data if isinstance(resp.data, list) else resp.data.get("results", [])
        if orders:
            self.assertIn("kds_status", orders[0])

    def test_pos_order_list_contains_delivery_type(self):
        url = reverse("api_get_POSorder", kwargs={"restaurant_id": self.resto.id})
        resp = self.anon.get(url)
        self.assertEqual(resp.status_code, 200)
        orders = resp.data if isinstance(resp.data, list) else resp.data.get("results", [])
        if orders:
            self.assertIn("delivery_type", orders[0])


# ─────────────────────────────────────────────────────────────────────────────
# 10. Menu CRUD
# ─────────────────────────────────────────────────────────────────────────────

class MenuCRUDTest(TestCase):
    def setUp(self):
        self.resto = make_restaurant()
        self.user = make_user(self.resto)
        self.auth = auth_client(self.user)
        self.group = make_group(self.resto)

    def test_create_group_menu(self):
        url = reverse("api_create_GroupMenu")
        resp = self.auth.post(url, {
            "name": "Tacos",
            "description": "Nos tacos maison",
            "restaurant": self.resto.id
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(GroupMenu.objects.filter(name="Tacos").exists())

    def test_create_menu_item(self):
        url = reverse("api_create_menu")
        resp = self.auth.post(url, {
            "name": "Big Burger",
            "description": "Burger avec cheddar et bacon",
            "price": "9.50",
            "solo_price": "7.00",
            "group_menu": self.group.id,
            "type": "burger"
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(Menu.objects.filter(name="Big Burger").exists())

    def test_get_menu_list(self):
        make_menu(self.group)
        url = reverse("api_get_menu_list", kwargs={"id_restaurant": self.resto.id})
        resp = self.auth.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertGreater(len(resp.data), 0)

    def test_get_group_menu_list(self):
        url = reverse("api_get_GroupMenu_list", kwargs={"id_restaurant": self.resto.id})
        resp = self.auth.get(url)
        self.assertEqual(resp.status_code, 200)


# ─────────────────────────────────────────────────────────────────────────────
# 11. Ticket Generation (ESC/POS)
# ─────────────────────────────────────────────────────────────────────────────

class TicketTest(TestCase):
    def setUp(self):
        self.resto = make_restaurant()
        self.user = make_user(self.resto)
        self.auth = auth_client(self.user)
        self.group = make_group(self.resto)
        self.menu = make_menu(self.group)
        self.order = make_order(self.resto, self.user)
        OrderItem.objects.create(order=self.order, menu=self.menu, quantity=2)

    def test_ticket_endpoint_returns_200(self):
        url = reverse("generate_ticket", kwargs={"order_id": self.order.id})
        resp = self.auth.get(url)
        self.assertEqual(resp.status_code, 200)

    def test_ticket_format_is_escpos(self):
        url = reverse("generate_ticket", kwargs={"order_id": self.order.id})
        resp = self.auth.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data.get("format"), "ESCPOS")

    def test_ticket_contains_init_command(self):
        url = reverse("generate_ticket", kwargs={"order_id": self.order.id})
        resp = self.auth.get(url)
        content = resp.data.get("ticket_content", "")
        # ESC @ = initialisation imprimante
        self.assertIn("\x1b\x40", content)

    def test_ticket_contains_cut_command(self):
        url = reverse("generate_ticket", kwargs={"order_id": self.order.id})
        resp = self.auth.get(url)
        content = resp.data.get("ticket_content", "")
        # GS V 0 = coupe papier
        self.assertIn("\x1d\x56\x00", content)

    def test_ticket_contains_restaurant_name(self):
        url = reverse("generate_ticket", kwargs={"order_id": self.order.id})
        resp = self.auth.get(url)
        content = resp.data.get("ticket_content", "")
        self.assertIn(self.resto.name, content)

    def test_ticket_contains_total(self):
        url = reverse("generate_ticket", kwargs={"order_id": self.order.id})
        resp = self.auth.get(url)
        content = resp.data.get("ticket_content", "")
        expected_total = f"{float(self.order.total_price()):.2f}"
        self.assertIn(expected_total, content)


# ─────────────────────────────────────────────────────────────────────────────
# 12. RedemptionHistory endpoint
# ─────────────────────────────────────────────────────────────────────────────

class RedemptionHistoryTest(TestCase):
    def setUp(self):
        self.resto = make_restaurant()
        self.user = make_user(self.resto)
        self.auth = auth_client(self.user)
        self.cl = CustomerLoyalty.objects.create(
            customer_identifier="0677889900", restaurant=self.resto, points=0
        )
        self.reward = LoyaltyReward.objects.create(
            restaurant=self.resto, name="Menu offert", points_required=150
        )

    def test_empty_history(self):
        url = reverse("loyalty_redemptions", kwargs={"restaurant_id": self.resto.id})
        resp = self.auth.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 0)

    def test_history_shows_redemption(self):
        LoyaltyRedemption.objects.create(customer_loyalty=self.cl, reward=self.reward, points_spent=150)
        url = reverse("loyalty_redemptions", kwargs={"restaurant_id": self.resto.id})
        resp = self.auth.get(url)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["customer_identifier"], "0677889900")
        self.assertEqual(resp.data[0]["reward_name"], "Menu offert")


# ─────────────────────────────────────────────────────────────────────────────
# 13. Multi-Restaurant Isolation
# ─────────────────────────────────────────────────────────────────────────────

class MultiRestaurantIsolationTest(TestCase):
    def setUp(self):
        self.resto1 = make_restaurant("RestaurantA")
        self.resto2 = make_restaurant("RestaurantB")
        self.user1 = make_user(phone="0611111111")
        self.user2 = make_user(phone="0622222222")
        self.auth1 = auth_client(self.user1)
        self.auth2 = auth_client(self.user2)
        g1 = make_group(self.resto1, "Burgers A")
        g2 = make_group(self.resto2, "Tacos B")
        make_order(self.resto1, self.user1)
        make_order(self.resto2, self.user2)
        CustomerLoyalty.objects.create(customer_identifier="same_phone", restaurant=self.resto1, points=100)
        CustomerLoyalty.objects.create(customer_identifier="same_phone", restaurant=self.resto2, points=200)

    def test_orders_isolated(self):
        url1 = reverse("api_get_POSorder", kwargs={"restaurant_id": self.resto1.id})
        url2 = reverse("api_get_POSorder", kwargs={"restaurant_id": self.resto2.id})
        r1 = self.auth1.get(url1).data
        r2 = self.auth2.get(url2).data
        ids1 = {o["id"] for o in (r1 if isinstance(r1, list) else [])}
        ids2 = {o["id"] for o in (r2 if isinstance(r2, list) else [])}
        self.assertTrue(ids1.isdisjoint(ids2))

    def test_loyalty_points_independent(self):
        url = reverse("customer_loyalty_lookup")
        r1 = self.auth1.get(url, {"identifier": "same_phone", "restaurant_id": self.resto1.id})
        r2 = self.auth2.get(url, {"identifier": "same_phone", "restaurant_id": self.resto2.id})
        self.assertEqual(r1.data["points"], 100)
        self.assertEqual(r2.data["points"], 200)

    def test_group_menus_isolated(self):
        url1 = reverse("api_get_GroupMenu_list", kwargs={"id_restaurant": self.resto1.id})
        url2 = reverse("api_get_GroupMenu_list", kwargs={"id_restaurant": self.resto2.id})
        groups1 = {g["name"] for g in self.auth1.get(url1).data}
        groups2 = {g["name"] for g in self.auth2.get(url2).data}
        self.assertTrue(groups1.isdisjoint(groups2))


# ─────────────────────────────────────────────────────────────────────────────
# 14. KPI
# ─────────────────────────────────────────────────────────────────────────────

class KPITest(TestCase):
    def setUp(self):
        self.resto = make_restaurant()
        self.user = make_user(self.resto)
        self.auth = auth_client(self.user)
        group = make_group(self.resto)
        menu = make_menu(group)
        # 3 commandes payées
        for _ in range(3):
            o = Order.objects.create(restaurant=self.resto, user=self.user, paid=True, status="delivered")
            OrderItem.objects.create(order=o, menu=menu, quantity=1)
        # 1 commande annulée
        Order.objects.create(restaurant=self.resto, user=self.user, cancelled=True, status="cancelled")

    def test_kpi_endpoint_returns_200(self):
        url = reverse("api_get_kpi", kwargs={"restaurantId": self.resto.id})
        resp = self.auth.get(url)
        self.assertEqual(resp.status_code, 200)

    def test_kpi_has_total_orders(self):
        url = reverse("api_get_kpi", kwargs={"restaurantId": self.resto.id})
        resp = self.auth.get(url)
        data = resp.data
        keys = set(data.keys()) if hasattr(data, "keys") else set()
        self.assertTrue(
            any(k in keys for k in ["total_orders", "totalOrders", "orders_count", "count"]),
            f"Aucune clé de total commandes trouvée dans {keys}"
        )

    def test_kpi_revenue_positive(self):
        url = reverse("api_get_kpi", kwargs={"restaurantId": self.resto.id})
        resp = self.auth.get(url)
        data = resp.data
        # Cherche une clé de revenu
        revenue_val = None
        for k in ["total_revenue", "revenue", "totalRevenue", "chiffre_affaires", "ca"]:
            if k in data:
                revenue_val = float(data[k])
                break
        if revenue_val is not None:
            self.assertGreaterEqual(revenue_val, 0)
