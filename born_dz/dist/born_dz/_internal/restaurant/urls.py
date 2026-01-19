# restaurant/urls.py
from django.urls import path
from .views import (
    MyRestaurantView,
    MyRestaurantSimpleView,
    RestaurantDetailView,
    RestaurantListView,
    RestaurantCreateView,
    RestaurantUpdateView,
    RestaurantDeleteView,
    RestaurantStatsView
)

urlpatterns = [
    # ============= ENDPOINT PRINCIPAL AVEC ID DANS L'URL =============
    # Récupérer le restaurant par ID dans l'URL
    path('api/my-restaurant/<int:id>/', MyRestaurantView.as_view(), name='my_restaurant'),
    
    # Version simple sans authentification (pour tests)
    path('api/my-restaurant-simple/<int:id>/', MyRestaurantSimpleView.as_view(), name='my_restaurant_simple'),
    
    # ============= CRUD COMPLET =============
    # Liste de tous les restaurants
    path('api/restaurants/', RestaurantListView.as_view(), name='restaurant_list'),
    
    # Détail d'un restaurant spécifique
    path('api/restaurant/<int:pk>/', RestaurantDetailView.as_view(), name='restaurant_detail'),
    
    # Créer un nouveau restaurant
    path('api/restaurant/create/', RestaurantCreateView.as_view(), name='restaurant_create'),
    
    # Mettre à jour un restaurant (envoyer l'ID dans le body)
    path('api/restaurant/update/', RestaurantUpdateView.as_view(), name='restaurant_update'),
    
    # Supprimer un restaurant
    path('api/restaurant/delete/<int:pk>/', RestaurantDeleteView.as_view(), name='restaurant_delete'),
    
    # Statistiques d'un restaurant
    path('api/restaurant/<int:pk>/stats/', RestaurantStatsView.as_view(), name='restaurant_stats'),
]


# ============= DOCUMENTATION DES ENDPOINTS =============

"""
ENDPOINTS DISPONIBLES (MISE À JOUR):

1. GET /restaurant/api/my-restaurant/<id>/
   Description: Récupère le restaurant par son ID dans l'URL
   Authentication: Requise
   Exemple: GET /restaurant/api/my-restaurant/1/
   Response: Objet Restaurant avec détails complets

2. GET /restaurant/api/my-restaurant-simple/<id>/
   Description: Version simple pour récupérer un restaurant par ID (sans auth)
   Authentication: Non requise (pour tests uniquement)
   Exemple: GET /restaurant/api/my-restaurant-simple/1/
   Response: Objet Restaurant

3. GET /restaurant/api/restaurants/
   Description: Liste tous les restaurants
   Authentication: Requise
   Query params: ?chain_id=1 (optionnel, pour filtrer par chaîne)
   Response: Liste de restaurants

4. GET /restaurant/api/restaurant/<id>/
   Description: Détails d'un restaurant spécifique
   Authentication: Requise
   Exemple: GET /restaurant/api/restaurant/1/
   Response: Objet Restaurant

5. POST /restaurant/api/restaurant/create/
   Description: Créer un nouveau restaurant
   Authentication: Requise
   Body: {
       "name": "Mon Restaurant",
       "address": "123 Rue Example",
       "phone": "+33123456789",
       "immat": "ABC123",
       "chain": 1  (optionnel)
   }
   Response: Restaurant créé

6. PUT /restaurant/api/restaurant/update/
   Description: Mettre à jour un restaurant
   Authentication: Requise
   Body: {
       "id": 1,
       "name": "Nouveau nom",
       ...autres champs à modifier
   }
   Response: Restaurant mis à jour

7. DELETE /restaurant/api/restaurant/delete/<id>/
   Description: Supprimer un restaurant
   Authentication: Requise
   Exemple: DELETE /restaurant/api/restaurant/delete/1/
   Response: Message de confirmation

8. GET /restaurant/api/restaurant/<id>/stats/
   Description: Statistiques d'un restaurant
   Authentication: Requise
   Exemple: GET /restaurant/api/restaurant/1/stats/
   Response: Objet avec statistiques

CHANGEMENT IMPORTANT:
L'ID est maintenant passé directement dans l'URL au lieu d'un query parameter.

AVANT: GET /restaurant/api/my-restaurant/?restaurant_id=1
MAINTENANT: GET /restaurant/api/my-restaurant/1/

UTILISATION DANS REACT NATIVE:
const resId = await AsyncStorage.getItem("Employee_restaurant_id");
const response = await axios.get(
    `${POS_URL}/restaurant/api/my-restaurant/${resId}/`,
    { headers: { Authorization: `Bearer ${token}` } }
);
"""