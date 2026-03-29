# audit/models.py
# ==========================================
# Audit Trail - Journal d'activite complet
# ==========================================
# Enregistre automatiquement QUI a fait QUOI, QUAND, sur QUEL objet.
# Indispensable pour la tracabilite, la securite et la conformite.

from django.db import models
from django.conf import settings


class AuditLog(models.Model):
    """
    Journal d'audit immutable.
    Chaque action (creation, modification, suppression) sur un objet
    est enregistree avec l'identite de l'utilisateur et les details du changement.
    """
    ACTION_CHOICES = [
        ('create', 'Creation'),
        ('update', 'Modification'),
        ('delete', 'Suppression'),
        ('login', 'Connexion'),
        ('logout', 'Deconnexion'),
        ('sync_push', 'Synchronisation Push'),
        ('sync_pull', 'Synchronisation Pull'),
        ('export', 'Export de donnees'),
    ]

    SEVERITY_CHOICES = [
        ('info', 'Information'),
        ('warning', 'Avertissement'),
        ('critical', 'Critique'),
    ]

    # QUI
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='audit_logs',
        help_text="Utilisateur qui a effectue l'action"
    )
    user_phone = models.CharField(
        max_length=20, blank=True, default='',
        help_text="Telephone de l'utilisateur (sauvegarde si le compte est supprime)"
    )
    user_role = models.CharField(
        max_length=50, blank=True, default='',
        help_text="Role de l'utilisateur au moment de l'action"
    )
    ip_address = models.GenericIPAddressField(
        null=True, blank=True,
        help_text="Adresse IP du client"
    )

    # QUOI
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, db_index=True)
    severity = models.CharField(
        max_length=10, choices=SEVERITY_CHOICES, default='info'
    )
    table_name = models.CharField(
        max_length=100, blank=True, default='',
        db_index=True,
        help_text="Table/modele concerne (ex: menu, order, group_menu)"
    )
    record_id = models.IntegerField(
        null=True, blank=True,
        help_text="ID de l'objet concerne"
    )
    record_name = models.CharField(
        max_length=255, blank=True, default='',
        help_text="Nom lisible de l'objet (ex: 'Classic Burger')"
    )

    # DETAILS
    description = models.TextField(
        blank=True, default='',
        help_text="Description lisible de l'action (ex: 'A modifie le prix de 590 DA a 650 DA')"
    )
    changes = models.JSONField(
        default=dict, blank=True,
        help_text="Dictionnaire des champs modifies : {champ: {old: X, new: Y}}"
    )
    extra_data = models.JSONField(
        default=dict, blank=True,
        help_text="Donnees supplementaires (endpoint, methode HTTP, etc.)"
    )

    # OU
    restaurant_id = models.IntegerField(
        null=True, blank=True, db_index=True,
        help_text="ID du restaurant concerne"
    )

    # QUAND
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['restaurant_id', '-created_at']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['action', '-created_at']),
            models.Index(fields=['table_name', 'record_id']),
        ]
        verbose_name = "Journal d'audit"
        verbose_name_plural = "Journaux d'audit"

    def __str__(self):
        user_display = self.user_phone or 'Systeme'
        return f"[{self.created_at:%d/%m %H:%M}] {user_display} - {self.get_action_display()} {self.table_name} {self.record_name}"


class SyncMetrics(models.Model):
    """
    Metriques de synchronisation par restaurant.
    Permet de monitorer la sante du systeme de sync.
    """
    restaurant_id = models.IntegerField(db_index=True)
    sync_type = models.CharField(max_length=20, choices=[
        ('push', 'Push (terminal vers cloud)'),
        ('pull', 'Pull (cloud vers terminal)'),
        ('snapshot', 'Snapshot complet'),
        ('auto_sync', 'Sync automatique'),
    ])
    terminal_uuid = models.CharField(max_length=255, blank=True, default='')

    # Metriques
    records_count = models.IntegerField(default=0, help_text="Nombre d'enregistrements synchronises")
    errors_count = models.IntegerField(default=0, help_text="Nombre d'erreurs")
    duration_ms = models.IntegerField(default=0, help_text="Duree en millisecondes")
    success = models.BooleanField(default=True)
    error_details = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['restaurant_id', '-created_at']),
            models.Index(fields=['sync_type', '-created_at']),
        ]
        verbose_name = "Metrique de synchronisation"
        verbose_name_plural = "Metriques de synchronisation"

    def __str__(self):
        status = 'OK' if self.success else 'ERREUR'
        return f"[{self.created_at:%d/%m %H:%M}] {self.sync_type} R#{self.restaurant_id} - {self.records_count} enr. ({status})"
