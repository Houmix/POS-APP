"""from django.shortcuts import render,redirect
from django.contrib.auth.forms import UserCreationForm
from ..website.form import CustomUserCreationForm



#from rest_framework import generics
def signUp(request):
    if request.method == 'POST':
        form=CustomUserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('website/login.html')
    else:
        form = CustomUserCreationForm()
    return render(request, 'signup.html',{'form':form})
# Create your views here.

"""

from django.shortcuts import render

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from restaurant.models import Restaurant
from restaurant.serializers import RestaurantSerializer

from rest_framework.permissions import IsAuthenticated
# Create your views here.




class RestaurantCreate(APIView):
    permission_classes = [IsAuthenticated] # Seuls les utilisateurs authentifiés peuvent créer un restaurant7
    def post(self, request, *args, **kwargs):
        # a mettre en place try :
        serializer = RestaurantSerializer(data=request.data) #creation de l'objet
        print()
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Restaurant créé avec succès", "data": serializer.data}, status=status.HTTP_201_CREATED)
        return Response({"message": "Erreur dans la création du restaurant", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

class RestaurantDetail(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, pk, *args, **kwargs):
        try:
            restaurant = Restaurant.objects.get(pk=pk)
            print(restaurant)
        except Restaurant.DoesNotExist:
            return Response({"error": "Restaurant non trouvé"}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = RestaurantSerializer(restaurant)

        return Response(serializer.data, status=status.HTTP_200_OK)
    
class RestaurantList(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, *args, **kwargs):
        list_restaurant = Restaurant.objects.all()
        print(list_restaurant)
        
        serializer = RestaurantSerializer(list_restaurant, many=True)

        return Response(serializer.data, status=status.HTTP_200_OK)
    

class RestaurantUpdate(APIView):
    permission_classes = [IsAuthenticated]
    def put(self, request, pk, *args, **kwargs):
        try:
            restaurant = Restaurant.objects.get(pk=pk)
        except Restaurant.DoesNotExist:
            return Response({"error": "Restaurant non trouvé"}, status=status.HTTP_404_NOT_FOUND)

        serializer = RestaurantSerializer(restaurant, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Restaurant mis à jour", "data": serializer.data}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class RestaurantDelete(APIView):
    permission_classes = [IsAuthenticated]
    def delete(self, request, pk, *args, **kwargs):
        try:
            restaurant = Restaurant.objects.get(pk=pk)
        except Restaurant.DoesNotExist:
            return Response({"error": "Restaurant non trouvé"}, status=status.HTTP_404_NOT_FOUND)

        restaurant.delete()
        return Response({"message": "Restaurant supprimé avec succès"}, status=status.HTTP_204_NO_CONTENT)


