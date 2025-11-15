from django.shortcuts import render,redirect
from django.contrib.auth.forms import UserCreationForm
from .form import SignUpForm, LoginForm,passwordForgetForm,new_passwordForm,ContactUsForm, UserContactUsForm
from django.core.mail import send_mail
from menu.models import GroupMenu, Menu, Step, StepOption
from order.models import Order
from user.models import Employee
from restaurant.models import Restaurant
from django.contrib.auth import login as authLogin, logout as authLogout
# Create your views here.
from user.models import User
from django.http import JsonResponse
from django.utils.dateparse import parse_date
from django.db.models import Sum
from datetime import timedelta
from datetime import datetime
from datetime import date, timedelta

def ConditionsGenerales(request):
    return render(request,"conditions_generales.html")

def index(request):
    if request.method == "POST":
        form = ContactUsForm(request.POST)
        if form.is_valid():

            return redirect('index')  # Redirection après l'envoi du mail 
    else:
        form = ContactUsForm()

        return render(request, "site_vitrine.html", {"form": form})

def signUp(request):
    if request.method == 'POST':
        form=SignUpForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('login')
    else:
        form = SignUpForm()
    return render(request, 'signup.html',{'form':form})
    #return render(request,"signup.html")

def passwordForget(request):
    if request.method=='POST':
        form=passwordForgetForm(request.POST)
        if form.is_valid():
            form.save()
            message="Checkez vos mails"
            return render(request,"passwordForget.html",{'form':form,'message':message})
    else:
        form = passwordForgetForm()
    return render(request,"passwordForget.html",{'form':form})


def new_password(request,token):
    if request.method=='POST':
        form=new_passwordForm(request.POST)
        if form.is_valid():
            form.save()
            user=Employee.objects.get(token=token)
            user.set_password(form.password)#Hash the password
            user.save()
            return redirect('login')
    else:
        form = new_passwordForm()
    return render(request,"new_password.html",{'form':form})



def activate_account(request,token):
    try:
        user=Employee.objects.get(token=token)
        user.is_active=True
        user.save()
        return render(request,"activate.html")
    except Employee.DoesNotExist:
        return render(request,"error.hmtl")

def login(request):
    if request.method == 'POST':
        form=LoginForm(request.POST)
        if form.is_valid():
            user_email = form.cleaned_data['mail']
            user_email = str(user_email).lower()  # Convert email to lowercase
            logged_user = User.objects.get(email=user_email)
            authLogin(request, logged_user) 
            return redirect('userSpace')
    else:
        form = LoginForm()
    return render(request,'login.html',{'form':form})
    #return render(request,"signup.html")

def logout(request):
    authLogout(request)
    return redirect('index')


def userSpace(request):
    user = User.objects.get(id=request.user.id)
    manager = Employee.objects.filter(user=user.id)
    # Récupérer tous les restaurants où l'utilisateur est employé
    restaurants_data = []

    # Obtenir la date de début (lundi) et de fin (dimanche) de la semaine actuelle
    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())  # Lundi de la semaine actuelle
    end_of_week = start_of_week + timedelta(days=6)  # Dimanche de la semaine actuelle

    for emp in manager:
        restaurant = Restaurant.objects.get(id=emp.restaurant.id)

        # Total des commandes pour la semaine actuelle
        orders = restaurant.orders.filter(created_at__date__range=(start_of_week, end_of_week))
        orders_count = orders.count()

        # Total du chiffre d'affaires pour la semaine actuelle
        total_revenue = sum(order.total_price() for order in orders)

        # Menus les plus demandés cette semaine
        menu_items_count = {}
        for order in orders:
            for item in order.items.all():  # suppose qu’il existe un modèle OrderItem relié à Order
                menu_name = item.menu.name if item.menu else "Inconnu"
                menu_items_count[menu_name] = menu_items_count.get(menu_name, 0) + item.quantity

        most_requested_menus = sorted(menu_items_count.items(), key=lambda x: x[1], reverse=True)[:3]

        restaurants_data.append({
            'restaurant': restaurant,
            'orders_count': orders_count,
            'total_revenue': total_revenue,
            'most_requested_menus': most_requested_menus
        })

    context = {
        'user': user,
        'restaurants_data': restaurants_data
    }
    if request.method == "POST":
        form = UserContactUsForm(request.POST)
        if form.is_valid():
            form.clean()
            context['success_message'] = "Votre message a été envoyé avec succès."
    else:
        # Pré-remplir le champ user_id avec l'ID de l'utilisateur connecté
        form = UserContactUsForm(initial={'user_id': request.user.id})
    context['form'] = form
    return render(request, "userSpace.html", context)



def worker(request):
    user_id=request.user.id
    manager = Employee.objects.get(user=user_id)
    restaurant = Restaurant.objects.get(id=manager.restaurant.id)
    employees = Employee.objects.filter(restaurant=restaurant)
    return render(request,"worker.html", {'employees':employees})
def multipleRestaurant(request):
    #Gestion des restaurants multiples pour un employé
    user_id=request.user.id
    restaurants = Employee.objects.get(id=user_id).restaurant_set.all()
    return render(request,"multipleRestaurant.html",{'restaurants':restaurants})
