from decimal import Decimal
from django.shortcuts import render

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authentication import TokenAuthentication
from django.shortcuts import get_object_or_404
from restaurant.models import Restaurant
from django.contrib.auth import get_user_model

from .models import Loyalty, CustomerLoyalty, LoyaltyReward, LoyaltyRedemption
from .serializers import (
    LoyaltySerializer, CustomerLoyaltySerializer,
    LoyaltyRewardSerializer, LoyaltyRedemptionSerializer
)

User = get_user_model()




class LoyaltyPOST(APIView):
    permission_classes = [IsAuthenticated]  # Seuls les utilisateurs authentifiés peuvent créer un restaurant

    def post(self, request, *args, **kwargs):
        user_id = request.data.get("user")
        restaurant_id = request.data.get("restaurant")
        new_points = int(request.data.get("point", 0))  # Points envoyés, par défaut 0

        if not user_id or not restaurant_id:
            return Response(
                {"error": "Les champs 'user' et 'restaurant' sont obligatoires."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Récupérer les objets User et Restaurant, ou renvoyer une erreur 404
        user = get_object_or_404(User, id=user_id)
        restaurant = get_object_or_404(Restaurant, id=restaurant_id)

        # Vérifier si une relation Loyalty existe déjà sinon la créer
        loyalty, created = Loyalty.objects.get_or_create(user=user, restaurant=restaurant, defaults={"point": new_points})

        if not created:  # Si la relation existait déjà, on ajoute les points
            loyalty.point += new_points
            loyalty.save()

        # Sérialisation et retour de la réponse
        serializer = LoyaltySerializer(loyalty)
        return Response(
            {
                "message": "Points mis à jour" if not created else "Points de fidélité créés avec succès",
                "data": serializer.data
            },
            status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED
        )

    
class LoyaltyGET(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, user_id, restaurant_id, *args, **kwargs):
        try:
            loyalty = Loyalty.objects.get(user = user_id, restaurant = restaurant_id)
        except Loyalty.DoesNotExist:
            return Response({"error": "Point de fidélité non trouvé"}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = LoyaltySerializer(loyalty)

        return Response(serializer.data, status=status.HTTP_200_OK)

class LoyaltyUPDATE(APIView):#Update only the points of a customer
    permission_classes = [IsAuthenticated]

    def put(self, request, *args, **kwargs):
        try:
            user_id = request.data.get("user")
            restaurant_id = request.data.get("restaurant")
            loyalty = Loyalty.objects.get(user=user_id, restaurant = restaurant_id)
        except Loyalty.DoesNotExist:
            return Response({"error": "Point de fidélité non trouvé"}, status=status.HTTP_404_NOT_FOUND)

        # Définir les points et non ajouter les nouveaux points aux points existants
        new_points = request.data.get("point", 0)
        loyalty.point = int(new_points)
        loyalty.save()

        # Sérialiser et renvoyer la réponse
        serializer = LoyaltySerializer(loyalty)
        return Response({"message": "Point de fidélité mis à jour", "data": serializer.data}, status=status.HTTP_200_OK)

class LoyaltyDelete(APIView):
    permission_classes = [IsAuthenticated]
    
    def delete(self, request, pk, *args, **kwargs):
        try:
            loyalty = Loyalty.objects.get(pk=pk)
        except Loyalty.DoesNotExist:
            return Response({"error": "Fidélité non trouvée"}, status=status.HTTP_404_NOT_FOUND)
        
        loyalty.delete()
        return Response({"message": "Fidélité supprimée avec succès"}, status=status.HTTP_204_NO_CONTENT)
    

class LoyaltyDelete2(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, user_id, restaurant_id, *args, **kwargs):
        try:
            loyalty = Loyalty.objects.get(user=user_id, restaurant = restaurant_id)
        except Loyalty.DoesNotExist:
            return Response({"error": "Fidélité non trouvée"}, status=status.HTTP_404_NOT_FOUND)

        loyalty.delete()
        return Response({"message": "Fidélité supprimée avec succès"}, status=status.HTTP_204_NO_CONTENT)


# ── CustomerLoyalty (borne kiosque, sans compte utilisateur) ─────────────────

class CustomerLoyaltyLookup(APIView):
    """GET/POST fidélité par numéro de téléphone. Crée le profil s'il n'existe pas."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        identifier = request.query_params.get('identifier')
        restaurant_id = request.query_params.get('restaurant_id')
        if not identifier or not restaurant_id:
            return Response({"error": "identifier et restaurant_id requis"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            cl = CustomerLoyalty.objects.get(customer_identifier=identifier, restaurant_id=restaurant_id)
        except CustomerLoyalty.DoesNotExist:
            return Response({"points": 0, "exists": False}, status=status.HTTP_200_OK)
        return Response({**CustomerLoyaltySerializer(cl).data, "exists": True}, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        identifier = request.data.get('identifier')
        restaurant_id = request.data.get('restaurant_id')
        points_to_add = int(request.data.get('points', 0))
        amount_spent = float(request.data.get('total_spent', 0))

        if not identifier or not restaurant_id:
            return Response({"error": "identifier et restaurant_id requis"}, status=status.HTTP_400_BAD_REQUEST)

        restaurant = get_object_or_404(Restaurant, id=restaurant_id)
        cl, created = CustomerLoyalty.objects.get_or_create(
            customer_identifier=identifier,
            restaurant=restaurant,
            defaults={"points": points_to_add, "total_spent": amount_spent, "visit_count": 1}
        )
        if not created:
            cl.points += points_to_add
            cl.total_spent += Decimal(str(amount_spent))
            cl.visit_count += 1
            cl.save()

        return Response(CustomerLoyaltySerializer(cl).data, status=status.HTTP_200_OK)


class CustomerLoyaltyLeaderboard(APIView):
    """Top clients par points pour un restaurant."""
    permission_classes = [IsAuthenticated]

    def get(self, request, restaurant_id, *args, **kwargs):
        qs = (CustomerLoyalty.objects
              .filter(restaurant_id=restaurant_id)
              .order_by('-points')[:20])
        return Response(CustomerLoyaltySerializer(qs, many=True).data)


# ── LoyaltyReward ────────────────────────────────────────────────────────────

class LoyaltyRewardListCreate(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, restaurant_id, *args, **kwargs):
        rewards = LoyaltyReward.objects.filter(restaurant_id=restaurant_id, is_active=True).select_related('menu', 'option')
        return Response(LoyaltyRewardSerializer(rewards, many=True, context={'request': request}).data)

    def post(self, request, restaurant_id, *args, **kwargs):
        restaurant = get_object_or_404(Restaurant, id=restaurant_id)
        data = {**request.data, 'restaurant': restaurant.id}
        serializer = LoyaltyRewardSerializer(data=data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoyaltyRewardDetail(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, pk, *args, **kwargs):
        reward = get_object_or_404(LoyaltyReward, pk=pk)
        serializer = LoyaltyRewardSerializer(reward, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk, *args, **kwargs):
        get_object_or_404(LoyaltyReward, pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RewardCatalog(APIView):
    """Retourne les menus et options du restaurant pour le formulaire de création de récompense."""
    permission_classes = [IsAuthenticated]

    def get(self, request, restaurant_id, *args, **kwargs):
        from menu.models import Menu, Option, GroupMenu
        menus = Menu.objects.filter(group_menu__restaurant_id=restaurant_id, is_available=True).select_related('group_menu')
        options = Option.objects.filter(
            option__step__restaurant_id=restaurant_id
        ).distinct()

        def menu_photo_url(m):
            if not m.photo:
                return None
            url = m.photo.url if hasattr(m.photo, 'url') else str(m.photo)
            if url.startswith('http'):
                return url
            return request.build_absolute_uri(url)

        menus_data = [
            {
                'id': m.id,
                'name': m.name,
                'price': float(m.price),
                'category': m.group_menu.name,
                'image_url': menu_photo_url(m),
            }
            for m in menus
        ]
        options_data = [
            {
                'id': o.id,
                'name': o.name,
                'extra_price': float(o.extra_price) if hasattr(o, 'extra_price') else 0,
            }
            for o in options
        ]
        return Response({'menus': menus_data, 'options': options_data})


# ── Redemption ───────────────────────────────────────────────────────────────

class RedeemReward(APIView):
    """Échange des points contre une récompense."""
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        identifier = request.data.get('identifier')
        restaurant_id = request.data.get('restaurant_id')
        reward_id = request.data.get('reward_id')

        if not identifier or not restaurant_id or not reward_id:
            return Response({"error": "identifier, restaurant_id et reward_id requis"}, status=status.HTTP_400_BAD_REQUEST)

        cl = get_object_or_404(CustomerLoyalty, customer_identifier=identifier, restaurant_id=restaurant_id)
        reward = get_object_or_404(LoyaltyReward, pk=reward_id, restaurant_id=restaurant_id, is_active=True)

        if cl.points < reward.points_required:
            return Response({"error": "Points insuffisants", "points": cl.points, "required": reward.points_required}, status=status.HTTP_400_BAD_REQUEST)

        cl.points -= reward.points_required
        cl.save()
        redemption = LoyaltyRedemption.objects.create(customer_loyalty=cl, reward=reward, points_spent=reward.points_required)
        return Response({
            "message": f"Récompense '{reward.name}' échangée avec succès",
            "points_remaining": cl.points,
            "redemption_id": redemption.id
        })


class RedemptionHistory(APIView):
    """Historique des échanges pour un restaurant."""
    permission_classes = [IsAuthenticated]

    def get(self, request, restaurant_id, *args, **kwargs):
        redemptions = (LoyaltyRedemption.objects
                       .filter(customer_loyalty__restaurant_id=restaurant_id)
                       .select_related('customer_loyalty', 'reward')
                       .order_by('-created_at')[:100])
        data = [{
            "id": r.id,
            "customer_identifier": r.customer_loyalty.customer_identifier,
            "reward_name": r.reward.name,
            "points_spent": r.points_spent,
            "created_at": r.created_at.isoformat()
        } for r in redemptions]
        return Response(data)