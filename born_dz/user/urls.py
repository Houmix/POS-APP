
from django.contrib import admin # type: ignore
from django.urls import path, include # type: ignore
from .views import *
from rest_framework_simplejwt import views as jwt_views # type: ignore


urlpatterns = [
    #path("api/createEmployee/",EmployeeCreate.as_view(), name="api_create_user"),
    #path("api/getEmployee/",Employeelist.as_view(), name="api_get_user_list"),
    #path("api/getEmployee/<int:pk>/",EmployeeDetail.as_view(), name="api_get_user_detail"),
    #path("api/updateEmployee/",EmployeeUpdate.as_view(), name="api_update_user"),
    #path("api/deleteEmployee/<int:pk>/",EmployeeDelete.as_view(), name="api_delete_user"),
    path("api/getEmployee/",EmployeeLogin.as_view(), name="api_get_user"),

    path('api/create_token/', jwt_views.TokenObtainPairView.as_view(), name='api_create_token'), 
    path('api/user/token/<str:phone>', UserTokenView.as_view(), name='customer_token_obtain'),
    path('api/employee/token/', EmployeeTokenView.as_view(), name='employee_token_obtain'),


    path("api/createCustomer/", UserCreate.as_view(), name="api_create"),
    path("api/getUser/<str:phone>/", UserDetail.as_view(), name="api_get"), 
    #path("api/getCustomer/", CustomerLIST.as_view(), name="api_list"),
    #path("api/updateCustomer/", UserUpdate.as_view(), name="api_update"),
    #path("api/deleteCustomer/<int:pk>/", UserDelete.as_view(), name="api_delete"),
]