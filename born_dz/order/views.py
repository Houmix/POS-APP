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
# Create your views here.

class OrderCreate(APIView):
    permission_classes = []
    authentication_classes = []

    def post(self, request, card):
        
        data = request.data
        user = data.get("user")
        card = bool(card)
        
        try:
            
            restaurant = Restaurant.objects.get(id=int(data.get("restaurant")))
            order = Order.objects.create(user=user if (user!={} and user!=0) else None, cash=card,restaurant=restaurant, take_away=data.get("takeaway", False))
            if not(user!={} or user!=0):
                loyalty = Loyalty.objects.get_or_create(user=user, restaurant=restaurant)
            # Ajouter des points de fidélité à la commande
                loyalty.point += order.total_price()
                loyalty.save()
            print("here")
        except Exception as e:
            return Response({"error": "Erreur lors de la création de la commande (Order.objects...)", "details": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        for item_data in data.get('items', []):
            menu = Menu.objects.get(id=item_data["menu"])
            order_item = OrderItem.objects.create(order=order, menu=menu, quantity=item_data.get("quantity", 1))
            if item_data.get("solo") == True:
                order_item.solo = True
                order_item.save()
            elif item_data.get("extra") == True:
                order_item.extra = True
                order_item.save()
            else:
                for opt in item_data.get("options", []):
                    step = Step.objects.get(id=opt["step"])
                    option = StepOption.objects.get(id=opt["option"])
                    OrderItemOption.objects.create(order_item=order_item, option=option)

        return Response({"message": "Commande créée avec succès", "order_id": order.id}, status=201)


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

