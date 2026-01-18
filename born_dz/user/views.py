from django.shortcuts import render # type: ignore

# Create your views here.

from rest_framework.views import APIView # type: ignore
from rest_framework.response import Response # type: ignore
from rest_framework import status # type: ignore
from user.models import User, Employee
from user.serializers import UserSerializer, EmployeeSerializer
from rest_framework.permissions import IsAuthenticated # type: ignore
from rest_framework_simplejwt.tokens import RefreshToken # type: ignore
from rest_framework.permissions import AllowAny # type: ignore
from django.contrib.auth.hashers import check_password # type: ignore
from rest_framework_simplejwt.tokens import RefreshToken # type: ignore
from django.contrib.auth.hashers import check_password
from customer.models import Loyalty
from customer.serializers import LoyaltySerializer


class EmployeeTokenView(APIView):
    permission_classes = []  # ou ta permission personnalisée
    authentication_classes = [] #Ajout de cette ligne pour pouvoir utiliser l'api sans jeton
    def post(self, request):
        
        phone = request.data.get('phone')
        password = request.data.get('password')
        print("Phone:", phone)
        try :
            employee = User.objects.get(phone=phone)
            print("Employee found:", employee)
            if not check_password(password, employee.password):
                print("Password check failed for employee:", employee)
                return Response({"erreur":"erreur mdp"})
            refresh = RefreshToken.for_user(employee)
            token = {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
            print("Token:", token)
        except User.DoesNotExist:
            user=User.objects.create(
                phone=phone,
                role_id=2,  # Assigner un rôle par défaut, par exemple 'customer'
                password=phone,  # Utiliser le téléphone comme mot de passe par défaut
            )
            Employee.objects.create(
                user=user,
                restaurant_id=1,  # Assigner un restaurant par défaut, par exemple le restaurant avec l'ID 1
            )
            #return Response({"erreur":"pas d'employé avec ces ID"})
            token = get_tokens_for_user(user)

        print("Token:", token)
        return Response(token)
    
class EmployeeLogin(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, *args, **kwargs):
        try:
            
            phone = request.query_params.get("phone")
            password = request.query_params.get("password")
            user = User.objects.get(phone=phone)
            if not check_password(password, user.password):
                return Response({"error": "Identifiants incorrect"}, status=status.HTTP_401_UNAUTHORIZED)
        except User.DoesNotExist:
            return Response({"error": "Utilisateur non trouvé"}, status=status.HTTP_404_NOT_FOUND)
        #Cheking if the user is an employee in this restaurant
        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)
    


def get_tokens_for_user(user):
    """Fonction pour générer les tokens JWT"""
    from rest_framework_simplejwt.tokens import RefreshToken
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


