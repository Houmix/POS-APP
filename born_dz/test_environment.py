#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script de Test Pre-Build
========================
Vérifie que tous les composants sont prêts avant le build PyInstaller
"""

import sys
import os
import importlib.util
from pathlib import Path

# Couleurs ANSI pour Windows
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_success(msg):
    print(f"{Colors.GREEN}✅ {msg}{Colors.RESET}")

def print_error(msg):
    print(f"{Colors.RED}❌ {msg}{Colors.RESET}")

def print_warning(msg):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.RESET}")

def print_info(msg):
    print(f"{Colors.CYAN}ℹ️  {msg}{Colors.RESET}")

def print_header(msg):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{msg.center(60)}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}\n")

def check_python_version():
    """Vérifie la version de Python"""
    print_header("VÉRIFICATION PYTHON")
    
    version = sys.version_info
    version_str = f"{version.major}.{version.minor}.{version.micro}"
    
    print_info(f"Version Python: {version_str}")
    print_info(f"Exécutable: {sys.executable}")
    
    if version.major == 3 and version.minor >= 8:
        print_success("Version Python compatible (3.8+)")
        return True
    else:
        print_error(f"Python 3.8+ requis, trouvé: {version_str}")
        return False

def check_package(package_name, import_name=None):
    """Vérifie qu'un package Python est installé"""
    if import_name is None:
        import_name = package_name
    
    try:
        spec = importlib.util.find_spec(import_name)
        if spec is not None:
            module = importlib.import_module(import_name)
            version = getattr(module, '__version__', 'version inconnue')
            print_success(f"{package_name}: {version}")
            return True
        else:
            print_error(f"{package_name}: non trouvé")
            return False
    except Exception as e:
        print_error(f"{package_name}: erreur ({str(e)})")
        return False

def check_packages():
    """Vérifie tous les packages requis"""
    print_header("VÉRIFICATION DES PACKAGES")
    
    critical_packages = [
        ('Django', 'django'),
        ('Daphne', 'daphne'),
        ('Twisted', 'twisted'),
        ('Autobahn', 'autobahn'),
        ('Channels', 'channels'),
        ('Zope.Interface', 'zope.interface'),
        ('PyInstaller', 'PyInstaller'),
        ('ASGI Ref', 'asgiref'),
        ('DRF', 'rest_framework'),
        ('Simple JWT', 'rest_framework_simplejwt'),
    ]
    
    optional_packages = [
        ('Automat', 'automat'),
        ('Hyperlink', 'hyperlink'),
        ('Incremental', 'incremental'),
        ('PyASN1', 'pyasn1'),
        ('OpenSSL', 'OpenSSL'),
        ('Attrs', 'attr'),
        ('txaio', 'txaio'),
    ]
    
    results = {'critical': [], 'optional': []}
    
    print_info("Packages critiques:")
    for display_name, import_name in critical_packages:
        if check_package(display_name, import_name):
            results['critical'].append(True)
        else:
            results['critical'].append(False)
    
    print("\n")
    print_info("Packages optionnels:")
    for display_name, import_name in optional_packages:
        if check_package(display_name, import_name):
            results['optional'].append(True)
        else:
            results['optional'].append(False)
    
    return results

def check_twisted_modules():
    """Vérifie les modules Twisted critiques"""
    print_header("VÉRIFICATION MODULES TWISTED")
    
    twisted_modules = [
        'twisted.internet.reactor',
        'twisted.internet.defer',
        'twisted.internet.protocol',
        'twisted.internet.tcp',
        'twisted.internet.ssl',
        'twisted.protocols.basic',
        'twisted.web.server',
        'twisted.web.resource',
        'twisted.python.log',
    ]
    
    all_ok = True
    for module_name in twisted_modules:
        try:
            importlib.import_module(module_name)
            print_success(f"{module_name}")
        except Exception as e:
            print_error(f"{module_name}: {str(e)}")
            all_ok = False
    
    return all_ok

def check_django_setup():
    """Teste que Django peut se configurer"""
    print_header("VÉRIFICATION DJANGO")
    
    try:
        import django
        print_info("Tentative de configuration Django...")
        
        # Essayer de configurer Django
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'born_dz.settings')
        django.setup()
        
        print_success("Django configuré avec succès")
        
        # Vérifier les apps installées
        from django.conf import settings
        print_info(f"Apps installées: {len(settings.INSTALLED_APPS)}")
        
        return True
    except Exception as e:
        print_warning(f"Configuration Django: {str(e)}")
        print_info("Ceci est normal si vous n'êtes pas dans le dossier Django")
        return False

