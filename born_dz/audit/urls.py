# audit/urls.py

from django.urls import path
from . import views

urlpatterns = [
    # Audit Trail
    path('logs/', views.audit_log_list, name='audit-logs'),
    path('stats/', views.audit_stats, name='audit-stats'),

    # Sync Monitoring
    path('sync/monitoring/', views.sync_monitoring, name='sync-monitoring'),
]