class UserTokenView(APIView):
    """
    Récupère ou crée un utilisateur et retourne son token
    - Si phone est null → Utilisateur anonyme
    - Si phone existe → Retourne token
    - Si phone n'existe pas → Crée l'utilisateur et retourne token
    """
    permission_classes = []
    authentication_classes = []
    
    def post(self, request, *args, **kwargs):
        try:
            phone = request.data.get("phone")
            
            # ✅ CAS 1 : Anonyme (phone = null ou "0")
            if phone is None or phone == "0" or phone == "":
                print("📝 Mode anonyme")
                user_phone = "0000000000"
                user_password = "0000000000"
                
                user, created = User.objects.get_or_create(
                    phone=user_phone,
                    defaults={
                        'role_id': 2,
                        'username': user_phone,  # ✅ Ajouter username
                        'email': f"{user_phone}@born.dz"
                    }
                )
                
                if created or not user.password.startswith('pbkdf2_'):
                    user.set_password(user_password)
                    user.save()
                    print(f"✅ Utilisateur anonyme {'créé' if created else 'trouvé'}")
                
                token = get_tokens_for_user(user)
                return Response(token, status=status.HTTP_200_OK)
            
            # ✅ CAS 2 : Utilisateur avec numéro
            try:
                # Essayer de trouver l'utilisateur
                user = User.objects.get(phone=phone)
                print(f"✅ Utilisateur existant trouvé: {phone}")
                
                token = get_tokens_for_user(user)
                return Response(token, status=status.HTTP_200_OK)
                
            except User.DoesNotExist:
                # ✅ Créer automatiquement le nouvel utilisateur
                print(f"📝 Création nouvel utilisateur: {phone}")
                
                user = User.objects.create(
                    phone=phone,
                    username=phone,  # ✅ IMPORTANT : Définir username = phone
                    email=f"{phone}@born.dz",
                    role_id=2,  # Role client
                )
                user.set_password(phone)  # Mot de passe = numéro de téléphone
                user.save()
                
                print(f"✅ Utilisateur créé avec succès: {phone}")
                
                token = get_tokens_for_user(user)
                
                # Retourner avec status 201 (Created)
                return Response(token, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            print(f"❌ Erreur: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GetUserByPhone(APIView):
    """
    Récupère les détails d'un utilisateur par son numéro de téléphone
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        phone = request.data.get("phone")
        
        if not phone:
            return Response(
                {"error": "Numéro de téléphone requis"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(phone=phone)
            serializer = UserSerializer(user)
            
            print(f"✅ Détails utilisateur récupérés: {phone}")
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except User.DoesNotExist:
            return Response(
                {"error": "Utilisateur introuvable"}, 
                status=status.HTTP_404_NOT_FOUND
            )


class UserDetail(APIView):
    """
    Récupère un utilisateur par son ID (pk)
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk, *args, **kwargs):
        try:
            user = User.objects.get(pk=pk)
            serializer = UserSerializer(user)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response(
                {"error": "Utilisateur non trouvé"}, 
                status=status.HTTP_404_NOT_FOUND
            )

class UserCreate(APIView):
    def post(self, request, *args, **kwargs):
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(
                {
                    "message": "Utilisateur créé avec succès",
                    "data": serializer.data,
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)




class UserUpdate(APIView):
    permission_classes = [IsAuthenticated]
    def put(self, request, *args, **kwargs):
        try:
            user_id = request.data.get("id")
            user = User.objects.get(id=user_id)
            serializer = UserSerializer(user, data=request.data)
            if serializer.is_valid():
                serializer.save()
                return Response({"message": "Utilisateur mis à jour", "data": serializer.data}, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except User.DoesNotExist:
            return Response({"error": "Utilisateur non trouvé"}, status=status.HTTP_404_NOT_FOUND)


class UserDelete(APIView):
    permission_classes = [IsAuthenticated]
    def delete(self, request, pk, *args, **kwargs):
        try:
            user = User.objects.get(pk=pk)
            user.delete()
            return Response({"message": "Utilisateur supprimé avec succès"}, status=status.HTTP_204_NO_CONTENT)
        except User.DoesNotExist:
            return Response({"error": "Utilisateur non trouvé"}, status=status.HTTP_404_NOT_FOUND)


class EmployeeCreate(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, *args, **kwargs):
        serializer = EmployeeSerializer(data=request.data)
        if serializer.is_valid():
            employee = serializer.save()
            return Response(
                {
                    "message": "Employé créé avec succès",
                    "data": serializer.data,
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class EmployeeDetail(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, pk, *args, **kwargs):
        try:
            employee = Employee.objects.get(pk=pk)
            serializer = EmployeeSerializer(employee)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Employee.DoesNotExist:
            return Response({"error": "Employé non trouvé"}, status=status.HTTP_404_NOT_FOUND)

class AllEmployee(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, restaurant_id, *args, **kwargs):
        try:
            employees = Employee.objects.filter(restaurant_id=restaurant_id)
            serializer = EmployeeSerializer(employees, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class EmployeeUpdate(APIView):
    permission_classes = [IsAuthenticated]
    def put(self, request, *args, **kwargs):
        try:
            employee_id = request.data.get("id")
            employee = Employee.objects.get(id=employee_id)
            serializer = EmployeeSerializer(employee, data=request.data)
            if serializer.is_valid():
                serializer.save()
                return Response({"message": "Employé mis à jour", "data": serializer.data}, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Employee.DoesNotExist:
            return Response({"error": "Employé non trouvé"}, status=status.HTTP_404_NOT_FOUND)


class EmployeeDelete(APIView):
    permission_classes = [IsAuthenticated]
    def delete(self, request, pk, *args, **kwargs):
        try:
            employee = Employee.objects.get(pk=pk)
            employee.delete()
            return Response({"message": "Employé supprimé avec succès"}, status=status.HTTP_204_NO_CONTENT)
        except Employee.DoesNotExist:
            return Response({"error": "Employé non trouvé"}, status=status.HTTP_404_NOT_FOUND)