def check_daphne_import():
    """Teste l'import de Daphne"""
    print_header("VÉRIFICATION DAPHNE")
    
    try:
        from daphne.cli import CommandLineInterface
        print_success("Daphne CLI importé avec succès")
        
        from daphne.server import Server
        print_success("Daphne Server importé avec succès")
        
        from daphne.ws_protocol import WebSocketProtocol
        print_success("Daphne WebSocket importé avec succès")
        
        return True
    except Exception as e:
        print_error(f"Import Daphne échoué: {str(e)}")
        return False

def check_files():
    """Vérifie que les fichiers nécessaires existent"""
    print_header("VÉRIFICATION FICHIERS")
    
    current_dir = Path.cwd()
    print_info(f"Dossier actuel: {current_dir}")
    
    required_files = [
        'run_daphne.py',
        'born_dz.spec',
        'requirements.txt',
    ]
    
    all_ok = True
    for filename in required_files:
        filepath = current_dir / filename
        if filepath.exists():
            print_success(f"{filename} trouvé")
        else:
            print_warning(f"{filename} non trouvé")
            all_ok = False
    
    # Vérifier les dossiers
    print("\n")
    print_info("Vérification des dossiers:")
    required_dirs = ['templates', 'static', 'born_dz']
    for dirname in required_dirs:
        dirpath = current_dir / dirname
        if dirpath.exists():
            print_success(f"{dirname}/ trouvé")
        else:
            print_warning(f"{dirname}/ non trouvé")
    
    return all_ok

def test_minimal_daphne():
    """Test minimal de Daphne (sans lancer le serveur)"""
    print_header("TEST MINIMAL DAPHNE")
    
    try:
        from daphne.cli import CommandLineInterface
        cli = CommandLineInterface()
        print_success("Daphne CLI peut être instancié")
        return True
    except Exception as e:
        print_error(f"Test Daphne échoué: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def generate_report(results):
    """Génère un rapport final"""
    print_header("RAPPORT FINAL")
    
    critical_ok = all(results['packages']['critical'])
    optional_ok = all(results['packages']['optional'])
    
    print_info("Résumé:")
    print(f"  Python: {'✅' if results['python'] else '❌'}")
    print(f"  Packages critiques: {'✅' if critical_ok else '❌'}")
    print(f"  Packages optionnels: {'✅' if optional_ok else '⚠️'}")
    print(f"  Modules Twisted: {'✅' if results['twisted'] else '❌'}")
    print(f"  Daphne: {'✅' if results['daphne'] else '❌'}")
    print(f"  Fichiers: {'✅' if results['files'] else '⚠️'}")
    
    print("\n")
    
    if results['python'] and critical_ok and results['twisted'] and results['daphne']:
        print_success("✨ ENVIRONNEMENT PRÊT POUR LE BUILD ✨")
        print_info("Vous pouvez lancer: pyinstaller --clean born_dz.spec")
        return True
    else:
        print_error("❌ ENVIRONNEMENT PAS PRÊT")
        print_info("Corrigez les erreurs ci-dessus avant de continuer")
        
        if not critical_ok:
            print("\n")
            print_warning("Pour installer les packages manquants:")
            print("  pip install -r requirements.txt")
        
        return False

def main():
    """Fonction principale"""
    print(f"\n{Colors.BOLD}{Colors.CYAN}")
    print("╔════════════════════════════════════════════════════════════╗")
    print("║         SCRIPT DE TEST PRE-BUILD PyInstaller               ║")
    print("║              Django + Daphne + Twisted                     ║")
    print("╚════════════════════════════════════════════════════════════╝")
    print(f"{Colors.RESET}\n")
    
    results = {
        'python': False,
        'packages': {'critical': [], 'optional': []},
        'twisted': False,
        'daphne': False,
        'django': False,
        'files': False,
    }
    
    # Exécuter tous les tests
    results['python'] = check_python_version()
    results['packages'] = check_packages()
    results['twisted'] = check_twisted_modules()
    results['daphne'] = check_daphne_import()
    results['django'] = check_django_setup()
    results['files'] = check_files()
    test_minimal_daphne()
    
    # Générer le rapport
    success = generate_report(results)
    
    return 0 if success else 1

if __name__ == '__main__':
    sys.exit(main())