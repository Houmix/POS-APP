# audit/versioning.py
# ==========================================
# Systeme de versioning pour la resolution de conflits
# ==========================================
# Quand deux terminaux modifient le meme objet en meme temps,
# le systeme detecte le conflit via le numero de version
# et applique une strategie "last-write-wins" avec alerte.

import logging
from django.db.models.signals import pre_save
from django.dispatch import receiver

logger = logging.getLogger('audit')


def check_version_conflict(model_class, instance_id, incoming_version):
    """
    Verifie s'il y a un conflit de version.

    Retourne:
        (has_conflict, current_version)
        - has_conflict: True si la version entrante est inferieure a la version actuelle
        - current_version: version actuelle en base
    """
    try:
        current = model_class.objects.filter(pk=instance_id).values_list('version', flat=True).first()
        if current is None:
            return False, 0  # Objet n'existe pas encore
        if incoming_version < current:
            return True, current  # Conflit detecte
        return False, current
    except Exception:
        return False, 0


def resolve_conflict(model_class, instance_id, incoming_data, incoming_version,
                     strategy='last_write_wins'):
    """
    Resout un conflit de version.

    Strategies:
        - 'last_write_wins': La derniere modification gagne (defaut)
        - 'server_wins': Le serveur a toujours raison
        - 'reject': Rejette la modification conflictuelle

    Retourne:
        (should_apply, message)
    """
    has_conflict, current_version = check_version_conflict(
        model_class, instance_id, incoming_version
    )

    if not has_conflict:
        return True, None

    if strategy == 'reject':
        msg = (f"Conflit de version sur {model_class.__name__}#{instance_id}: "
               f"version entrante {incoming_version} < actuelle {current_version}. Rejete.")
        logger.warning(msg)
        return False, msg

    if strategy == 'server_wins':
        msg = (f"Conflit de version sur {model_class.__name__}#{instance_id}: "
               f"version serveur {current_version} conservee (incoming: {incoming_version}).")
        logger.info(msg)
        return False, msg

    # last_write_wins (defaut)
    msg = (f"Conflit de version sur {model_class.__name__}#{instance_id}: "
           f"version {incoming_version} < {current_version}. Last-write-wins applique.")
    logger.warning(msg)

    # Enregistrer le conflit dans l'audit trail
    try:
        from .models import AuditLog
        AuditLog.objects.create(
            action='update',
            severity='warning',
            table_name=model_class.__name__.lower(),
            record_id=instance_id,
            description=msg,
            changes={
                '_conflict': {
                    'incoming_version': incoming_version,
                    'current_version': current_version,
                    'strategy': strategy,
                }
            },
        )
    except Exception:
        pass

    return True, msg


def auto_increment_version(sender, instance, **kwargs):
    """
    Signal pre_save : incremente automatiquement la version
    a chaque modification d'un objet versionne.
    """
    if not hasattr(instance, 'version'):
        return
    if instance.pk:
        # Modification d'un objet existant
        try:
            current = sender.objects.filter(pk=instance.pk).values_list('version', flat=True).first()
            if current is not None:
                instance.version = current + 1
        except Exception:
            pass
    # Pour les nouveaux objets, version reste a 1 (defaut)


def register_versioning_signals():
    """Connecte le signal d'auto-increment sur les modeles versionnes."""
    from menu.models import GroupMenu, Menu, Option

    versioned_models = [GroupMenu, Menu, Option]

    for model in versioned_models:
        pre_save.connect(
            auto_increment_version,
            sender=model,
            dispatch_uid=f'version_increment_{model.__name__}'
        )

    logger.info("Versioning : auto-increment enregistre sur %d modeles", len(versioned_models))


# Auto-register
register_versioning_signals()
