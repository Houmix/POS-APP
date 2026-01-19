from django.shortcuts import render

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Loyalty
from .serializers import LoyaltySerializer

from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from restaurant.models import Restaurant
from django.contrib.auth import get_user_model
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