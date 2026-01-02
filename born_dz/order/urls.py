
from django.contrib import admin
from django.urls import path
from .views import * 

urlpatterns = [
    path("api/getPOSorder/<int:restaurant_id>/",POSOrderGet.as_view(), name="api_get_POSorder"),
    path("api/createOrder/<int:card>/",OrderCreate.as_view(), name="api_create_order"),
    path('api/ListOrder/', OrderList.as_view(), name='order-list'),
    path('api/GetOrder/<int:pk>/', OrderDetail.as_view(), name='order-detail'),
    #path('api/Deleteorder/<int:order_id>/', OrderDelete.as_view(), name='order-delete'),
<<<<<<< Updated upstream
    path('api/generateTicket/<int:order_id>/', generate_ticket_content, name='generate_ticket'),
    path('api/Updateorder/<int:order_id>/', OrderUpdate.as_view(), name='order-update')
=======
    path('api/Updateorder/<int:order_id>/', OrderUpdate.as_view(), name='order-update'),
    path('api/kpi/<int:restaurantId>', KpiView.as_view(), name='api_get_kpi'),
>>>>>>> Stashed changes
]

""" urlpatterns = [


   path("api/createOrder/<int:card>/",OrderCreate.as_view(), name="api_create_order"),
    path("api/getOrder/",OrderDetail.as_view(), name="api_get_order_list"),
    path("api/getOrder/<int:pk>/",OrderList.as_view(), name="api_get_order_detail"),
    path("api/updateOrder/",OrderUpdate.as_view(), name="api_update_order"),
    path("api/deleteOrder/<int:pk>",OrderDelete.as_view(), name="api_delete_order"),

    path("api/createCart/",CartCreate.as_view(), name="api_create_cart"),
    path("api/getCart/",CartList.as_view(), name="api_get_cart_detail"),
    path("api/getCart/<int:pk>/",CartDetail.as_view(), name="api_get_cart_list"),
    path("api/updateCart/",CartUpdate.as_view(), name="api_update_cart"),
    path("api/deleteCart/<int:pk>",CartDelete.as_view(), name="api_delete_cart"),

    path("api/createArticleComposition/",ArticleCompositionCreate.as_view(), name="api_create_articleComposition"),
    path("api/getArticleComposition/",ArticleCompositionList.as_view(), name="api_get_articleComposition_list"),
    path("api/getArticleComposition/<int:pk>/",ArticleCompositionDetail.as_view(), name="api_get_articleComposition_detail"),
    path("api/updateArticleComposition/",ArticleCompositionUpdate.as_view(), name="api_update_articleComposition"),
    path("api/deleteArticleComposition/<int:pk>",ArticleCompositionDelete.as_view(), name="api_delete_articleComposition"),

    path("api/createCustomerChoice/",CustomerChoiceCreate.as_view(), name="api_create_customerChoice"),
    path("api/getCustomerChoice/",CustomerChoiceList.as_view(), name="api_get_customerChoice_list"),
    path("api/getCustomerChoice/<int:pk>/",CustomerChoiceDetail.as_view(), name="api_get_customerChoice_detail"),
    path("api/updateCustomerChoice/",CustomerChoiceUpdate.as_view(), name="api_update_customerChoice"),
    path("api/deleteCustomerChoice/<int:pk>",CustomerChoiceDelete.as_view(), name="api_delete_customerChoice"),


]"""