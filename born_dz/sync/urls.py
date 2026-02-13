# sync/urls.py

from django.urls import path
from . import views

urlpatterns = [
    path('health/',         views.health,         name='sync-health'),
    path('snapshot/',       views.snapshot,        name='sync-snapshot'),
    path('push/',           views.push_changes,    name='sync-push'),
    path('pull/',           views.pull_changes,    name='sync-pull'),
    path('apply/',          views.apply_change,    name='sync-apply'),
    path('apply-snapshot/', views.apply_snapshot,  name='sync-apply-snapshot'),
]