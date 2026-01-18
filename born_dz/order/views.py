from django.shortcuts import render
from restaurant.models import Restaurant
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import RetrieveAPIView
from .serializers import OrderSerializer, OrderItemOption, OrderItem
from .models import Order
from customer.models import Loyalty
from menu.models import Menu, Step, Option, StepOption
from rest_framework.permissions import IsAuthenticated
from datetime import timedelta
from django.utils.timezone import now, timedelta
from django.shortcuts import get_object_or_404
from datetime import datetime
# Create your views here.

class OrderCreate(APIView):
    permission_classes = []
    authentication_classes = []
    
    def post(self, request, card):
        print("\n" + "="*50)
        print("🔵 DÉBUT CREATE ORDER")
        print("="*50)
        
        data = request.data
        user = data.get("user")
        card = bool(card)
        
        # 🔍 DEBUG: Afficher TOUTES les données reçues
        print(f"\n📦 DONNÉES REÇUES:")
        print(f"   - user: {user} (type: {type(user)})")
        print(f"   - restaurant (brut): {data.get('restaurant')} (type: {type(data.get('restaurant'))})")
        print(f"   - items: {data.get('items')}")
        print(f"   - card: {card}")
        print(f"   - takeaway: {data.get('takeaway')}")
        print(f"\n📋 DATA complet: {data}")
        
        # 🔍 Tenter de convertir le restaurant ID
        restaurant_raw = data.get("restaurant")
        print(f"\n🔍 Restaurant ID (brut): '{restaurant_raw}'")
        print(f"   Type: {type(restaurant_raw)}")
        
        try:
            restaurant_id = int(restaurant_raw)
            print(f"✅ Conversion réussie: {restaurant_id}")
        except (ValueError, TypeError) as e:
            print(f"❌ ERREUR de conversion: {e}")
            return Response(
                {
                    "error": "Restaurant ID invalide",
                    "details": f"Impossible de convertir '{restaurant_raw}' en entier",
                    "received_data": str(data)
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 🔍 Vérifier que le restaurant existe
        print(f"\n🔍 Recherche du restaurant avec ID={restaurant_id}...")
        
        try:
            restaurant = Restaurant.objects.get(id=restaurant_id)
            print(f"✅ Restaurant trouvé: {restaurant}")
            print("📍 Checkpoint: la")  # TON CHECKPOINT
            
        except Restaurant.DoesNotExist:
            print(f"❌ Restaurant ID={restaurant_id} INTROUVABLE dans la base")
            
            # Lister tous les restaurants disponibles
            all_restaurants = Restaurant.objects.all()
            print(f"\n📋 Restaurants disponibles dans la base:")
            for r in all_restaurants:
                print(f"   - ID: {r.id}, Nom: {r.name if hasattr(r, 'name') else 'N/A'}")
            
            return Response(
                {
                    "error": "Restaurant introuvable",
                    "details": f"Aucun restaurant avec l'ID {restaurant_id}",
                    "available_restaurants": [{"id": r.id, "name": getattr(r, 'name', 'N/A')} for r in all_restaurants]
                },
                status=status.HTTP_404_NOT_FOUND
            )
        
        except Exception as e:
            print(f"❌ ERREUR inattendue lors de la recherche du restaurant: {e}")
            return Response(
                {
                    "error": "Erreur lors de la recherche du restaurant",
                    "details": str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Créer la commande
        print(f"\n🔵 Création de la commande...")
        try:
            order = Order.objects.create(
                user=user if (user and user != {} and user != 0) else None, 
                cash=card,
                restaurant=restaurant, 
                take_away=data.get("takeaway", False)
            )
            print(f"✅ Commande créée: ID={order.id}")
            
        except Exception as e:
            print(f"❌ ERREUR lors de la création de la commande: {e}")
            return Response(
                {
                    "error": "Erreur lors de la création de la commande",
                    "details": str(e)
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Gérer les points de fidélité
        if user and user != {} and user != 0:
            try:
                print(f"\n🎯 Ajout des points de fidélité pour user={user}")
                loyalty, created = Loyalty.objects.get_or_create(
                    user=user, 
                    restaurant=restaurant
                )
                loyalty.point += order.total_price()
                loyalty.save()
                print(f"✅ Points ajoutés: {order.total_price()}")
            except Exception as loyalty_error:
                print(f"⚠️ Erreur fidélité (non bloquante): {loyalty_error}")
        
        # Ajouter les items
        print(f"\n🔵 Ajout des items...")
        items_count = 0
        
        try:
            for item_data in data.get('items', []):
                try:
                    menu = Menu.objects.get(id=item_data["menu"])
                    order_item = OrderItem.objects.create(
                        order=order, 
                        menu=menu, 
                        quantity=item_data.get("quantity", 1)
                    )
                    items_count += 1
                    print(f"   ✅ Item {items_count}: Menu ID={menu.id}, Qté={item_data.get('quantity', 1)}")
                    
                    # Gérer les options
                    if item_data.get("solo") == True:
                        order_item.solo = True
                        order_item.save()
                        print(f"      → Solo activé")
                    elif item_data.get("extra") == True:
                        order_item.extra = True
                        order_item.save()
                        print(f"      → Extra activé")
                    else:
                        for opt in item_data.get("options", []):
                            try:
                                step = Step.objects.get(id=opt["step"])
                                option = StepOption.objects.get(id=opt["option"])
                                OrderItemOption.objects.create(
                                    order_item=order_item, 
                                    option=option
                                )
                                print(f"      → Option ajoutée: Step={step.id}, Option={option.id}")
                            except (Step.DoesNotExist, StepOption.DoesNotExist) as opt_error:
                                print(f"      ⚠️ Option ignorée: {opt_error}")
                
                except Menu.DoesNotExist:
                    print(f"   ⚠️ Menu {item_data.get('menu')} introuvable, item ignoré")
                    continue
            
            print(f"✅ {items_count} item(s) ajouté(s)")
            
        except Exception as items_error:
            print(f"❌ Erreur lors de l'ajout des items: {items_error}")
            order.delete()
            return Response(
                {
                    "error": "Erreur lors de l'ajout des items",
                    "details": str(items_error)
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Générer le ticket
        print(f"\n🔵 Génération du ticket...")
        try:
            generate_ticket_content(request, order.id)
            qr_code = generate_order_qr(order.id)
            print(f"✅ Ticket généré")
        except Exception as ticket_error:
            print(f"⚠️ Erreur ticket (non bloquante): {ticket_error}")
            qr_code = None
        
        print("\n" + "="*50)
        print(f"✅ COMMANDE CRÉÉE AVEC SUCCÈS - ID: {order.id}")
        print("="*50 + "\n")
        
        return Response(
            {
                "message": "Commande créée avec succès", 
                "order_id": order.id, 
                "qr_code_base64": qr_code
            }, 
            status=status.HTTP_201_CREATED
        )
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
        # Limite aux commandes de l'utilisateur connecté
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
            
            # Filtrer les commandes de moins de 24 heures
            orders = Order.objects.filter(restaurant=restaurant_id).prefetch_related(
                'items__menu',
                'items__options__option__step'
            )
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
# order/views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from datetime import datetime
from .models import Order

@api_view(['GET'])
@permission_classes([AllowAny])
def generate_ticket_content(request, order_id):
    """
    Récupère une commande par son ID, génère le contenu du ticket
    et le retourne à la borne.
    """
    print(f"📡 [API] Génération du ticket pour la commande ID: {order_id}")
    
    try:
        # Récupérer la commande
        order = get_object_or_404(Order, id=order_id)
        print(f"✅ [API] Commande trouvée: #{order.id}")
        
    except Exception as e:
        print(f"❌ [API] Erreur récupération commande: {e}")
        return Response(
            {"detail": f"Commande introuvable: {e}"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Génération du contenu
    try:
        print(f"🎨 [API] Formatage du ticket...")
        
        ticket_data = format_order_as_ticket(order.id)
        
        print(f"✅ [API] Ticket généré ({len(ticket_data['content'])} caractères)")
        
        # Retourner le contenu formaté
        return Response({
            "order_id": order.id,
            "created_at": datetime.now().isoformat(),
            "ticket_content": ticket_data['content'],
            "total": float(order.total_price()),
            "format": ticket_data['format']
        }, status=status.HTTP_200_OK)

    except Exception as e:
        print(f"❌ [API] Erreur génération ticket: {e}")
        import traceback
        traceback.print_exc()  # Afficher la stack trace complète
        
        return Response(
            {"detail": f"Erreur génération ticket: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


def format_order_as_ticket(order_id):
    """
    Formate une commande en ticket texte brut pour imprimante POS 80mm
    Largeur : 42 caractères max
    """
    order = get_object_or_404(Order, id=order_id)
    lines = []
    
    WIDTH = 42  # Largeur pour POS 80mm
    
    # ==========================================
    # EN-TÊTE
    # ==========================================
    lines.append("=" * WIDTH)
    lines.append("       RESTAURANT LA BELLE VIE".center(WIDTH))
    lines.append("=" * WIDTH)
    lines.append("")
    
    # ==========================================
    # INFORMATIONS COMMANDE
    # ==========================================
    lines.append(f"Commande N° {order.id}")
    lines.append(f"Date: {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    
    # Table (si disponible)
    if hasattr(order, 'table') and order.table:
        lines.append(f"Table: {order.table.number}")
    
    # Serveur (si disponible)
    if hasattr(order, 'user') and order.user:
        serveur = order.user.first_name or order.user.username
        lines.append(f"Serveur: {serveur}")
    
    lines.append("")
    lines.append("-" * WIDTH)
    lines.append("ARTICLES".center(WIDTH))
    lines.append("-" * WIDTH)
    lines.append("")
    
    # ==========================================
    # ARTICLES
    # ==========================================
    subtotal = 0
    
    for item in order.items.all():
        if item.menu:
            # Ligne principale du menu
            quantity = item.quantity
            menu_name = item.menu.name[:25]  # Tronquer si trop long
            menu_price = float(item.menu.price)
            item_total = quantity * menu_price
            
            # Format: "2x Pizza Margherita        24.00 DA"
            left_part = f"{quantity}x {menu_name}"
            right_part = f"{item_total:.2f} DA"
            spaces = WIDTH - len(left_part) - len(right_part)
            
            lines.append(left_part + " " * max(1, spaces) + right_part)
            
            # Options/Suppléments
            for option_item in item.options.all():
                option_name = "Option"
                extra_price = 0
                
                # Récupérer le nom et prix de l'option
                if hasattr(option_item, 'option'):
                    if hasattr(option_item.option, 'option'):
                        option_name = getattr(option_item.option.option, 'name', 'Option')
                    
                    extra_price = float(getattr(option_item.option, 'extra_price', 0) or 0)
                
                # Format: "  + Fromage                  2.00 DA"
                option_line = f"  + {option_name[:25]}"
                option_price = f"{extra_price:.2f} DA"
                spaces = WIDTH - len(option_line) - len(option_price)
                
                lines.append(option_line + " " * max(1, spaces) + option_price)
                
                item_total += extra_price
            
            subtotal += item_total
    
    lines.append("")
    lines.append("-" * WIDTH)
    
    # ==========================================
    # TOTAUX
    # ==========================================
    
    # Sous-total
    left_part = "SOUS-TOTAL:"
    right_part = f"{subtotal:.2f} DA"
    spaces = WIDTH - len(left_part) - len(right_part)
    lines.append(left_part + " " * max(1, spaces) + right_part)
    
    # TVA (si applicable)
    # Décommentez si vous avez de la TVA
    # tax_rate = 0.19  # 19%
    # tax_amount = subtotal * tax_rate
    # left_part = "TVA (19%):"
    # right_part = f"{tax_amount:.2f} DA"
    # spaces = WIDTH - len(left_part) - len(right_part)
    # lines.append(left_part + " " * max(1, spaces) + right_part)
    
    lines.append("-" * WIDTH)
    
    # Total final
    total = float(order.total_price())
    left_part = "TOTAL À PAYER:"
    right_part = f"{total:.2f} DA"
    spaces = WIDTH - len(left_part) - len(right_part)
    lines.append(left_part + " " * max(1, spaces) + right_part)
    
    lines.append("=" * WIDTH)
    
    # ==========================================
    # PIED DE PAGE
    # ==========================================
    lines.append("")
    lines.append("Merci de votre visite !".center(WIDTH))
    lines.append("À bientôt !".center(WIDTH))
    lines.append("")
    lines.append("=" * WIDTH)
    lines.append("")
    lines.append("")  # Espace pour coupe papier
    
    # Joindre toutes les lignes
    content = "\n".join(lines)
    
    print(f"📄 [FORMAT] Ticket généré: {len(lines)} lignes, {len(content)} caractères")
    
    return {
        "content": content,
        "format": "TEXT"
    }


# ==========================================
# 🧪 FONCTION DE TEST (OPTIONNELLE)
# ==========================================
@api_view(['GET'])
@permission_classes([AllowAny])
def test_ticket_format(request):
    """
    Endpoint de test pour vérifier le formatage sans commande réelle
    URL: /order/api/test-ticket/
    """
    lines = []
    WIDTH = 42
    
    lines.append("=" * WIDTH)
    lines.append("TEST IMPRESSION".center(WIDTH))
    lines.append("=" * WIDTH)
    lines.append("")
    lines.append(f"Date: {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    lines.append("")
    lines.append("-" * WIDTH)
    
    # Exemple d'articles
    left = "1x Pizza Margherita"
    right = "12.00 DA"
    spaces = WIDTH - len(left) - len(right)
    lines.append(left + " " * spaces + right)
    
    left = "2x Coca-Cola"
    right = "5.00 DA"
    spaces = WIDTH - len(left) - len(right)
    lines.append(left + " " * spaces + right)
    
    lines.append("")
    lines.append("-" * WIDTH)
    
    left = "TOTAL:"
    right = "17.00 DA"
    spaces = WIDTH - len(left) - len(right)
    lines.append(left + " " * spaces + right)
    
    lines.append("=" * WIDTH)
    lines.append("")
    lines.append("Merci !".center(WIDTH))
    lines.append("")
    
    content = "\n".join(lines)
    
    return Response({
        "ticket_content": content,
        "format": "TEXT",
        "line_count": len(lines),
        "char_count": len(content)
    })


from django.db.models import Sum, Count, F
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Order

class KpiView(APIView):
    def get(self, request, restaurantId):
        orders = Order.objects.filter(id=restaurantId) # Filtre par resto
        
        # On calcule le CA manuellement ou via une annotation complexe
        # Ici une boucle simple (optimisable avec Sum sur les OrderItems)
        total_revenue = sum(order.total_price() for order in orders.filter(paid=True))
        total_orders = orders.count()
        
        context = {
            "total_revenue": total_revenue,
            "total_orders": total_orders,
            "average_cart": total_revenue / total_orders if total_orders > 0 else 0,
            "completed_orders": orders.filter(status='completed').count(),
            "cancelled_orders": orders.filter(status='cancelled').count(),
            "take_away_count": orders.filter(take_away=True).count(),
        }
        return Response(context)


import qrcode
import io
import base64

def generate_order_qr(order_id):
    # Les données que tu veux mettre dans le QR (ex: ID commande ou URL)
    data = f"ORDER-{order_id}"
    
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    
    # On sauvegarde l'image en mémoire pour la transformer en base64
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return qr_base64