"""
Guard thread-local pour éviter la boucle infinie :
  apply_change() → model.save() → signal → SyncLog → re-pull → infini

Usage :
    with sync_apply_guard():
        Model.objects.update_or_create(...)
    # Dans le signal handler :
    if is_applying_sync():
        return  # skip
"""

import threading

_local = threading.local()


def is_applying_sync() -> bool:
    """Retourne True si on est dans un apply_change() (signal doit être ignoré)."""
    return getattr(_local, 'applying_sync', False)


class sync_apply_guard:
    """Context manager : marque le thread comme 'en cours de sync apply'."""
    def __enter__(self):
        _local.applying_sync = True
        return self

    def __exit__(self, *args):
        _local.applying_sync = False
