# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all, collect_submodules
import os

# ========================================
# CONFIGURATION DES CHEMINS
# ========================================
# NOTE: Remplacez ce chemin par le chemin absolu de votre projet
BASE_DIR = r'C:\Users\HoumameLachache\Documents\POS-APP\born_dz'

# Liste des apps Django
DJANGO_APPS = [
    'user', 'chain', 'customer', 'KDS', 'manager', 'media',
    'menu', 'order', 'POS', 'restaurant', 'terminal', 'website'
]

# ========================================
# DONNÉES À INCLURE
# ========================================
datas = [
    (os.path.join(BASE_DIR, 'born_dz'), 'born_dz'),
    (os.path.join(BASE_DIR, 'templates'), 'templates'),
]

# Ajouter toutes les apps Django
for app in DJANGO_APPS:
    app_path = os.path.join(BASE_DIR, app)
    if os.path.exists(app_path):
        datas.append((app_path, app))

# Ajouter static si existe
static_path = os.path.join(BASE_DIR, 'static')
if os.path.exists(static_path):
    datas.append((static_path, 'static'))

# Ajouter la base de données si existe
db_path = os.path.join(BASE_DIR, 'db.sqlite3')
if os.path.exists(db_path):
    datas.append((db_path, '.'))

# Ajouter settings.json si existe
settings_json = os.path.join(BASE_DIR, 'settings.json')
if os.path.exists(settings_json):
    datas.append((settings_json, '.'))

# ========================================
# BINAIRES
# ========================================
binaries = []

# ========================================
# HIDDEN IMPORTS - CRITIQUE POUR DAPHNE
# ========================================
hiddenimports = [
    # ===== Django Core =====
    'django',
    'django.core.handlers.asgi',
    'django.core.handlers.wsgi',
    'django.template.loaders.app_directories',
    'django.template.loaders.filesystem',
    'django.contrib.sessions.serializers',
    'django.contrib.staticfiles',
    'django.contrib.auth.hashers',
    
    # ===== Daphne & ASGI =====
    'daphne',
    'daphne.cli',
    'daphne.server',
    'daphne.ws_protocol',
    'daphne.http_protocol',
    
    # ===== Channels =====
    'channels',
    'channels.layers',
    'channels.routing',
    'channels.auth',
    
    # ===== Twisted (ESSENTIEL pour Daphne) =====
    'twisted',
    'twisted.internet',
    'twisted.internet.defer',
    'twisted.internet.protocol',
    'twisted.internet.reactor',
    'twisted.internet.selectreactor',
    'twisted.internet.ssl',
    'twisted.internet.tcp',
    'twisted.internet.endpoints',
    'twisted.internet.base',
    'twisted.internet.task',
    'twisted.protocols',
    'twisted.protocols.basic',
    'twisted.protocols.tls',
    'twisted.web',
    'twisted.web.server',
    'twisted.web.resource',
    'twisted.web.http',
    'twisted.web.websocket',
    'twisted.python',
    'twisted.python.log',
    'twisted.python.failure',
    'twisted.logger',
    
    # ===== Autobahn (WebSocket) =====
    'autobahn',
    'autobahn.twisted',
    'autobahn.twisted.websocket',
    'autobahn.twisted.resource',
    'autobahn.websocket',
    'autobahn.websocket.protocol',
    'autobahn.websocket.compress',
    
    # ===== Zope Interface (requis par Twisted) =====
    'zope',
    'zope.interface',
    'zope.interface.adapter',
    'zope.interface.declarations',
    'zope.interface.interface',
    'zope.interface.registry',
    
    # ===== Incremental (requis par Twisted) =====
    'incremental',
    
    # ===== Automat (requis par Twisted) =====
    'automat',
    'automat._core',
    'automat._methodical',
    
    # ===== Hyperlink (requis par Twisted) =====
    'hyperlink',
    
    # ===== Constantly (requis par Twisted) =====
    'constantly',
    
    # ===== PyASN1 (requis pour SSL/TLS) =====
    'pyasn1',
    'pyasn1.codec',
    'pyasn1.codec.der',
    'pyasn1.codec.der.decoder',
    'pyasn1.codec.der.encoder',
    'pyasn1.type',
    'pyasn1_modules',
    
    # ===== OpenSSL =====
    'OpenSSL',
    'OpenSSL.SSL',
    'OpenSSL.crypto',
    
    # ===== Service Identity (SSL) =====
    'service_identity',
    'service_identity.pyopenssl',
    
    # ===== Attrs (requis par Twisted) =====
    'attr',
    'attrs',
    
    # ===== txaio (requis par Autobahn) =====
    'txaio',
    'txaio.tx',
    
    # ===== ASGI Common =====
    'asgiref',
    'asgiref.sync',
    'asgiref.server',
    
    # ===== Django REST Framework =====
    'rest_framework',
    'rest_framework.authentication',
    'rest_framework.permissions',
    'rest_framework.renderers',
    'rest_framework.parsers',
    
    # ===== Simple JWT =====
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.tokens',
    'rest_framework_simplejwt.authentication',
    
    # ===== CORS Headers =====
    'corsheaders',
    
    # ===== Autres dépendances =====
    'PIL',
    'PIL._imaging',
    'qrcode',
    'psycopg',
    'psycopg2',
]

