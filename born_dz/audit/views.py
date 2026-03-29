# audit/views.py
# ==========================================
# API endpoints pour l'audit trail et le monitoring
# ==========================================

import json
from datetime import datetime, timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db.models import Count, Avg, Q, Sum
from django.db.models.functions import TruncDate, TruncHour

from .models import AuditLog, SyncMetrics


# ─── AUDIT TRAIL ───

@csrf_exempt
@require_http_methods(["GET"])
def audit_log_list(request):
    """
    Liste des evenements d'audit avec filtres.

    Query params:
        restaurant_id (int)  : filtrer par restaurant
        action (str)         : filtrer par action (create, update, delete, login...)
        table_name (str)     : filtrer par table (menu, order, group_menu...)
        user_phone (str)     : filtrer par telephone utilisateur
        severity (str)       : filtrer par severite (info, warning, critical)
        since (ISO datetime) : evenements depuis cette date
        limit (int)          : nombre max de resultats (defaut: 50, max: 500)
        offset (int)         : pagination offset
    """
    restaurant_id = request.GET.get('restaurant_id')
    action = request.GET.get('action')
    table_name = request.GET.get('table_name')
    user_phone = request.GET.get('user_phone')
    severity = request.GET.get('severity')
    since = request.GET.get('since')
    limit = min(int(request.GET.get('limit', 50)), 500)
    offset = int(request.GET.get('offset', 0))

    qs = AuditLog.objects.all()

    if restaurant_id:
        qs = qs.filter(restaurant_id=int(restaurant_id))
    if action:
        qs = qs.filter(action=action)
    if table_name:
        qs = qs.filter(table_name=table_name)
    if user_phone:
        qs = qs.filter(user_phone__icontains=user_phone)
    if severity:
        qs = qs.filter(severity=severity)
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
            qs = qs.filter(created_at__gte=since_dt)
        except ValueError:
            pass

    total = qs.count()
    logs = qs[offset:offset + limit]

    return JsonResponse({
        'success': True,
        'total': total,
        'offset': offset,
        'limit': limit,
        'results': [
            {
                'id': log.id,
                'action': log.action,
                'severity': log.severity,
                'table_name': log.table_name,
                'record_id': log.record_id,
                'record_name': log.record_name,
                'description': log.description,
                'changes': log.changes,
                'user_phone': log.user_phone,
                'user_role': log.user_role,
                'ip_address': log.ip_address,
                'restaurant_id': log.restaurant_id,
                'created_at': log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ]
    })


@csrf_exempt
@require_http_methods(["GET"])
def audit_stats(request):
    """
    Statistiques d'audit pour le dashboard.

    Query params:
        restaurant_id (int) : filtrer par restaurant
        days (int)          : nombre de jours (defaut: 7)
    """
    restaurant_id = request.GET.get('restaurant_id')
    days = int(request.GET.get('days', 7))
    since = datetime.now() - timedelta(days=days)

    qs = AuditLog.objects.filter(created_at__gte=since)
    if restaurant_id:
        qs = qs.filter(restaurant_id=int(restaurant_id))

    # Actions par type
    actions_by_type = dict(
        qs.values_list('action').annotate(count=Count('id')).values_list('action', 'count')
    )

    # Modifications par table
    changes_by_table = dict(
        qs.exclude(action__in=['login', 'logout'])
        .values_list('table_name').annotate(count=Count('id'))
        .values_list('table_name', 'count')
    )

    # Utilisateurs les plus actifs
    top_users = list(
        qs.exclude(user_phone='').values('user_phone', 'user_role')
        .annotate(count=Count('id'))
        .order_by('-count')[:10]
    )

    # Alertes (warnings + critical)
    alerts_count = qs.filter(severity__in=['warning', 'critical']).count()

    # Activite par jour
    daily_activity = list(
        qs.annotate(date=TruncDate('created_at'))
        .values('date')
        .annotate(count=Count('id'))
        .order_by('date')
        .values('date', 'count')
    )

    return JsonResponse({
        'success': True,
        'period_days': days,
        'total_events': qs.count(),
        'actions_by_type': actions_by_type,
        'changes_by_table': changes_by_table,
        'top_users': top_users,
        'alerts_count': alerts_count,
        'daily_activity': [
            {'date': str(d['date']), 'count': d['count']}
            for d in daily_activity
        ],
    })


# ─── SYNC MONITORING ───

@csrf_exempt
@require_http_methods(["GET"])
def sync_monitoring(request):
    """
    Dashboard de monitoring de la synchronisation.

    Query params:
        restaurant_id (int) : filtrer par restaurant
        hours (int)         : nombre d'heures (defaut: 24)
    """
    restaurant_id = request.GET.get('restaurant_id')
    hours = int(request.GET.get('hours', 24))
    since = datetime.now() - timedelta(hours=hours)

    qs = SyncMetrics.objects.filter(created_at__gte=since)
    if restaurant_id:
        qs = qs.filter(restaurant_id=int(restaurant_id))

    total = qs.count()
    success_count = qs.filter(success=True).count()
    error_count = qs.filter(success=False).count()

    # Metriques par type de sync
    by_type = {}
    for sync_type in ['push', 'pull', 'snapshot', 'auto_sync']:
        type_qs = qs.filter(sync_type=sync_type)
        type_count = type_qs.count()
        if type_count > 0:
            agg = type_qs.aggregate(
                avg_duration=Avg('duration_ms'),
                total_records=Sum('records_count'),
                total_errors=Sum('errors_count'),
            )
            by_type[sync_type] = {
                'count': type_count,
                'success': type_qs.filter(success=True).count(),
                'errors': type_qs.filter(success=False).count(),
                'avg_duration_ms': round(agg['avg_duration'] or 0),
                'total_records': agg['total_records'] or 0,
            }

    # Activite par heure
    hourly = list(
        qs.annotate(hour=TruncHour('created_at'))
        .values('hour')
        .annotate(
            count=Count('id'),
            errors=Count('id', filter=Q(success=False)),
        )
        .order_by('hour')
    )

    # Derniers echecs
    recent_errors = list(
        qs.filter(success=False).order_by('-created_at')[:10]
        .values('sync_type', 'restaurant_id', 'terminal_uuid',
                'error_details', 'created_at')
    )

    return JsonResponse({
        'success': True,
        'period_hours': hours,
        'total_syncs': total,
        'success_count': success_count,
        'error_count': error_count,
        'success_rate': round(success_count / total * 100, 1) if total > 0 else 100,
        'by_type': by_type,
        'hourly_activity': [
            {
                'hour': str(h['hour']),
                'count': h['count'],
                'errors': h['errors'],
            }
            for h in hourly
        ],
        'recent_errors': [
            {
                'sync_type': e['sync_type'],
                'restaurant_id': e['restaurant_id'],
                'terminal_uuid': e['terminal_uuid'],
                'error': e['error_details'][:200],
                'time': e['created_at'].isoformat() if e['created_at'] else None,
            }
            for e in recent_errors
        ],
    })
