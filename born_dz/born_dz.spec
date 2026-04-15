# -*- mode: python ; coding: utf-8 -*-
# ClickGo Backend — PyInstaller spec
# Compatible Windows (.exe) et macOS (.app)
# Usage : pyinstaller born_dz.spec

from PyInstaller.utils.hooks import collect_all, collect_submodules
import os
import sys

# ── Chemin de base (relatif au .spec, cross-platform) ────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(SPEC))

DJANGO_APPS = [
    'user', 'chain', 'customer', 'KDS', 'manager',
    'menu', 'order', 'POS', 'restaurant', 'terminal',
    'website', 'sync', 'borne_sync', 'audit', 'stock',
]

# ── Données à embarquer ───────────────────────────────────────────────────────
datas = [
    (os.path.join(BASE_DIR, 'born_dz'), 'born_dz'),
    (os.path.join(BASE_DIR, 'templates'), 'templates'),
]

for app in DJANGO_APPS:
    app_path = os.path.join(BASE_DIR, app)
    if os.path.exists(app_path):
        datas.append((app_path, app))

static_path = os.path.join(BASE_DIR, 'static')
if os.path.exists(static_path):
    datas.append((static_path, 'static'))

staticfiles_path = os.path.join(BASE_DIR, 'staticfiles')
if os.path.exists(staticfiles_path):
    datas.append((staticfiles_path, 'staticfiles'))

db_path = os.path.join(BASE_DIR, 'db.sqlite3')
if os.path.exists(db_path):
    datas.append((db_path, '.'))

env_path = os.path.join(BASE_DIR, '.env')
if os.path.exists(env_path):
    datas.append((env_path, '.'))

# ── Binaires ──────────────────────────────────────────────────────────────────
binaries = []

# ── Hidden imports ────────────────────────────────────────────────────────────
hiddenimports = [
    # Django
    'django', 'django.core.handlers.asgi', 'django.core.handlers.wsgi',
    'django.template.loaders.app_directories', 'django.template.loaders.filesystem',
    'django.contrib.sessions.serializers', 'django.contrib.staticfiles',
    'django.contrib.auth.hashers',
    # Daphne & ASGI
    'daphne', 'daphne.cli', 'daphne.server', 'daphne.ws_protocol', 'daphne.http_protocol',
    # Channels
    'channels', 'channels.layers', 'channels.routing', 'channels.auth',
    # Twisted
    'twisted', 'twisted.internet', 'twisted.internet.defer', 'twisted.internet.protocol',
    'twisted.internet.reactor', 'twisted.internet.selectreactor', 'twisted.internet.ssl',
    'twisted.internet.tcp', 'twisted.internet.endpoints', 'twisted.internet.base',
    'twisted.internet.task', 'twisted.protocols', 'twisted.protocols.basic',
    'twisted.protocols.tls', 'twisted.web', 'twisted.web.server', 'twisted.web.resource',
    'twisted.web.http', 'twisted.python', 'twisted.python.log', 'twisted.python.failure',
    'twisted.logger',
    # Autobahn (WebSocket)
    'autobahn', 'autobahn.twisted', 'autobahn.twisted.websocket',
    'autobahn.twisted.resource', 'autobahn.websocket', 'autobahn.websocket.protocol',
    'autobahn.websocket.compress',
    # Zope
    'zope', 'zope.interface', 'zope.interface.adapter', 'zope.interface.declarations',
    'zope.interface.interface', 'zope.interface.registry',
    # Autres dépendances Twisted
    'incremental', 'automat', 'automat._core', 'automat._methodical',
    'hyperlink', 'constantly', 'pyasn1', 'pyasn1.codec', 'pyasn1.codec.der',
    'pyasn1_modules', 'OpenSSL', 'OpenSSL.SSL', 'OpenSSL.crypto',
    'service_identity', 'service_identity.pyopenssl',
    'attr', 'attrs', 'txaio', 'txaio.tx',
    # ASGI
    'asgiref', 'asgiref.sync', 'asgiref.server',
    # DRF
    'rest_framework', 'rest_framework.authentication', 'rest_framework.permissions',
    'rest_framework.renderers', 'rest_framework.parsers',
    'rest_framework_simplejwt', 'rest_framework_simplejwt.tokens',
    'rest_framework_simplejwt.authentication',
    'corsheaders',
    # Utilitaires
    'PIL', 'PIL._imaging', 'qrcode', 'psycopg', 'psycopg2',
    'decouple', 'dj_database_url', 'whitenoise', 'whitenoise.middleware',
]

# collect_all pour les gros packages
for pkg in ['django', 'daphne', 'channels', 'twisted', 'autobahn', 'zope.interface', 'automat']:
    tmp = collect_all(pkg)
    datas     += tmp[0]
    binaries  += tmp[1]
    hiddenimports += tmp[2]

# ── Runtime hook ──────────────────────────────────────────────────────────────
hooks_dir = os.path.join(BASE_DIR, 'pyinstaller_hooks')
os.makedirs(hooks_dir, exist_ok=True)

hook_path = os.path.join(hooks_dir, 'django_runtime_hook.py')
with open(hook_path, 'w', encoding='utf-8') as f:
    f.write('''import os, sys
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "born_dz.settings")
if hasattr(sys, "_MEIPASS"):
    sys.path.insert(0, sys._MEIPASS)
''')

# ── Pathex ────────────────────────────────────────────────────────────────────
pathex = [BASE_DIR] + [
    os.path.join(BASE_DIR, app)
    for app in DJANGO_APPS
    if os.path.exists(os.path.join(BASE_DIR, app))
]

# ── Analysis ──────────────────────────────────────────────────────────────────
a = Analysis(
    [os.path.join(BASE_DIR, 'run_daphne.py')],
    pathex=pathex,
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[hook_path],
    excludes=['tkinter', 'matplotlib', 'numpy', 'scipy', 'pandas'],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='clickgo_server',
    debug=False,
    strip=False,
    upx=True,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='clickgo_server',
)