# ========================================
# COLLECTER TOUS LES SOUS-MODULES
# ========================================
# Django
tmp_ret = collect_all('django')
datas += tmp_ret[0]
binaries += tmp_ret[1]
hiddenimports += tmp_ret[2]

# Daphne
tmp_ret = collect_all('daphne')
datas += tmp_ret[0]
binaries += tmp_ret[1]
hiddenimports += tmp_ret[2]

# Channels
tmp_ret = collect_all('channels')
datas += tmp_ret[0]
binaries += tmp_ret[1]
hiddenimports += tmp_ret[2]

# Twisted (CRITIQUE)
tmp_ret = collect_all('twisted')
datas += tmp_ret[0]
binaries += tmp_ret[1]
hiddenimports += tmp_ret[2]

# Autobahn
tmp_ret = collect_all('autobahn')
datas += tmp_ret[0]
binaries += tmp_ret[1]
hiddenimports += tmp_ret[2]

# Zope Interface
tmp_ret = collect_all('zope.interface')
datas += tmp_ret[0]
binaries += tmp_ret[1]
hiddenimports += tmp_ret[2]

# Automat
tmp_ret = collect_all('automat')
datas += tmp_ret[0]
binaries += tmp_ret[1]
hiddenimports += tmp_ret[2]

# ========================================
# RUNTIME HOOKS
# ========================================
# Créer un runtime hook pour Django
runtime_hooks_dir = os.path.join(BASE_DIR, 'pyinstaller_hooks')
os.makedirs(runtime_hooks_dir, exist_ok=True)

runtime_hook_path = os.path.join(runtime_hooks_dir, 'django_runtime_hook.py')
runtime_hook_content = '''
import os
import sys

# Configurer les variables d'environnement Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'born_dz.settings')

# Ajouter le répertoire de base au path
if hasattr(sys, '_MEIPASS'):
    # Mode PyInstaller
    sys.path.insert(0, sys._MEIPASS)
'''

with open(runtime_hook_path, 'w', encoding='utf-8') as f:
    f.write(runtime_hook_content)

runtime_hooks = [runtime_hook_path]

# ========================================
# PATHEX
# ========================================
pathex = [BASE_DIR]
for app in DJANGO_APPS:
    app_path = os.path.join(BASE_DIR, app)
    if os.path.exists(app_path):
        pathex.append(app_path)

# ========================================
# ANALYSIS
# ========================================
a = Analysis(
    [os.path.join(BASE_DIR, 'run_daphne.py')],
    pathex=pathex,
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=runtime_hooks,
    excludes=[
        'tkinter',
        'matplotlib',
        'numpy',
        'scipy',
        'pandas',
    ],
    noarchive=False,
    optimize=0,
)

# ========================================
# PYZ (Archive Python)
# ========================================
pyz = PYZ(a.pure)

# ========================================
# EXE
# ========================================
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='django_asgi_app',  # ✅ Nom cohérent avec main.js
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # ✅ Console pour debug
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

# ========================================
# COLLECT (Dossier final)
# ========================================
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='born_dz',
)
