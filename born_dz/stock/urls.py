# stock/urls.py

from django.urls import path
from . import views

urlpatterns = [
    # Dashboard
    path('dashboard/', views.stock_dashboard, name='stock-dashboard'),

    # Articles de stock
    path('items/', views.stock_list, name='stock-list'),
    path('items/create/', views.stock_create, name='stock-create'),
    path('items/update/', views.stock_update, name='stock-update'),

    # Mouvements de stock
    path('restock/', views.stock_restock, name='stock-restock'),
    path('adjust/', views.stock_adjust, name='stock-adjust'),
    path('movements/', views.stock_movements, name='stock-movements'),

    # Alertes
    path('alerts/', views.stock_alerts, name='stock-alerts'),

    # Liens menu-stock
    path('links/', views.menu_stock_links, name='stock-links'),
    path('links/create/', views.menu_stock_link_create, name='stock-link-create'),
    path('links/<int:link_id>/delete/', views.menu_stock_link_delete, name='stock-link-delete'),

    # Categories
    path('categories/', views.category_list, name='stock-categories'),
    path('categories/create/', views.category_create, name='stock-category-create'),
]
