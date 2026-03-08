# menu/views.py - CORRECTIONS POUR LES MISES À JOUR

from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import GroupMenuSerializer, MenuSerializer, OptionSerializer, StepOptionSerializer, StepSerializer
from .models import GroupMenu, Menu, Option, Step, StepOption
from rest_framework.permissions import IsAuthenticated
from django.db import models
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from datetime import datetime
from borne_sync.consumers import SYNC_GROUP_NAME

# ============= GROUP MENU VIEWS =============

# menu/views.py - AVEC LOGS DÉTAILLÉS POUR DÉBOGAGE PHOTO

from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import GroupMenuSerializer, MenuSerializer, OptionSerializer, StepOptionSerializer, StepSerializer
from .models import GroupMenu, Menu, Option, Step, StepOption
from rest_framework.permissions import IsAuthenticated
from django.db import models
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from datetime import datetime
from borne_sync.consumers import SYNC_GROUP_NAME
import traceback


# ============= GROUP MENU VIEWS =============

class GroupMenuCreate(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        print("=" * 60)
        print("   CRÉATION GROUPMENU - DÉBUT")
        print("=" * 60)
        
        # Logs détaillés de la requête
        print(f"Content-Type: {request.content_type}")
        print(f"Method: {request.method}")
        print(f"Data type: {type(request.data)}")
        
        # Afficher toutes les clés
        if hasattr(request.data, 'keys'):
            print(f"Clés reçues: {list(request.data.keys())}")
        
        # Logs de chaque champ
        for key in request.data.keys():
            value = request.data[key]
            print(f"  - {key}: {value} (type: {type(value).__name__})")
        
        # Vérification spécifique de la photo
        if 'photo' in request.data:
            photo = request.data['photo']
            print("\n     ANALYSE DE LA PHOTO:")
            print(f"  Type: {type(photo)}")
            print(f"  Valeur: {photo}")
            
            # Si c'est un fichier uploadé
            if hasattr(photo, 'name'):
                print(f"     Nom du fichier: {photo.name}")
            if hasattr(photo, 'content_type'):
                print(f"     Content-Type: {photo.content_type}")
            if hasattr(photo, 'size'):
                print(f"     Taille: {photo.size} bytes ({photo.size / 1024:.2f} KB)")
            
            # Si c'est une string (erreur)
            if isinstance(photo, str):
                print(f"    ERREUR: Photo est une string: '{photo}'")
                print(f"    Devrait être un fichier uploadé")
        else:
            print("\n    Aucune photo dans la requête")
        
        print("=" * 60)
        
        try:
            serializer = GroupMenuSerializer(data=request.data, partial=True)
            
            if serializer.is_valid():
                print("   Serializer validé")
                instance = serializer.save()
                print(f"   GroupMenu créé: ID={instance.id}, Nom={instance.name}")
                
                # Vérifier si la photo a été sauvegardée
                if instance.photo:
                    print(f"   Photo sauvegardée: {instance.photo.name}")
                    print(f"   Chemin complet: {instance.photo.path}")
                    print(f"   URL: {instance.photo.url}")
                else:
                    print("    Aucune photo sauvegardée dans l'instance")
                
                print("=" * 60)
                
                # Notification WebSocket
                channel_layer = get_channel_layer()
                message_data = {
                    'type': 'menu_update',
                    'status': 'full_sync_required',
                    'timestamp': datetime.now().isoformat()
                }
                async_to_sync(channel_layer.group_send)(
                    SYNC_GROUP_NAME,
                    {'type': 'sync.message', 'data': message_data}
                )
                
                return Response({
                    "message": "GroupMenu créé avec succès", 
                    "data": serializer.data
                }, status=status.HTTP_201_CREATED)
            
            print(f" Erreurs de validation serializer:")
            for field, errors in serializer.errors.items():
                print(f"  - {field}: {errors}")
            print("=" * 60)
            
            return Response({
                "message": "Erreur de validation", 
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            print(f"EXCEPTION: {str(e)}")
            print("Traceback complet:")
            print(traceback.format_exc())
            print("=" * 60)
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class GroupMenuUpdate(APIView):
    permission_classes = []
    authentication_classes = []
    
    def put(self, request, *args, **kwargs):
        print("=" * 60)
        print("   MISE À JOUR GROUPMENU - DÉBUT")
        print("=" * 60)
        
        try:
            # Logs de la requête
            print(f"Content-Type: {request.content_type}")
            print(f"Data: {request.data}")
            
            # Vérifier la photo
            if 'photo' in request.data:
                photo = request.data['photo']
                print(f"\n     Photo détectée:")
                print(f"  Type: {type(photo)}")
                if hasattr(photo, 'name'):
                    print(f"  Nom: {photo.name}")
                if hasattr(photo, 'size'):
                    print(f"  Taille: {photo.size} bytes")
            else:
                print("\n    Pas de nouvelle photo (conservation de l'ancienne)")
            
            group_menu_id = request.data.get("id")
            
            if not group_menu_id:
                return Response(
                    {"error": "L'ID du groupe est requis"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            group_menu = GroupMenu.objects.get(id=group_menu_id)
            print(f"   GroupMenu trouvé: {group_menu.name}")
            
            # Photo actuelle
            if group_menu.photo:
                print(f"  Photo actuelle: {group_menu.photo.name}")
            else:
                print(f"  Pas de photo actuelle")
            
            serializer = GroupMenuSerializer(group_menu, data=request.data, partial=True)
            
            if serializer.is_valid():
                instance = serializer.save()
                print(f"   GroupMenu mis à jour: {instance.name}")
                
                # Vérifier la nouvelle photo
                if instance.photo:
                    print(f"   Photo finale: {instance.photo.name}")
                else:
                    print(f"    Pas de photo finale")
                
                print("=" * 60)
                
                # Notification WebSocket
                channel_layer = get_channel_layer()
                message_data = {
                    'type': 'menu_update',
                    'status': 'full_sync_required',
                    'timestamp': datetime.now().isoformat()
                }
                async_to_sync(channel_layer.group_send)(
                    SYNC_GROUP_NAME,
                    {'type': 'sync.message', 'data': message_data}
                )
                
                return Response({
                    "message": "GroupMenu mis à jour", 
                    "data": serializer.data
                }, status=status.HTTP_200_OK)
            
            print(f"  Erreurs de validation:")
            for field, errors in serializer.errors.items():
                print(f"  - {field}: {errors}")
            print("=" * 60)
            
            return Response({
                "message": "Erreur de validation", 
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except GroupMenu.DoesNotExist:
            return Response(
                {"error": "GroupMenu non trouvé"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            print(f"  EXCEPTION: {str(e)}")
            print(traceback.format_exc())
            print("=" * 60)
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ============= MENU VIEWS (avec logs similaires) =============

STEP_TYPE_NAMES = {
    'pain': 'Choix du pain',
    'crudité': 'Crudités',
    'accompagnement': 'Accompagnement',
    'sauce': 'Sauce',
    'boisson': 'Boisson',
    'dessert': 'Dessert',
    'base': 'Base',
    'protéine': 'Protéine',
    'salad': 'Salade',
    'plate': 'Plat',
    'drink': 'Boisson',
}

def auto_create_steps_for_menu(menu):
    """Crée automatiquement une étape par type d'option existant dans la DB."""
    option_types = Option.objects.values_list('type', flat=True).distinct()
    for i, otype in enumerate(option_types):
        options_of_type = Option.objects.filter(type=otype, avalaible=True)
        if not options_of_type.exists():
            continue
        step = Step.objects.create(
            name=STEP_TYPE_NAMES.get(otype, otype.capitalize()),
            number=i + 1,
            menu=menu,
            max_options=1,
            type=otype,
            show_for_solo=True,
            show_for_full=True,
        )
        for opt in options_of_type:
            StepOption.objects.get_or_create(step=step, option=opt)


class MenuCreate(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        try:
            serializer = MenuSerializer(data=request.data)
            if serializer.is_valid():
                instance = serializer.save()
                auto_create_steps_for_menu(instance)
                return Response({
                    "message": "Menu créé avec succès",
                    "data": serializer.data
                }, status=status.HTTP_201_CREATED)
            return Response({
                "message": "Erreur de validation",
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(traceback.format_exc())
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class CrossSellView(APIView):
    """Retourne les articles à proposer en cross-selling avant le paiement."""
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        restaurant_id = request.query_params.get('restaurant_id')
        if not restaurant_id:
            return Response({"error": "restaurant_id requis"}, status=400)
        items = Menu.objects.filter(
            group_menu__restaurant_id=restaurant_id,
            show_in_crosssell=True,
            avalaible=True,
        ).select_related('group_menu')
        serializer = MenuSerializer(items, many=True, context={'request': request})
        return Response(serializer.data)


class MenuUpdate(APIView):
    permission_classes = []
    authentication_classes = []
    
    def put(self, request, *args, **kwargs):
        print("=" * 60)
        print("   MISE À JOUR MENU")
        print("=" * 60)
        
        try:
            menu_id = request.data.get("id")
            
            if not menu_id:
                return Response(
                    {"error": "L'ID du menu est requis"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            menu = Menu.objects.get(id=menu_id)
            print(f"   Menu trouvé: {menu.name}")
            
            if 'photo' in request.data:
                photo = request.data['photo']
                print(f"     Nouvelle photo: {type(photo)}")
                if hasattr(photo, 'name'):
                    print(f"  Nom: {photo.name}")
            
            serializer = MenuSerializer(menu, data=request.data, partial=True)
            
            if serializer.is_valid():
                instance = serializer.save()
                print(f"   Menu mis à jour: {instance.name}")
                print("=" * 60)
                
                # Notification WebSocket
                channel_layer = get_channel_layer()
                message_data = {
                    'type': 'menu_update',
                    'status': 'full_sync_required',
                    'timestamp': datetime.now().isoformat()
                }
                async_to_sync(channel_layer.group_send)(
                    SYNC_GROUP_NAME,
                    {'type': 'sync.message', 'data': message_data}
                )
                
                return Response({
                    "message": "Menu mis à jour", 
                    "data": serializer.data
                }, status=status.HTTP_200_OK)
            
            print(f"  Erreurs: {serializer.errors}")
            print("=" * 60)
            
            return Response({
                "message": "Erreur de validation", 
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Menu.DoesNotExist:
            return Response({"error": "Menu non trouvé"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"  Exception: {str(e)}")
            print(traceback.format_exc())
            print("=" * 60)
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ============= OPTION VIEWS (avec logs similaires) =============

class OptionCreate(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, *args, **kwargs):
        print("=" * 60)
        print("   CRÉATION OPTION")
        print("=" * 60)
        
        if 'photo' in request.data:
            photo = request.data['photo']
            print(f"     Photo: {type(photo)}")
            if hasattr(photo, 'name'):
                print(f"  Nom: {photo.name}")
        
        try:
            serializer = OptionSerializer(data=request.data)
            
            if serializer.is_valid():
                instance = serializer.save()
                print(f"   Option créée: {instance.name}")
                if instance.photo:
                    print(f"   Photo: {instance.photo.name}")
                print("=" * 60)
                
                return Response({
                    "message": "Option créée avec succès", 
                    "data": serializer.data
                }, status=status.HTTP_201_CREATED)
            
            print(f"  Erreurs: {serializer.errors}")
            print("=" * 60)
            
            return Response({
                "message": "Erreur de validation", 
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            print(f"  Exception: {str(e)}")
            print(traceback.format_exc())
            print("=" * 60)
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class OptionUpdate(APIView):
    permission_classes = [IsAuthenticated]
    
    def put(self, request, *args, **kwargs):
        print("=" * 60)
        print("   MISE À JOUR OPTION")
        print("=" * 60)
        
        try:
            option_id = request.data.get("id")
            
            if not option_id:
                return Response(
                    {"error": "L'ID de l'option est requis"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            option = Option.objects.get(id=option_id)
            print(f"   Option trouvée: {option.name}")
            
            if 'photo' in request.data:
                photo = request.data['photo']
                print(f"     Nouvelle photo: {type(photo)}")
                if hasattr(photo, 'name'):
                    print(f"  Nom: {photo.name}")
            
            serializer = OptionSerializer(option, data=request.data, partial=True)
            
            if serializer.is_valid():
                instance = serializer.save()
                print(f"   Option mise à jour: {instance.name}")
                print("=" * 60)
                
                return Response({
                    "message": "Option mise à jour", 
                    "data": serializer.data
                }, status=status.HTTP_200_OK)
            
            print(f"  Erreurs: {serializer.errors}")
            print("=" * 60)
            
            return Response({
                "message": "Erreur de validation", 
                "errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
            
        except Option.DoesNotExist:
            return Response({"error": "Option non trouvée"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f"  Exception: {str(e)}")
            print(traceback.format_exc())
            print("=" * 60)
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ============= AUTRES VUES (sans changement) =============
# Copier les autres vues depuis corrected_menu_views.py
# GroupMenuDetail, GroupMenuList, GroupMenuDelete
# MenuDetail, MenuList, MenuDelete
# OptionDetail, OptionList, OptionDelete
# StepCreate, StepUpdate, StepDelete, StepList, StepDetail, StepListByMenu
# StepOptionList, StepOptionUpdate
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
    
    def get(self, request, id_restaurant, *args, **kwargs):
        group_menus = GroupMenu.objects.filter(restaurant=id_restaurant)
        serializer = GroupMenuSerializer(group_menus, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class GroupMenuDelete(APIView):
    permission_classes = [IsAuthenticated]
    
    def delete(self, request, pk, *args, **kwargs):
        try:
            group_menu = GroupMenu.objects.get(pk=pk)
            group_menu_name = group_menu.name
            group_menu.delete()
            print(f"   GroupMenu supprimé: {group_menu_name}")
            return Response({"message": "GroupMenu supprimé avec succès"}, status=status.HTTP_204_NO_CONTENT)
        except GroupMenu.DoesNotExist:
            return Response({"error": "GroupMenu non trouvé"}, status=status.HTTP_404_NOT_FOUND)

# ============= MENU VIEWS =============

class MenuDetail(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, id_menu, id_restaurant, *args, **kwargs):
        try:
            menu = Menu.objects.get(id=id_menu, group_menu__restaurant=id_restaurant)
            serializer = MenuSerializer(menu)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Menu.DoesNotExist:
            return Response({"error": "Menu non trouvé"}, status=status.HTTP_404_NOT_FOUND)

class MenuList(APIView):
    permission_classes = []
    authentication_classes = []
    
    def get(self, request, id_restaurant, *args, **kwargs):
        menus = Menu.objects.filter(group_menu__restaurant__id=id_restaurant)
        serializer = MenuSerializer(menus, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class MenuDelete(APIView):
    permission_classes = [IsAuthenticated]
    
    def delete(self, request, pk, *args, **kwargs):
        try:
            menu = Menu.objects.get(pk=pk)
            menu_name = menu.name
            menu.delete()
            print(f"   Menu supprimé: {menu_name}")
            return Response({"message": "Menu supprimé avec succès"}, status=status.HTTP_204_NO_CONTENT)
        except Menu.DoesNotExist:
            return Response({"error": "Menu non trouvé"}, status=status.HTTP_404_NOT_FOUND)


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


class OptionDelete(APIView):
    permission_classes = [IsAuthenticated]
    
    def delete(self, request, pk, *args, **kwargs):
        try:
            option = Option.objects.get(pk=pk)
            option_name = option.name
            option.delete()
            print(f"   Option supprimée: {option_name}")
            return Response({"message": "Option supprimée avec succès"}, status=status.HTTP_204_NO_CONTENT)
        except Option.DoesNotExist:
            return Response({"error": "Option non trouvée"}, status=status.HTTP_404_NOT_FOUND)

# ============= STEP VIEWS =============

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
        mode = request.query_params.get('mode')    # 'solo' | 'full' | None
        admin = request.query_params.get('admin') == 'true'  # admin → toutes options

        qs = Step.objects.filter(menu_id=menu_id, avalaible=True)
        if mode == 'solo':
            qs = qs.filter(show_for_solo=True)
        elif mode == 'full':
            qs = qs.filter(show_for_full=True)

        # Admin : toutes les stepoptions (y compris désactivées, pour pouvoir les réactiver)
        # Borne : uniquement les stepoptions avalaible=True
        stepoptions_qs = StepOption.objects.select_related('option')
        if not admin:
            stepoptions_qs = stepoptions_qs.filter(avalaible=True)

        steps = qs.order_by('number').prefetch_related(
            models.Prefetch('stepoptions', queryset=stepoptions_qs)
        )
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
        try:
            steps = Step.objects.filter(menu__id=menu_id).prefetch_related('stepoptions').order_by('number')
            serializer = StepSerializer(steps, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Step.DoesNotExist:
            return Response({"error": "Étape non trouvée"}, status=status.HTTP_404_NOT_FOUND)

class StepUpdate(APIView):
    permission_classes = []
    authentication_classes = []

    def put(self, request, *args, **kwargs):
        try:
            step_id = request.data.get("id")
            step = Step.objects.get(id=step_id)
        except Step.DoesNotExist:
            return Response({"error": "Étape non trouvée"}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = StepSerializer(step, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Étape mise à jour", "data": serializer.data}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
class StepDelete(APIView):
    permission_classes = [IsAuthenticated]
    
    def delete(self, request, pk, *args, **kwargs):
        try:
            step = Step.objects.get(pk=pk)
            step.delete()
            return Response({"message": "Étape supprimée avec succès"}, status=status.HTTP_204_NO_CONTENT)
        except Step.DoesNotExist:
            return Response({"error": "Étape non trouvée"}, status=status.HTTP_404_NOT_FOUND)

# ============= STEP OPTION VIEWS =============

class StepOptionList(APIView):
    permission_classes = []
    authentication_classes = []

    def get(self, request, id_restaurant, *args, **kwargs):
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
            
            # Notification WebSocket
            channel_layer = get_channel_layer()
            message_data = {
                'type': 'menu_update',
                'status': 'full_sync_required',
                'timestamp': datetime.now().isoformat()
            }
            
            async_to_sync(channel_layer.group_send)(
                SYNC_GROUP_NAME,
                {
                    'type': 'sync.message',
                    'data': message_data
                }
            )
            return Response({"message": "StepOption mis à jour", "data": serializer.data}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)