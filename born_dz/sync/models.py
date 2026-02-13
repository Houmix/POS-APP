# sync/models.py
# ==========================================
# 🔄 Journal de synchronisation
# ==========================================
# Chaque modification (menu, commande, etc.) est loguée ici.
# Les bornes demandent : "donne-moi tout depuis mon dernier sync"
# et reçoivent les entrées de cette table.

from django.db import models
from restaurant.models import Restaurant


class SyncLog(models.Model):
    """
    Journal centralisé de TOUS les changements à synchroniser.
    Sens : serveur → bornes (menus, options, dispo)
           bornes → serveur (commandes)
    """
    ACTION_CHOICES = [
        ('create', 'Création'),
        ('update', 'Modification'),
        ('delete', 'Suppression'),
    ]
    SOURCE_CHOICES = [
        ('server', 'Serveur / Admin'),
        ('terminal', 'Borne / Terminal'),
    ]

    restaurant = models.ForeignKey(
        Restaurant, on_delete=models.CASCADE,
        related_name='sync_logs', db_index=True
    )
    table_name = models.CharField(max_length=100, db_index=True,
        help_text="Ex: 'menu', 'group_menu', 'option', 'order', 'step', 'step_option'"
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    record_id = models.IntegerField(null=True, blank=True,
        help_text="ID de l'objet concerné dans sa table d'origine"
    )
    data = models.JSONField(default=dict,
        help_text="Snapshot JSON complet de l'objet au moment du changement"
    )
    source = models.CharField(max_length=50, choices=SOURCE_CHOICES, default='server')
    terminal_uuid = models.CharField(max_length=255, blank=True, null=True,
        help_text="UUID de la borne qui a émis le changement (pour éviter de le lui renvoyer)"
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['restaurant', 'created_at']),
            models.Index(fields=['restaurant', 'table_name', 'created_at']),
        ]

    def __str__(self):
        return f"[{self.created_at:%H:%M:%S}] {self.action} {self.table_name}#{self.record_id} ({self.source})"