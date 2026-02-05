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

        # --- MODIFICATION ICI ---
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
                take_away=data.get("takeaway", False),
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
        items_count = 0
        
        try:
            for item_data in data.get('items', []):
                # Récupération du menu (code existant...)
                try:
                    menu = Menu.objects.get(id=item_data.get("id") or item_data.get("menu"))
                except Menu.DoesNotExist:
                    continue

                order_item = OrderItem.objects.create(
                    order=order, 
                    menu=menu, 
                    quantity=item_data.get("quantity", 1)
                )

                # --- CORRECTION DE LA LOGIQUE SOLO / EXTRA ---
                # On convertit en chaîne et en minuscule pour être sûr de capter "true", "True", true, 1...
                raw_solo = str(item_data.get("solo", "")).lower()
                raw_extra = str(item_data.get("extra", "")).lower()

                # On vérifie si ça ressemble à du "vrai"
                is_solo = raw_solo in ['true', '1', 'yes']
                is_extra = raw_extra in ['true', '1', 'yes']

                if is_solo:
                    order_item.solo = True
                elif is_extra:
                    order_item.extra = True
                
                order_item.save()
                # ---------------------------------------------

                # Gérer les Options (code existant inchangé...)
                for opt in item_data.get("options", []):
                     # ... votre code existant pour les options ...
                     pass

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
                    if not item.solo and not item.extra:
                        for option_relation in item.options.all():
                            step_option = option_relation.option
                            options.append({
                                "step_name": step_option.step.name,
                                "option_name": step_option.option.name,
                                "option_price": float(step_option.option.extra_price),
                            })

                    order_items.append({
                        "menu_name": f"Extra/Solo {item.menu.name}" if item.solo or item.extra else item.menu.name,
                        "quantity": item.quantity,
                        "solo": item.solo,
                        "extra": item.extra,
                        "composition": options,
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
            menu_price = float(item.menu.price)
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


        # 5. Calculs KPI (Adaptés aux données filtrées)
        # Maintenant, 'orders' contient déjà uniquement ce qu'on veut voir.
        
        # Le CA est la somme des commandes affichées (ex: si on affiche 'cancelled', on voit le montant perdu)
        total_revenue = sum(order.total_price() for order in orders) or 0
        
        # Nombre total dans la sélection
        total_orders_count = orders.count() or 0
        
        # Panier moyen de la sélection
        average_cart = (total_revenue / total_orders_count) if total_orders_count > 0 else 0

        # Pour le taux de succès, on compte combien sont réellement des ventes valides PARMI la sélection
        valid_sales_in_selection = orders.filter(paid=True, refund=False, cancelled=False).count()

        context = {
            "total_revenue": total_revenue,
            "total_orders": total_orders_count,
            "average_cart": average_cart,
            "completed_orders": valid_sales_in_selection, 
            # On garde ces compteurs informatifs s'ils font partie de la sélection
            "cancelled_orders": orders.filter(cancelled=True).count(), 
            "take_away_count": orders.filter(take_away=True).count(),
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