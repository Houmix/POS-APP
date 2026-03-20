# terminal/license_urls.py
# (à placer dans votre app 'terminal' existante)
#
# Dans born_dz/urls.py, ajoutez :
#   path('api/license/', include('terminal.license_urls')),

from django.urls import path
from .views import activate, deactivate, verify, info, restaurant_status, create_or_renew, sync_local

urlpatterns = [
    path('activate/',           activate,           name='license-activate'),
    path('deactivate/',         deactivate,         name='license-deactivate'),
    path('verify/',             verify,             name='license-verify'),
    path('info/',               info,               name='license-info'),
    path('restaurant-status/',  restaurant_status,  name='license-restaurant-status'),
    path('create-or-renew/',    create_or_renew,    name='license-create-or-renew'),
    path('sync-local/',         sync_local,         name='license-sync-local'),
]