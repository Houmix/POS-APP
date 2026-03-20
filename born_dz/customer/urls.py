"""
URL configuration for born_dz project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from .views import *
from django.urls import path, include

# customer/information
urlpatterns = [
    # ── Loyalty employé (lié à un compte User) ───────────────────────────────
    path("api/createLoyalty/", LoyaltyPOST.as_view(), name="api_create_loyalty"),
    path("api/getLoyalty/user_id:<int:user_id>restaurant_id:<int:restaurant_id>", LoyaltyGET.as_view(), name="api_get_loyalty"),
    path("api/updateLoyalty/", LoyaltyUPDATE.as_view(), name="api_update_loyalty"),
    path("api/deleteLoyalty/<int:pk>", LoyaltyDelete.as_view(), name="api_delete_loyalty"),
    path("api/deleteLoyalty/user_id:<int:user_id>restaurant_id:<int:restaurant_id>", LoyaltyDelete2.as_view(), name="api_delete_loyalty2"),

    # ── CustomerLoyalty kiosque (identifié par téléphone) ────────────────────
    path("api/loyalty/lookup/", CustomerLoyaltyLookup.as_view(), name="customer_loyalty_lookup"),
    path("api/loyalty/leaderboard/<int:restaurant_id>/", CustomerLoyaltyLeaderboard.as_view(), name="customer_loyalty_leaderboard"),

    # ── Récompenses ──────────────────────────────────────────────────────────
    path("api/loyalty/rewards/<int:restaurant_id>/", LoyaltyRewardListCreate.as_view(), name="loyalty_rewards"),
    path("api/loyalty/rewards/detail/<int:pk>/", LoyaltyRewardDetail.as_view(), name="loyalty_reward_detail"),

    # ── Échange & historique ─────────────────────────────────────────────────
    path("api/loyalty/redeem/", RedeemReward.as_view(), name="loyalty_redeem"),
    path("api/loyalty/redemptions/<int:restaurant_id>/", RedemptionHistory.as_view(), name="loyalty_redemptions"),
]
