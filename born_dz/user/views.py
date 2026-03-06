from django.shortcuts import render # type: ignore

# Create your views here.

from rest_framework.views import APIView # type: ignore
from rest_framework.response import Response # type: ignore
from rest_framework import status # type: ignore
from user.models import User, Employee, TimeEntry, WorkSchedule, Payslip, EmployeeDocument
from user.serializers import (
    UserSerializer, EmployeeSerializer,
    TimeEntrySerializer, WorkScheduleSerializer, PayslipSerializer, EmployeeDocumentSerializer,
)
from rest_framework.permissions import IsAuthenticated # type: ignore
from rest_framework_simplejwt.tokens import RefreshToken # type: ignore
from rest_framework.permissions import AllowAny # type: ignore
from django.contrib.auth.hashers import check_password # type: ignore
from rest_framework_simplejwt.tokens import RefreshToken # type: ignore
from django.contrib.auth.hashers import check_password
from customer.models import Loyalty
from customer.serializers import LoyaltySerializer


class EmployeeTokenView(APIView):
    permission_classes = []
    authentication_classes = []
    
    def post(self, request):
        phone = request.data.get('phone')
        password = request.data.get('password')
        
        print(f"Tentative de connexion pour : {phone}")
        
        # 1. Vérification des champs
        if not phone or not password:
            return Response(
                {"error": "Veuillez fournir un numéro et un mot de passe"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Recherche de l'utilisateur
        try:
            employee_user = User.objects.get(phone=phone)
        except User.DoesNotExist:
            # 🛑 STOP : On ne crée PAS d'utilisateur ici. On renvoie une erreur.
            return Response(
                {"error": "Identifiants incorrects"}, 
                status=status.HTTP_401_UNAUTHORIZED
            )

        # 3. Vérification du mot de passe
        if not check_password(password, employee_user.password):
            print(f"Échec mot de passe pour {phone}")
            return Response(
                {"error": "Identifiants incorrects"}, 
                status=status.HTTP_401_UNAUTHORIZED
            )

        # 4. Vérification optionnelle : est-ce bien un employé ?
        # (Si vous voulez empêcher les clients simples de se connecter sur l'app employé)
        if not Employee.objects.filter(user=employee_user).exists():
             return Response(
                {"error": "Accès réservé au personnel"}, 
                status=status.HTTP_403_FORBIDDEN
            )
        restaurant_id = Employee.objects.get(user=employee_user).restaurant_id
        # 5. Génération du token ET sérialisation de l'utilisateur
        refresh = RefreshToken.for_user(employee_user)
        
        # On utilise le sérializer pour récupérer le role_name proprement
        user_serializer = UserSerializer(employee_user)

        data = {
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            # On renvoie tout l'objet user (qui contient role_name grâce à votre serializer)
            'user': user_serializer.data ,
            'restaurant_id': restaurant_id
        }
        
        print(f"Connexion réussie pour {phone} - Rôle: {user_serializer.data.get('role_name')}")
        return Response(data, status=status.HTTP_200_OK)
    
class EmployeeLogin(APIView):
    # L'utilisateur doit avoir un token valide
    permission_classes = [IsAuthenticated] 

    def get(self, request, *args, **kwargs):
        # request.user est automatiquement rempli par Django grâce au token JWT
        user = request.user 
        
        # On vérifie quand même que c'est un employé (optionnel mais conseillé)
        try:
            employee = Employee.objects.get(user=user)
            serializer = UserSerializer(user)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Employee.DoesNotExist:
            return Response({"error": "Cet utilisateur n'est pas un employé"}, status=status.HTTP_403_FORBIDDEN)
    


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
            
            #   CAS 1 : Anonyme (phone = null ou "0")
            if phone is None or phone == "0" or phone == "":
                print("  Mode anonyme")
                user_phone = "0000000000"
                user_password = "0000000000"
                
                user, created = User.objects.get_or_create(
                    phone=user_phone,
                    defaults={
                        'role_id': 2,
                        'username': user_phone,  #   Ajouter username
                        'email': f"{user_phone}@born.dz"
                    }
                )
                
                if created or not user.password.startswith('pbkdf2_'):
                    user.set_password(user_password)
                    user.save()
                    print(f"  Utilisateur anonyme {'créé' if created else 'trouvé'}")
                
                token = get_tokens_for_user(user)
                return Response(token, status=status.HTTP_200_OK)
            
            #   CAS 2 : Utilisateur avec numéro
            try:
                # Essayer de trouver l'utilisateur
                user = User.objects.get(phone=phone)
                print(f"  Utilisateur existant trouvé: {phone}")
                
                token = get_tokens_for_user(user)
                return Response(token, status=status.HTTP_200_OK)
                
            except User.DoesNotExist:
                #   Créer automatiquement le nouvel utilisateur
                print(f"  Création nouvel utilisateur: {phone}")
                
                user = User.objects.create(
                    phone=phone,
                    username=phone,  #   IMPORTANT : Définir username = phone
                    email=f"{phone}@born.dz",
                    role_id=2,  # Role client
                )
                user.set_password(phone)  # Mot de passe = numéro de téléphone
                user.save()
                
                print(f"  Utilisateur créé avec succès: {phone}")
                
                token = get_tokens_for_user(user)
                
                # Retourner avec status 201 (Created)
                return Response(token, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            print(f"  Erreur: {str(e)}")
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
            
            print(f"  Détails utilisateur récupérés: {phone}")
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


# ─── RH : liste filtrée par restaurant ───────────────────────────────────────

class EmployeeList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        restaurant_id = request.query_params.get('restaurant_id')
        qs = Employee.objects.filter(restaurant_id=restaurant_id) if restaurant_id else Employee.objects.all()
        serializer = EmployeeSerializer(qs, many=True)
        return Response(serializer.data)


class EmployeeCreateFull(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = EmployeeSerializer(data=request.data)
        if serializer.is_valid():
            employee = serializer.save()
            return Response(EmployeeSerializer(employee).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class EmployeeDetailFull(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            employee = Employee.objects.get(pk=pk)
            return Response(EmployeeSerializer(employee).data)
        except Employee.DoesNotExist:
            return Response({"error": "Employé non trouvé"}, status=status.HTTP_404_NOT_FOUND)


class EmployeeUpdateFull(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, pk):
        try:
            employee = Employee.objects.get(pk=pk)
            serializer = EmployeeSerializer(employee, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Employee.DoesNotExist:
            return Response({"error": "Employé non trouvé"}, status=status.HTTP_404_NOT_FOUND)


class EmployeeDeleteFull(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            employee = Employee.objects.get(pk=pk)
            employee.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Employee.DoesNotExist:
            return Response({"error": "Employé non trouvé"}, status=status.HTTP_404_NOT_FOUND)


# ─── Pointage ────────────────────────────────────────────────────────────────

class TimeEntryList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        entries = TimeEntry.objects.filter(employee_id=pk).order_by('-check_in')
        return Response(TimeEntrySerializer(entries, many=True).data)

    def post(self, request, pk):
        try:
            Employee.objects.get(pk=pk)
        except Employee.DoesNotExist:
            return Response({"error": "Employé non trouvé"}, status=status.HTTP_404_NOT_FOUND)
        serializer = TimeEntrySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(employee_id=pk)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TimeEntryUpdate(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, pk):
        try:
            entry = TimeEntry.objects.get(pk=pk)
            serializer = TimeEntrySerializer(entry, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except TimeEntry.DoesNotExist:
            return Response({"error": "Pointage non trouvé"}, status=status.HTTP_404_NOT_FOUND)


# ─── Horaires ────────────────────────────────────────────────────────────────

class ScheduleList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        schedules = WorkSchedule.objects.filter(employee_id=pk).order_by('week_start', 'day_of_week')
        return Response(WorkScheduleSerializer(schedules, many=True).data)

    def post(self, request, pk):
        try:
            Employee.objects.get(pk=pk)
        except Employee.DoesNotExist:
            return Response({"error": "Employé non trouvé"}, status=status.HTTP_404_NOT_FOUND)
        serializer = WorkScheduleSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(employee_id=pk)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ScheduleDelete(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            WorkSchedule.objects.get(pk=pk).delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except WorkSchedule.DoesNotExist:
            return Response({"error": "Horaire non trouvé"}, status=status.HTTP_404_NOT_FOUND)


# ─── Fiches de paie ──────────────────────────────────────────────────────────

class PayslipList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        payslips = Payslip.objects.filter(employee_id=pk).order_by('-period_start')
        return Response(PayslipSerializer(payslips, many=True).data)

    def post(self, request, pk):
        try:
            Employee.objects.get(pk=pk)
        except Employee.DoesNotExist:
            return Response({"error": "Employé non trouvé"}, status=status.HTTP_404_NOT_FOUND)
        serializer = PayslipSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(employee_id=pk)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ─── Documents ───────────────────────────────────────────────────────────────

class DocumentList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        docs = EmployeeDocument.objects.filter(employee_id=pk).order_by('-uploaded_at')
        return Response(EmployeeDocumentSerializer(docs, many=True).data)

    def post(self, request, pk):
        try:
            Employee.objects.get(pk=pk)
        except Employee.DoesNotExist:
            return Response({"error": "Employé non trouvé"}, status=status.HTTP_404_NOT_FOUND)
        serializer = EmployeeDocumentSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(employee_id=pk)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DocumentDelete(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            EmployeeDocument.objects.get(pk=pk).delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except EmployeeDocument.DoesNotExist:
            return Response({"error": "Document non trouvé"}, status=status.HTTP_404_NOT_FOUND)
