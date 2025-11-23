from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import GroupMenuSerializer, MenuSerializer, OptionSerializer, StepOptionSerializer, StepSerializer
from .models import GroupMenu, Menu, Option, Step, StepOption
from rest_framework.permissions import IsAuthenticated
from django.db import models



# borne_sync/views.py
from rest_framework.decorators import api_view
from rest_framework.response import Response
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from datetime import datetime
from borne_sync.consumers import SYNC_GROUP_NAME # Importez le nom du groupe


# Create your views here.
class GroupMenuCreate(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        try:
            serializer = GroupMenuSerializer(data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response({"message": "GroupMenu créé avec succès", "data": serializer.data}, status=status.HTTP_201_CREATED)
            return Response({"message": "Erreur de validation", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class GroupMenuDetail(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk, *args, **kwargs):
        try:
            group_menu = GroupMenu.objects.get(id=pk)
        except GroupMenu.DoesNotExist:
            return Response({"error": "GroupMenu non trouvé"}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = GroupMenuSerializer(group_menu)
        return Response(serializer.data, status=status.HTTP_200_OK)

class GroupMenuList(APIView):
    authentication_classes = []
    permission_classes = []
    
    def get(self, request,id_restaurant, *args, **kwargs):
        print("apellééééééééééééé")
        group_menus = GroupMenu.objects.filter(restaurant=id_restaurant)
        serializer = GroupMenuSerializer(group_menus, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class GroupMenuUpdate(APIView):
    permission_classes = []
    authentication_classes = []
    
    def put(self, request, *args, **kwargs):
        try:
            print("Données de la requête:", request.data)  # Log des données de la requête
            group_menu_id = request.data.get("id")
            group_menu = GroupMenu.objects.get(id=group_menu_id)
        except GroupMenu.DoesNotExist:
            return Response({"error": "GroupMenu non trouvé"}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = GroupMenuSerializer(group_menu, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            # Obtient le channel layer
            channel_layer = get_channel_layer()
            # Prépare les données à envoyer
            message_data = {
                'type': 'menu_update', # Type de l'événement (utilisé côté front)
                'status': 'full_sync_required',
                'timestamp': datetime.now().isoformat()
            }
            
            # Envoi du message au groupe de bornes
            async_to_sync(channel_layer.group_send)(
                SYNC_GROUP_NAME, # Le groupe
                {
                    'type': 'sync.message', # Nom de la méthode dans le Consumer (sync_message)
                    'data': message_data
                }
            )
            return Response({"message": "GroupMenu mis à jour", "data": serializer.data}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class GroupMenuDelete(APIView):
    permission_classes = [IsAuthenticated]
    
    def delete(self, request, pk, *args, **kwargs):
        try:
            group_menu = GroupMenu.objects.get(pk=pk)
        except GroupMenu.DoesNotExist:
            return Response({"error": "GroupMenu non trouvé"}, status=status.HTTP_404_NOT_FOUND)
        
        group_menu.delete()
        return Response({"message": "GroupMenu supprimé avec succès"}, status=status.HTTP_204_NO_CONTENT)




class MenuCreate(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        try:
            serializer = MenuSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save()
                return Response({"message": "Menu créé avec succès", "data": serializer.data}, status=status.HTTP_201_CREATED)
            return Response({"message": "Erreur de validation", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class MenuDetail(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, restaurant, *args, **kwargs):
        try:
            menu = Menu.objects.filter(restaurant=restaurant)
        except Menu.DoesNotExist:
            return Response({"error": "Menu non trouvé"}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = MenuSerializer(menu)
        return Response(serializer.data, status=status.HTTP_200_OK)

class MenuList(APIView):
    permission_classes = []
    authentication_classes = []
    
    def get(self, request,id_restaurant,*args, **kwargs):
        menus = Menu.objects.filter(group_menu__restaurant__id=id_restaurant)
        serializer = MenuSerializer(menus, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class MenuUpdate(APIView):
    permission_classes = []
    authentication_classes = []
    
    def put(self, request, *args, **kwargs):
        try:
            print("Données de la requête:", request.data)  # Log des données de la requête
            menu_id = request.data.get("id")
            menu = Menu.objects.get(id=menu_id)
        except Menu.DoesNotExist:
            return Response({"error": "Menu non trouvé"}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = MenuSerializer(menu, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            # Obtient le channel layer
            channel_layer = get_channel_layer()
            # Prépare les données à envoyer
            message_data = {
                'type': 'menu_update', # Type de l'événement (utilisé côté front)
                'status': 'full_sync_required',
                'timestamp': datetime.now().isoformat()
            }
            
            # Envoi du message au groupe de bornes
            async_to_sync(channel_layer.group_send)(
                SYNC_GROUP_NAME, # Le groupe
                {
                    'type': 'sync.message', # Nom de la méthode dans le Consumer (sync_message)
                    'data': message_data
                }
            )
            return Response({"message": "Menu mis à jour", "data": serializer.data}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class MenuDelete(APIView):
    permission_classes = [IsAuthenticated]
    
    def delete(self, request, pk, *args, **kwargs):
        try:
            menu = Menu.objects.get(pk=pk)
        except Menu.DoesNotExist:
            return Response({"error": "Menu non trouvé"}, status=status.HTTP_404_NOT_FOUND)
        
        menu.delete()
        return Response({"message": "Menu supprimé avec succès"}, status=status.HTTP_204_NO_CONTENT)







class OptionCreate(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        serializer = OptionSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Option créée avec succès", "data": serializer.data}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class OptionDetail(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk, *args, **kwargs):
        try:
            option = Option.objects.get(id=pk)
        except Option.DoesNotExist:
            return Response({"error": "Option non trouvée"}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = OptionSerializer(option)
        return Response(serializer.data, status=status.HTTP_200_OK)

class OptionList(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, *args, **kwargs):
        options = Option.objects.all()
        serializer = OptionSerializer(options, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class OptionUpdate(APIView):
    permission_classes = [IsAuthenticated]
    def put(self, request, *args, **kwargs):
        try:
            option_id = request.data.get("id")
            option = Option.objects.get(id=option_id)
        except Option.DoesNotExist:
            return Response({"error": "Option non trouvé"}, status=status.HTTP_404_NOT_FOUND)

        serializer = OptionSerializer(option, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Option mis à jour", "data": serializer.data}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class OptionDelete(APIView):
    permission_classes = [IsAuthenticated]
    
    def delete(self, request, pk, *args, **kwargs):
        try:
            option = Option.objects.get(pk=pk)
        except Option.DoesNotExist:
            return Response({"error": "Option non trouvée"}, status=status.HTTP_404_NOT_FOUND)
        
        option.delete()
        return Response({"message": "Option supprimée avec succès"}, status=status.HTTP_204_NO_CONTENT)



class StepCreate(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        serializer = StepSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Étape créée avec succès", "data": serializer.data}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class StepListByMenu(APIView):
    permission_classes = []
    authentication_classes = []

    def get(self, request, menu_id, *args, **kwargs):
        steps = Step.objects.filter(menu_id=menu_id).order_by('number').prefetch_related(
            models.Prefetch(
                'stepoptions',
                queryset=StepOption.objects.filter(avalaible=True).select_related('option'),
            )
        )

        print(f"Étapes récupérées pour menu_id={menu_id}: {steps}")  # Log des étapes récupérées

        
        serializer = StepSerializer(steps, many=True)
        return Response(serializer.data)

class StepList(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, *args, **kwargs):
        steps = Step.objects.all()
        serializer = StepSerializer(steps, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class StepDetail(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, menu_id, *args, **kwargs):
        try :
            steps = Step.objects.filter(menu__id=menu_id).prefetch_related('options').order_by('number')
            serializer = StepSerializer(steps, many=True)
        except Step.DoesNotExist:
            return Response({"error": "Étape non trouvée"}, status=status.HTTP_404_NOT_FOUND)
        serializer = StepSerializer(steps)
        return Response(serializer.data, status=status.HTTP_200_OK)

class StepUpdate(APIView):
    permission_classes = [IsAuthenticated]
    
    def put(self, request, *args, **kwargs):
        try:
            step_id = request.data.get("id")
            step = Step.objects.get(id=step_id)
        except Step.DoesNotExist:
            return Response({"error": "Etape non trouvé"}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = StepSerializer(step, data=request.data, partial=True) #Partial = True --> Pas besoins de mettre tous les champs du seriaizer
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Etape mis à jour", "data": serializer.data}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
class StepDelete(APIView):
    permission_classes = [IsAuthenticated]
    
    def delete(self, request, pk, *args, **kwargs):
        try:
            step = Step.objects.get(pk=pk)
        except Step.DoesNotExist:
            return Response({"error": "Étape non trouvée"}, status=status.HTTP_404_NOT_FOUND)
        
        step.delete()
        return Response({"message": "Étape supprimée avec succès"}, status=status.HTTP_204_NO_CONTENT)



class StepOptionList(APIView):
    permission_classes = []
    authentication_classes = []

    def get(self, request, *args, **kwargs):
        step_options = StepOption.objects.select_related('option').all()
        data = [
            {
                "id": step_option.id,
                "step": step_option.step_id,
                "name": step_option.option.name if step_option.option else None,
                "avalaible": step_option.avalaible,
            }
            for step_option in step_options
        ]
        return Response(data, status=status.HTTP_200_OK)
class StepOptionUpdate(APIView):
    permission_classes = []
    authentication_classes = []

    def put(self, request, *args, **kwargs):
        try:
            step_option_id = request.data.get("id")
            if not step_option_id:
                return Response({"error": "Champ 'id' requis"}, status=status.HTTP_400_BAD_REQUEST)

            step_option = StepOption.objects.get(id=step_option_id)
        except StepOption.DoesNotExist:
            return Response({"error": "StepOption non trouvé"}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = StepOptionSerializer(step_option, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            # Obtient le channel layer
            channel_layer = get_channel_layer()
            # Prépare les données à envoyer
            message_data = {
                'type': 'menu_update', # Type de l'événement (utilisé côté front)
                'status': 'full_sync_required',
                'timestamp': datetime.now().isoformat()
            }
            
            # Envoi du message au groupe de bornes
            async_to_sync(channel_layer.group_send)(
                SYNC_GROUP_NAME, # Le groupe
                {
                    'type': 'sync.message', # Nom de la méthode dans le Consumer (sync_message)
                    'data': message_data
                }
            )
            return Response({"message": "StepOption mis à jour", "data": serializer.data}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



