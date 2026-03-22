# sync/urls.py

from django.urls import path
from . import views

urlpatterns = [
    path('health/',         views.health,          name='sync-health'),
    path('discover/',       views.discover,        name='sync-discover'),
    path('snapshot/',       views.snapshot,        name='sync-snapshot'),
    path('push/',           views.push_changes,    name='sync-push'),
    path('pull/',           views.pull_changes,    name='sync-pull'),
    path('apply/',          views.apply_change,    name='sync-apply'),
    path('apply-snapshot/', views.apply_snapshot,  name='sync-apply-snapshot'),
    path('force-refresh/',    views.force_refresh,    name='sync-force-refresh'),
    path('export-for-cloud/', views.export_for_cloud, name='sync-export-for-cloud'),
    path('clear-local/',      views.clear_local,      name='sync-clear-local'),
    path('downloads/config/',         views.downloads_config, name='downloads-config'),
    path('downloads/',                views.list_downloads,   name='downloads-list'),
    path('downloads/<str:filename>/', views.download_file,    name='downloads-file'),
]