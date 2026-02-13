# terminal/license_urls.py
# (à placer dans votre app 'terminal' existante)
#
# Dans born_dz/urls.py, ajoutez :
#   path('api/license/', include('terminal.license_urls')),

from django.urls import path
from .views import activate, deactivate, verify, info

urlpatterns = [
    path('activate/',   activate,   name='license-activate'),
    path('deactivate/', deactivate,  name='license-deactivate'),
    path('verify/',     verify,      name='license-verify'),
    path('info/',       info,        name='license-info'),
]