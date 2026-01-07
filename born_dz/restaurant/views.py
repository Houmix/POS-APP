# restaurant/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import Restaurant
from .serializers import RestaurantSerializer, RestaurantCreateUpdateSerializer


class MyRestaurantView(APIView):
    """
    Vue pour récupérer le restaurant par son ID passé en URL
    Endpoint: GET /restaurant/api/my-restaurant/<int:id>/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, id, *args, **kwargs):
        """
        Retourne les informations du restaurant basé sur l'ID dans l'URL
        """
        try:
            # On utilise directement l'id passé en argument
            restaurant = get_object_or_404(Restaurant, id=id)
            print(f"✅ Restaurant ID récupéré via URL: {restaurant.id} - {restaurant.name}")
            
            serializer = RestaurantSerializer(restaurant, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Restaurant.DoesNotExist:
            return Response(
                {"error": "Restaurant non trouvé"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            print(f"❌ Erreur dans MyRestaurantView: {str(e)}")
            return Response(
                {"error": f"Erreur lors de la récupération du restaurant: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class MyRestaurantSimpleView(APIView):
    """
    Version simplifiée sans authentification (pour les tests)
    Endpoint: GET /restaurant/api/my-restaurant-simple/<int:id>/
    """
    authentication_classes = []
    permission_classes = []
    
    def get(self, request, id, *args, **kwargs):
        """
        Retourne un restaurant basé sur l'ID passé en URL (sans authentification)
        """
        try:
            restaurant = get_object_or_404(Restaurant, id=id)
            print(f"✅ Restaurant récupéré (sans auth): {restaurant.id} - {restaurant.name}")
            
            serializer = RestaurantSerializer(restaurant, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Restaurant.DoesNotExist:
            return Response(
                {"error": "Restaurant non trouvé"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": f"Erreur: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RestaurantDetailView(APIView):
    """
    Vue pour récupérer les détails d'un restaurant spécifique
    Endpoint: GET /restaurant/api/restaurant/<int:pk>/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk, *args, **kwargs):
        """Récupère un restaurant par son ID"""
        try:
            restaurant = get_object_or_404(Restaurant, pk=pk)
            serializer = RestaurantSerializer(restaurant, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Restaurant.DoesNotExist:
            return Response(
                {"error": "Restaurant non trouvé"},
                status=status.HTTP_404_NOT_FOUND
            )


class RestaurantListView(APIView):
    """
    Vue pour lister tous les restaurants
    Endpoint: GET /restaurant/api/restaurants/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, *args, **kwargs):
        """Liste tous les restaurants"""
        try:
            # Filtrer par chaîne si spécifié
            chain_id = request.GET.get('chain_id')
            if chain_id:
                restaurants = Restaurant.objects.filter(chain_id=chain_id)
            else:
                restaurants = Restaurant.objects.all()
            
            # Ordonner par date de création (plus récent en premier)
            restaurants = restaurants.order_by('-created_at')
            
            serializer = RestaurantSerializer(restaurants, many=True, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"error": f"Erreur lors de la récupération des restaurants: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RestaurantCreateView(APIView):
    """
    Vue pour créer un nouveau restaurant
    Endpoint: POST /restaurant/api/restaurant/create/
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        """Crée un nouveau restaurant"""
        try:
            serializer = RestaurantCreateUpdateSerializer(data=request.data)
            
            if serializer.is_valid():
                restaurant = serializer.save()
                print(f"✅ Restaurant créé: {restaurant.id} - {restaurant.name}")
                
                # Retourner le restaurant créé avec toutes ses infos
                response_serializer = RestaurantSerializer(restaurant, context={'request': request})
                return Response(
                    {
                        "message": "Restaurant créé avec succès",
                        "data": response_serializer.data
                    },
                    status=status.HTTP_201_CREATED
                )
            
            return Response(
                {
                    "message": "Erreur de validation",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )
            
        except Exception as e:
            print(f"❌ Erreur création restaurant: {str(e)}")
            return Response(
                {"error": f"Erreur lors de la création du restaurant: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RestaurantUpdateView(APIView):
    """
    Vue pour mettre à jour un restaurant
    Endpoint: PUT /restaurant/api/restaurant/update/
    Payload doit contenir l'ID du restaurant à modifier
    """
    permission_classes = [IsAuthenticated]
    
    def put(self, request, *args, **kwargs):
        """Met à jour un restaurant"""
        try:
            restaurant_id = request.data.get('id')
            
            if not restaurant_id:
                return Response(
                    {"error": "L'ID du restaurant est requis"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            restaurant = get_object_or_404(Restaurant, id=restaurant_id)
            
            # Utiliser partial=True pour permettre les mises à jour partielles
            serializer = RestaurantCreateUpdateSerializer(
                restaurant, 
                data=request.data, 
                partial=True
            )
            
            if serializer.is_valid():
                updated_restaurant = serializer.save()
                print(f"✅ Restaurant mis à jour: {updated_restaurant.id} - {updated_restaurant.name}")
                
                # Retourner le restaurant mis à jour avec toutes ses infos
                response_serializer = RestaurantSerializer(
                    updated_restaurant, 
                    context={'request': request}
                )
                return Response(
                    {
                        "message": "Restaurant mis à jour avec succès",
                        "data": response_serializer.data
                    },
                    status=status.HTTP_200_OK
                )
            
            return Response(
                {
                    "message": "Erreur de validation",
                    "errors": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )
            
        except Restaurant.DoesNotExist:
            return Response(
                {"error": "Restaurant non trouvé"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            print(f"❌ Erreur mise à jour restaurant: {str(e)}")
            return Response(
                {"error": f"Erreur lors de la mise à jour: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RestaurantDeleteView(APIView):
    """
    Vue pour supprimer un restaurant
    Endpoint: DELETE /restaurant/api/restaurant/delete/<int:pk>/
    """
    permission_classes = [IsAuthenticated]
    
    def delete(self, request, pk, *args, **kwargs):
        """Supprime un restaurant"""
        try:
            restaurant = get_object_or_404(Restaurant, pk=pk)
            restaurant_name = restaurant.name
            restaurant.delete()
            print(f"✅ Restaurant supprimé: {restaurant_name}")
            
            return Response(
                {"message": f"Restaurant '{restaurant_name}' supprimé avec succès"},
                status=status.HTTP_200_OK
            )
            
        except Restaurant.DoesNotExist:
            return Response(
                {"error": "Restaurant non trouvé"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            print(f"❌ Erreur suppression restaurant: {str(e)}")
            return Response(
                {"error": f"Erreur lors de la suppression: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RestaurantStatsView(APIView):
    """
    Vue pour obtenir des statistiques sur un restaurant
    Endpoint: GET /restaurant/api/restaurant/<int:pk>/stats/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk, *args, **kwargs):
        """Retourne les statistiques d'un restaurant"""
        try:
            restaurant = get_object_or_404(Restaurant, pk=pk)
            
            # Récupérer les statistiques (adaptez selon vos modèles)
            stats = {
                'restaurant_id': restaurant.id,
                'restaurant_name': restaurant.name,
                'total_menu_groups': restaurant.groupmenus.count() if hasattr(restaurant, 'groupmenus') else 0,
                'active_menu_groups': restaurant.groupmenus.filter(avalaible=True).count() if hasattr(restaurant, 'groupmenus') else 0,
                'total_menus': sum(
                    group.menus.count() 
                    for group in restaurant.groupmenus.all()
                ) if hasattr(restaurant, 'groupmenus') else 0,
                'created_at': restaurant.created_at,
                'has_chain': restaurant.chain is not None,
                'chain_name': restaurant.chain.name if restaurant.chain else None,
            }
            
            print(f"✅ Statistiques récupérées pour: {restaurant.name}")
            return Response(stats, status=status.HTTP_200_OK)
            
        except Restaurant.DoesNotExist:
            return Response(
                {"error": "Restaurant non trouvé"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            print(f"❌ Erreur stats restaurant: {str(e)}")
            return Response(
                {"error": f"Erreur lors de la récupération des statistiques: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )