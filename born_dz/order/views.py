# --- 1. Bibliothèque Standard Python ---
import base64
import io
import traceback
from datetime import datetime, time, timedelta

# --- 2. Django Core ---
from django.db.models import Sum, Count, F
from django.shortcuts import render, get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from django.utils.timezone import make_naive, now
from django.db import models
# --- 3. Bibliothèques Tierces (DRF, QRCode) ---
import qrcode
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

# --- 4. Imports Locaux (Tes apps) ---
from customer.models import Loyalty
from menu.models import Menu, Step, Option, StepOption
from restaurant.models import Restaurant
from user.models import User
from .models import Order, OrderItem, OrderItemOption
from .serializers import OrderSerializer

# ==========================================
# 1. ORDER CREATION (CORRECTED)
# ==========================================
class OrderCreate(APIView):
    permission_classes = []
    authentication_classes = []
    
    def post(self, request, card):
        print("\n" + "="*50)
        print("  DÉBUT CREATE ORDER")
        print("="*50)
        
        data = request.data
        user_id = data.get("user")
        card = bool(card)
        
        # --- DEBUG ---
        print(f"\n  DONNÉES REÇUES:")
        print(f"   - user ID: {user_id}")
        print(f"   - restaurant: {data.get('restaurant')}")
        print(f"   - card: {card}")
        
        # 1. RÉCUPÉRATION DU RESTAURANT
        restaurant_raw = data.get("restaurant")
        try:
            restaurant_id = int(restaurant_raw)
            restaurant = Restaurant.objects.get(id=restaurant_id)
            print(f"  Restaurant trouvé: {restaurant.name}")
        except (ValueError, TypeError):
             return Response({"error": "Restaurant ID invalide"}, status=status.HTTP_400_BAD_REQUEST)
        except Restaurant.DoesNotExist:
             return Response({"error": "Restaurant introuvable"}, status=status.HTTP_404_NOT_FOUND)

        # 2. RÉCUPÉRATION DE L'UTILISATEUR (Instance)
        user_instance = None
        if user_id and user_id != 0:
            try:
                # On cherche l'objet User via son ID
                user_instance = User.objects.get(id=user_id)
                print(f"  Utilisateur identifié: {user_instance.username} (ID: {user_instance.id})")
            except User.DoesNotExist:
                print(f"  Utilisateur ID={user_id} introuvable, commande anonyme.")
                user_instance = None

        # 3. CRÉATION DE LA COMMANDE
        print(f"\n  Création de l'objet Order...")

        # --- CORRECTION : Gestion robuste de 'take_away' ---
        # 1. On cherche la clé 'takeaway' OU 'take_away'
        raw_takeaway = data.get("takeaway", data.get("take_away", False))
        
        # 2. On convertit en booléen de manière sécurisée (comme pour solo/extra)
        # Si c'est une chaine ("true", "1"), on le détecte. Si c'est déjà un bool, ça marche.
        take_away_bool = str(raw_takeaway).lower() in ['true', '1', 'yes'] if raw_takeaway is not True else True
        # Note: la ligne ci-dessus gère le cas où raw_takeaway est le booléen True directement.
        # Une version plus simple et explicite :
        if isinstance(raw_takeaway, str):
             take_away_bool = raw_takeaway.lower() in ['true', '1', 'yes']
        else:
             take_away_bool = bool(raw_takeaway)
             
        # Définir le statut et l'état de paiement selon le mode de règlement
        if card:
            # Si Carte : On valide directement et on marque comme payé
            initial_status = 'in_progress'
            is_paid = True
        else:
            # Si Espèce : On attend la confirmation (A confirmer) et le paiement
            initial_status = 'pending'
            is_paid = False
        # ------------------------

        try:
            order = Order.objects.create(
                user=user_instance,
                restaurant=restaurant,
                cash=not card,
                take_away=take_away_bool,
                # On applique les nouvelles variables ici :
                status=initial_status, 
                paid=is_paid
            )
            print(f"  Commande créée: ID={order.id} | Status={initial_status} | Payé={is_paid}")
            
        except Exception as e:
            print(f"  ERREUR CRITIQUE creation Order: {e}")
            traceback.print_exc()
            return Response({"error": "Erreur création commande", "details": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # 4. AJOUT DES ITEMS
        print(f"\n  Ajout des items...")
        
        try:
            for item_data in data.get('items', []):
                # Récupération du menu
                try:
                    menu_id = item_data.get("menuId") or item_data.get("menu") or item_data.get("id")
                    menu = Menu.objects.get(id=menu_id)
                except Menu.DoesNotExist:
                    print(f"  Erreur: Menu {menu_id} introuvable")
                    continue

                # --- SÉCURISATION SOLO / EXTRA ---
                raw_solo = str(item_data.get("solo", "")).lower()
                is_solo = raw_solo in ['true', '1', 'yes'] or item_data.get("solo") is True

                raw_extra = str(item_data.get("extra", "")).lower()
                is_extra = raw_extra in ['true', '1', 'yes'] or item_data.get("extra") is True

                # --- CRÉATION DE L'ITEM ---
                order_item = OrderItem.objects.create(
                    order=order, 
                    menu=menu, 
                    quantity=item_data.get("quantity", 1),
                    solo=is_solo,    # Parfaitement sécurisé
                    extra=is_extra   # Parfaitement sécurisé
                )

                # --- ENREGISTREMENT DES OPTIONS (CORRIGÉ) ---
                for opt in item_data.get("options", []):
                    try:
                        opt_id = opt.get("option")
                        step_id = opt.get("step")
                        
                        # Recherche intelligente : cherche l'ID du StepOption OU de l'Option
                        step_option = StepOption.objects.filter(
                            models.Q(id=opt_id) | models.Q(step_id=step_id, option_id=opt_id)
                        ).first()
                        
                        if step_option:
                            OrderItemOption.objects.create(
                                order_item=order_item, 
                                option=step_option
                            )
                        else:
                            print(f"  Erreur: Option {opt_id} introuvable en base de données")
                    except Exception as option_error:
                        print(f"  Erreur boucle option: {option_error}")
                        continue
                    except StepOption.DoesNotExist:
                        print(f"  Erreur: Option {opt.get('option')} introuvable pour l'étape {opt.get('step')}")
                        continue

        except Exception as items_error:
            print(f"  ERREUR ajout items: {items_error}")
            order.delete() # On nettoie si ça plante
            return Response({"error": "Erreur ajout items", "details": str(items_error)}, status=status.HTTP_400_BAD_REQUEST)
        # 5. FIDÉLITÉ (APRES LES ITEMS)
        # On calcule les points maintenant que le prix total est connu
        if user_instance:
            try:
                total = order.total_price()
                if total > 0:
                    loyalty, _ = Loyalty.objects.get_or_create(
                        user=user_instance, 
                        restaurant=restaurant
                    )
                    loyalty.point += total
                    loyalty.save()
                    print(f"  Points fidélité ajoutés: +{total}")
            except Exception as loyalty_error:
                print(f"  Erreur fidélité (non bloquant): {loyalty_error}")

        # 6. GÉNÉRATION TICKET & QR
        qr_code = None
        try:
            generate_ticket_content(request, order.id) # Juste pour verif console
            qr_code = generate_order_qr(order.id)
        except Exception as e:
            print(f"  Erreur post-process (QR/Ticket): {e}")

        return Response({
            "message": "Commande créée avec succès", 
            "order_id": order.id, 
            "qr_code_base64": qr_code
        }, status=status.HTTP_201_CREATED)


# ==========================================
# 2. OTHER VIEWS (KEPT AS IS)
# ==========================================

class OrderList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        orders = Order.objects.all()
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data)

class OrderDetail(RetrieveAPIView):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)
    
