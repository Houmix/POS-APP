
from django.contrib import admin
from django.urls import path, include
from .views import RestaurantCreate, RestaurantList, RestaurantDetail

from rest_framework_simplejwt import views as jwt_views


urlpatterns = [
    #path("api/create/",RestaurantCreate.as_view(), name="api_create_restaurant"),
    #path("api/get/",RestaurantList.as_view(), name="api_get_list_restaurant"),
    #path("api/get/<int:pk>/",RestaurantDetail.as_view(), name="api_get_restaurant_detail"),
]