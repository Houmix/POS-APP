
import os
import sys

# Configurer les variables d'environnement Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'born_dz.settings')

# Ajouter le répertoire de base au path
if hasattr(sys, '_MEIPASS'):
    # Mode PyInstaller
    sys.path.insert(0, sys._MEIPASS)
