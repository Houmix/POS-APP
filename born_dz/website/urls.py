from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name="index"),
    path('login/',views.login,name="login"),
    path('logout/',views.login,name="logout"),
    path('signUp/',views.signUp,name="signUp"),
    path('passwordForget/',views.passwordForget,name="passwordForget"),
    path('new_password/',views.new_password,name="new_password"),
    path('activate/<str:token>',views.activate_account, name="activate_account"),
    path('ConditionsGenerales',views.ConditionsGenerales, name="ConditionsGenerales"),
    path('userSpace/',views.userSpace, name="userSpace"),
    path('worker/',views.worker, name="Worker"),
    path('menu/',views.menu, name="Menu"),
    path('KPI/',views.kpi, name="KPI"),
    path('api1/', views.kpi_revenue_api, name='kpi_revenue_api'),
    path('api2/', views.kpi_top_menus_api, name='kpi_top_menus_api'),
    path('OrderDetail/<int:order_id>/', views.order_detail, name='OrderDetail'),
    path('kiosk-config/', views.kiosk_config_view, name='kiosk_config'),
]