def menu(request):
    #Liste des menus avec ajout,modif,suppression et prévisualisation
    user_id=request.user.id
    user = Employee.objects.get(user=user_id)
    restaurant_id=user.restaurant.id
    restaurant = Restaurant.objects.get(id=restaurant_id)
    if restaurant:
        all_data = []
        groupMenus = GroupMenu.objects.filter(restaurant=restaurant).all()
        for group in groupMenus:
            groupMenu = {
            'group': group,
            'menus': []
            }
            menus = Menu.objects.filter(group_menu=group).all()
            for menu in menus:
                menu_dict = {
                    'menu': menu,
                    'steps': []
                }
                steps = Step.objects.filter(menu=menu).all()
                for step in steps:
                    step_dict = {
                    'step': step,
                    'step_options': []
                    }
                    step_options = StepOption.objects.filter(step=step).all()
                    for step_option in step_options:
                        step_dict['step_options'].append(step_option)
                        menu_dict['steps'].append(step_dict)
            groupMenu['menus'].append(menu_dict)
            all_data.append(groupMenu)
        
        context = {
            'all_data': all_data
        }

        steps = Step.objects.filter(menu__in=menus)
        steps_options = StepOption.objects.filter(step__menu__in=menus)
        groupByGroupMenu={}
        
    return render(request,"admin/base_site.html",context)



def kpi(request):
    user = request.user

    # Récupérer tous les restaurants où l'utilisateur est employé
    employees = Employee.objects.filter(user=user)
    restaurants_data = []

    for employee in employees:
        resto = employee.restaurant
        if not resto:
            continue  # sécurité

        # Total des commandes
        orders = resto.orders.all()
        orders_count = orders.count()

        # Total du chiffre d'affaires
        total_revenue = sum(order.total_price() for order in orders)

        # Menus les plus demandés
        menu_items_count = {}
        for order in orders:
            for item in order.items.all():  # suppose qu’il existe un modèle OrderItem relié à Order
                menu_name = item.menu.name if item.menu else "Inconnu"
                menu_items_count[menu_name] = menu_items_count.get(menu_name, 0) + item.quantity

        most_requested_menus = sorted(menu_items_count.items(), key=lambda x: x[1], reverse=True)[:5]

        # Détails des commandes
        orders_data = []
        for order in orders:
            items_list = []
            for item in order.items.all():
                if item.menu:
                    items_list.append({
                        'name': item.menu.name,
                        'quantity': item.quantity,
                        'price': item.menu.price,
                    })
            orders_data.append({
                'id': order.id,
                'date': order.created_at,
                'status': order.status,
                'total_price': order.total_price(),
                'items': items_list,
            })

        restaurants_data.append({
            'restaurant': resto,
            'orders_count': orders_count,
            'total_revenue': total_revenue,
            'most_requested_menus': most_requested_menus,
            'orders_data': orders_data,
        })

    return render(request,"kpi.html",{'restaurants_data':restaurants_data})


def kpi_revenue_api(request):
    user = request.user
    start = request.GET.get("start")
    end = request.GET.get("end")

    # Conversion des dates
    start_date = datetime.strptime(start, "%Y-%m-%d").date() if start else None
    end_date = datetime.strptime(end, "%Y-%m-%d").date() if end else None

    employees = Employee.objects.filter(user=user)
    results = []

    for emp in employees:
        restaurant = Restaurant.objects.filter(id=emp.restaurant.id).first()
        if not restaurant:
            continue

        orders = restaurant.orders.all()

        # Filtrage par plage de dates si précisée
        if start_date and end_date:
            orders = Order.objects.filter(created_at__date__range=(start_date, end_date))

        # Regrouper le chiffre d'affaires par jour
        daily_revenue = {}
        for order in orders:
            date_str = order.created_at.strftime("%d/%m/%Y")
            total = float(order.total_price()) if hasattr(order, "total_price") else 0
            daily_revenue[date_str] = daily_revenue.get(date_str, 0) + total

        # Trier par date pour l'affichage correct dans le graphique
        sorted_revenue = sorted(daily_revenue.items(), key=lambda x: datetime.strptime(x[0], "%d/%m/%Y"))

        results.append({
            "restaurant": restaurant.name,
            "labels": [d for d, _ in sorted_revenue],
            "data": [t for _, t in sorted_revenue],
        })
        print(results)

    return JsonResponse(results, safe=False)

def kpi_top_menus_api(request):
    start_date = request.GET.get('start')
    end_date = request.GET.get('end')

    if not start_date or not end_date:
        return JsonResponse({'error': 'Missing start or end date'}, status=400)

    start_date = parse_date(start_date)
    end_date = parse_date(end_date) + timedelta(days=1)

    user = request.user
    employees = Employee.objects.filter(user=user)
    restos = [e.restaurant for e in employees]

    orders = Order.objects.filter(
        restaurant__in=restos,
        created_at__range=(start_date, end_date)
    )

    menu_counts = {}
    for order in orders:
        for item in order.items.all():
            if item.menu:
                name = item.menu.name
                menu_counts[name] = menu_counts.get(name, 0) + item.quantity

    sorted_data = sorted(menu_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    labels = [m[0] for m in sorted_data]
    data = [m[1] for m in sorted_data]

    return JsonResponse({'labels': labels, 'data': data})

def order_detail(request, order_id):
    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        return render(request, "errorOrderDetail.html", {"message": "Bon de commande non trouvé."})

    items = []
    for item in order.items.all():
        if item.menu:
            items.append({
                'name': item.menu.name,
                'quantity': item.quantity,
                'price': item.menu.price,
                'total_price': item.quantity * item.menu.price
            })

    context = {
        'order': order,
        'items': items,
        'total_price': order.total_price()
    }
    return render(request, "order_detail.html", context)

