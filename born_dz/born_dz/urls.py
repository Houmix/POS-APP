"""
URL configuration for born_dz project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from restaurant.views import KioskConfigView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("customer/",include('customer.urls')),
    path("website/",include('website.urls')),
    path('',include("website.urls")),
    path('restaurant/', include("restaurant.urls")),

    path('user/', include("user.urls")),
    path('order/', include("order.urls")),
    path('menu/', include("menu.urls")),

    # Sync
    path('api/sync/', include('sync.urls')),
    
    # Licence
    path('api/license/', include('terminal.urls')),

    # Kiosk config
    path('api/kiosk/config/', KioskConfigView.as_view(), name='kiosk_config'),
]
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)