class OrderDelete(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, order_id):
        try:
            order = Order.objects.get(id=order_id, user=request.user)
            order.delete()
            return Response({"message": "Commande supprimée avec succès"}, status=status.HTTP_204_NO_CONTENT)
        except Order.DoesNotExist:
            return Response({"error": "Commande introuvable"}, status=status.HTTP_404_NOT_FOUND)
        

class POSOrderGet(APIView):
    permission_classes = []
    authentication_classes = []

    def get(self, request, restaurant_id):
        try:
            # Filtrer les commandes de moins de 24 heures (Optionnel: ajouter filtre date)
            orders = Order.objects.filter(restaurant=restaurant_id).prefetch_related(
                'items__menu',
                'items__options__option__step'
            ).order_by('-created_at') # Plus récent en premier
            
            response_data = []

            for order in orders:
                order_items = []
                for item in order.items.all():
                    options = []
                    # SANS AUCUNE CONDITION LIMITANTE :
                    for option_relation in item.options.all():
                        step_option = option_relation.option
                        options.append({
                            "step_name": step_option.step.name if step_option.step else "Option",
                            "option_name": step_option.option.name if step_option.option else "Option",
                            "option_price": float(step_option.extra_price or 0),
                        })

                    order_items.append({
                        "menu_name": item.menu.name,
                        "quantity": item.quantity,
                        "solo": item.solo,
                        "extra": item.extra,
                        "composition": options,  # La composition est maintenant envoyée !
                    })

                response_data.append({
                    "order_id": order.id,
                    "order_status": order.status,
                    "refund": order.refund,
                    "created_at": order.created_at,
                    "total_price": float(order.total_price()),
                    "takeaway": order.take_away,
                    "paid": order.paid,
                    "cash": order.cash,
                    "items": order_items,
                    "cancelled": order.cancelled,
                })

            return Response({"orders": response_data}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                "error": "Erreur lors de la récupération des commandes",
                "details": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

class OrderUpdate(APIView):
    permission_classes = []
    authentication_classes = []
    def put(self, request,order_id, *args, **kwargs):
        print(request.data)
        try:
            order = Order.objects.get(id=order_id)
        except Order.DoesNotExist:
            return Response({"error": "Commande non trouvé"}, status=status.HTTP_404_NOT_FOUND)
        serializer = OrderSerializer(order, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Commande mis à jour", "data": serializer.data}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ==========================================
# 3. TICKET GENERATION
# ==========================================

@api_view(['GET'])
@permission_classes([AllowAny])
def generate_ticket_content(request, order_id):
    print(f"  [API] Génération du ticket pour la commande ID: {order_id}")
    try:
        order = get_object_or_404(Order, id=order_id)
    except Exception as e:
        return Response({"detail": f"Commande introuvable: {e}"}, status=status.HTTP_404_NOT_FOUND)

    try:
        ticket_data = format_order_as_ticket(order.id)
        return Response({
            "order_id": order.id,
            "created_at": datetime.now().isoformat(),
            "ticket_content": ticket_data['content'],
            "total": float(order.total_price()),
            "format": ticket_data['format']
        }, status=status.HTTP_200_OK)

    except Exception as e:
        traceback.print_exc()
        return Response({"detail": f"Erreur génération ticket: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def format_order_as_ticket(order_id):
    order = get_object_or_404(Order, id=order_id)
    lines = []
    WIDTH = 42 
    
    # Header
    lines.append("=" * WIDTH)
    lines.append(str(order.restaurant.name).center(WIDTH))
    lines.append("=" * WIDTH)
    lines.append("")
    lines.append(f"Commande N° {order.id}")
    lines.append(f"Date: {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    
    if hasattr(order, 'table') and order.table:
        lines.append(f"Table: {order.table.number}")
    if hasattr(order, 'user') and order.user:
        serveur = order.user.first_name or order.user.username
        lines.append(f"Serveur: {serveur}")
    
    lines.append("")
    lines.append("-" * WIDTH)
    lines.append("ARTICLES".center(WIDTH))
    lines.append("-" * WIDTH)
    lines.append("")
    
    subtotal = 0
    for item in order.items.all():
        if item.menu:
            quantity = item.quantity
            menu_name = item.menu.name[:25]
            if item.solo or item.extra:
                menu_price = float(getattr(item.menu, 'solo_price', 0) or 0)
            else:
                menu_price = float(getattr(item.menu, 'price', 0) or 0)
            item_total = quantity * menu_price
            
            left_part = f"{quantity}x {menu_name}"
            right_part = f"{item_total:.2f} DA"
            spaces = WIDTH - len(left_part) - len(right_part)
            lines.append(left_part + " " * max(1, spaces) + right_part)
            
            for option_item in item.options.all():
                option_name = "Option"
                extra_price = 0
                if hasattr(option_item, 'option'):
                    if hasattr(option_item.option, 'option'):
                        option_name = getattr(option_item.option.option, 'name', 'Option')
                    extra_price = float(getattr(option_item.option, 'extra_price', 0) or 0)
                
                option_line = f"  + {option_name[:25]}"
                option_price = f"{extra_price:.2f} DA"
                spaces = WIDTH - len(option_line) - len(option_price)
                lines.append(option_line + " " * max(1, spaces) + option_price)
                item_total += extra_price
            
            subtotal += item_total
    
    lines.append("")
    lines.append("-" * WIDTH)
    
    total = float(order.total_price())
    left_part = "TOTAL À PAYER:"
    right_part = f"{total:.2f} DA"
    spaces = WIDTH - len(left_part) - len(right_part)
    lines.append(left_part + " " * max(1, spaces) + right_part)
    lines.append("=" * WIDTH)
    lines.append("")
    lines.append("Merci de votre visite !".center(WIDTH))
    lines.append("")
    lines.append("=" * WIDTH)
    lines.append("")
    lines.append("")
    
    return {
        "content": "\n".join(lines),
        "format": "TEXT"
    }

# ==========================================
# 4. KPI & UTILS
# ==========================================

# Dans views.py

# Dans views.py

class KpiView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request, restaurantId):
        from django.db.models import Q 

        # 1. Paramètres existants
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        start_time_str = request.query_params.get('start_time')
        end_time_str = request.query_params.get('end_time')
        
        # --- NOUVEAU : Paramètre Types ---
        # Format attendu : "paid,cancelled"
        types_param = request.query_params.get('types', 'paid') # 'paid' par défaut
        selected_types = types_param.split(',')

        print(f"DEBUG KPI - Types: {selected_types}")

        orders = Order.objects.filter(restaurant_id=restaurantId).prefetch_related(
            'items__menu', 'items__options__option'
        )

        # 2. FILTRE DATE (inchangé)
        if start_date_str and end_date_str:
            try:
                start_datetime = parse_datetime(start_date_str)
                end_datetime = parse_datetime(end_date_str)
                if start_datetime and timezone.is_aware(start_datetime):
                    start_datetime = make_naive(start_datetime)
                if end_datetime and timezone.is_aware(end_datetime):
                    end_datetime = make_naive(end_datetime)
                if start_datetime and end_datetime:
                    orders = orders.filter(created_at__range=(start_datetime, end_datetime))
            except Exception as e:
                print(f"Erreur filtre date: {e}")

        # 3. FILTRE HEURE (inchangé)
        if start_time_str and end_time_str:
            try:
                sh, sm = map(int, start_time_str.split(':'))
                eh, em = map(int, end_time_str.split(':'))
                s_time = time(sh, sm)
                e_time = time(eh, em)
                if s_time <= e_time:
                    orders = orders.filter(created_at__time__range=(s_time, e_time))
                else:
                    orders = orders.filter(Q(created_at__time__gte=s_time) | Q(created_at__time__lte=e_time))
            except Exception as e:
                print(f"Erreur filtre heure: {e}")

        # --- 4. FILTRE PAR TYPE (NOUVEAU) ---
        type_filter = Q()
        
        if 'paid' in selected_types:
            # Payée, non remboursée, non annulée
            type_filter |= Q(paid=True, refund=False, cancelled=False)
            
        if 'unpaid' in selected_types:
            # Non payée, non remboursée, non annulée
            type_filter |= Q(paid=False, refund=False, cancelled=False)
            
        if 'cancelled' in selected_types:
            type_filter |= Q(cancelled=True)
            
        if 'refunded' in selected_types:
            type_filter |= Q(refund=True)
            
        # On applique le filtre combiné
        orders = orders.filter(type_filter)

        # Optimisation : On s'assure que tout est préchargé pour éviter les requêtes N+1 dans la boucle total_price
        orders = orders.select_related('restaurant').prefetch_related(
        'items__menu', 
        'items__options__option' # Assure-toi que ce chemin est correct selon tes models
)
       
        # 5. Calculs KPI (Adaptés aux données filtrées)
        
        # Optimisation : On évalue le QuerySet une seule fois dans une liste
        orders_list = list(orders)
        
        # Calcul du CA selon la logique demandée
        if 'paid' in selected_types:
            # Si le filtre "Payée" est actif, on ne somme QUE les commandes réellement payées
            # (on exclut les montants annulés/remboursés même si sélectionnés)
            total_revenue = sum(o.total_price() for o in orders_list if o.paid and not o.cancelled and not o.refund) or 0
        else:
            # Si "Payée" n'est PAS sélectionné (ex: que Annulée), on somme tout ce qui est affiché
            total_revenue = sum(o.total_price() for o in orders_list) or 0
        
        # Nombre total dans la sélection (inclut tous les types sélectionnés)
        total_orders_count = len(orders_list)
        
        # Panier moyen
        average_cart = (total_revenue / total_orders_count) if total_orders_count > 0 else 0

        # Autres compteurs calculés en Python sur la liste (plus rapide que N requêtes SQL)
        valid_sales_in_selection = len([o for o in orders_list if o.paid and not o.refund and not o.cancelled])
        cancelled_orders_count = len([o for o in orders_list if o.cancelled])
        take_away_count = len([o for o in orders_list if o.take_away])

        context = {
            "total_revenue": total_revenue,
            "total_orders": total_orders_count,
            "average_cart": average_cart,
            "completed_orders": valid_sales_in_selection, 
            "cancelled_orders": cancelled_orders_count, 
            "take_away_count": take_away_count,
        }

        return Response(context)

def generate_order_qr(order_id):
    data = f"ORDER-{order_id}"
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    return qr_base64

@api_view(['GET'])
@permission_classes([AllowAny])
def test_ticket_format(request):
    return Response({"message": "Test OK"})




import csv
from django.http import HttpResponse
from .models import Order

def export_orders_csv(request, restaurant_id):
    # 1. On récupère les mêmes filtres que le Dashboard
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')
    types = request.GET.get('types', 'paid').split(',')

    orders = Order.objects.filter(restaurant_id=restaurant_id)

    if start_date and end_date:
        orders = orders.filter(created_at__range=[start_date, end_date])
    
    if types:
        # On filtre selon le statut (payé, annulé, etc.)
        # Note: Adaptez selon votre logique de filtrage (ex: paid=True)
        pass 

    # 2. Préparation de la réponse CSV
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="extraction_commandes_{restaurant_id}.csv"'
    response.write(u'\ufeff'.encode('utf8')) # Pour le support des accents sous Excel

    writer = csv.writer(response, delimiter=';')
    # En-têtes
    writer.writerow(['ID Commande', 'Date', 'Statut', 'Prix Total', 'Mode Paiement', 'Type'])

    # 3. Remplissage des données
    for order in orders:
        writer.writerow([
            order.id,
            order.created_at.strftime('%d/%m/%Y %H:%M'),
            order.status,
            order.total_price(), # Utilise votre méthode de calcul
            "Cash" if order.cash else "Carte",
            "A emporter" if order.take_away else "Sur place"
        ])

    return response