# ClickGo — Backend Django

Serveur central pour la caisse (POS), la borne (Born), le KDS et l'écran client.

---

## Sommaire

1. [Installation locale](#1-installation-locale)
2. [Passer de Production à Démo](#2-passer-de-production-à-démo)
3. [Déploiement cloud (Railway)](#3-déploiement-cloud-railway)
4. [Générer l'exécutable (.exe / .app)](#4-générer-lexécutable-exe--app)
5. [Build web des apps Expo](#5-build-web-des-apps-expo)
6. [URLs utiles](#6-urls-utiles)

---

## 1. Installation locale

```bash
# Créer et activer l'environnement virtuel
python -m venv venv
source venv/bin/activate          # macOS/Linux
venv\Scripts\activate             # Windows

# Installer les dépendances
pip install -r requirements.txt

# Configurer l'environnement
cp .env.example .env
# Éditer .env si besoin (par défaut : SQLite + InMemoryChannel = aucune config requise)

# Migrations
python manage.py migrate

# Lancer le serveur
python manage.py runserver 0.0.0.0:8000
# ou avec daphne (WebSockets) :
daphne -b 0.0.0.0 -p 8000 born_dz.asgi:application
```

---

## 2. Passer de Production à Démo

### Mode DÉMO

Crée un restaurant fictif avec des menus, comptes et licence prêts à l'emploi.

```bash
# Créer les données démo
python manage.py create_demo_data

# Activer le mode démo dans .env
echo "DEMO_MODE=True" >> .env

# Compte caissier  : 0600000000 / 123456
# Compte manager   : 0600000001 / 123456
# Écran client     : http://localhost:8000/order/display/
# KDS cuisine      : onglet "Cuisine" dans l'app POS
```

Pour **repartir de zéro** sur les données démo :
```bash
python manage.py create_demo_data --reset
```

### Mode PRODUCTION

```bash
# .env en prod
DEBUG=False
DEMO_MODE=False
DATABASE_URL=postgresql://...      # PostgreSQL Railway
REDIS_URL=redis://...              # Redis Railway
SECRET_KEY=une-cle-secrete-longue
ALLOWED_HOSTS=ton-domaine.railway.app
```

### Switcher rapidement

Garde deux fichiers `.env` :
```
.env.local     → dev local (SQLite, DEBUG=True)
.env.demo      → démo cloud (PostgreSQL, DEMO_MODE=True)
.env.prod      → production réelle
```

Pour basculer :
```bash
cp .env.demo .env    # → mode démo
cp .env.prod .env    # → production
```

---

## 3. Déploiement cloud (Railway)

Le fichier `railway.toml` configure tout automatiquement.

### Étapes

1. Aller sur [railway.app](https://railway.app) → New Project
2. **Deploy from GitHub repo** → sélectionner ce repo
3. Ajouter les services :
   - **PostgreSQL** : Railway génère `DATABASE_URL` automatiquement
   - **Redis** : Railway génère `REDIS_URL` automatiquement
4. Dans le service Django, onglet **Variables**, ajouter :
   ```
   SECRET_KEY=une-cle-tres-longue-et-aleatoire
   DEBUG=False
   ALLOWED_HOSTS=*.railway.app
   DEMO_MODE=True   ← pour le serveur démo
   ```
5. Railway lance automatiquement : `migrate` → `collectstatic` → `daphne`
6. Après déploiement :
   ```bash
   # Via Railway CLI ou l'onglet "Run command"
   python manage.py create_demo_data
   python manage.py createsuperuser
   ```

> **Media files** : Railway ne conserve pas les fichiers uploadés entre redémarrages.
> Pour la prod réelle, configurer Cloudinary ou AWS S3 (non requis pour la démo).

---

## 4. Générer l'exécutable (.exe / .app)

Le backend peut être packagé en un seul exécutable pour les restaurants
(pas besoin d'installer Python sur le PC caisse).

### Prérequis

```bash
pip install pyinstaller
```

### Windows → .exe

```bash
# Depuis le dossier born_dz/ sous Windows
python manage.py collectstatic --noinput
pyinstaller born_dz.spec
```

Le résultat est dans `dist/clickgo_server/`.
Livrer le dossier entier au client — lancer `clickgo_server.exe`.

### macOS → .app / binaire

```bash
# Depuis le dossier born_dz/ sous macOS
python manage.py collectstatic --noinput
pyinstaller born_dz.spec
```

Le résultat est dans `dist/clickgo_server/`.
Lancer `./dist/clickgo_server/clickgo_server`.

> **Note cross-compilation** : le `.exe` doit être compilé **sur Windows**,
> le binaire macOS **sur macOS**. PyInstaller ne fait pas de cross-compilation.
> Utiliser GitHub Actions ou une VM pour automatiser les deux builds.

### Automatiser les deux builds (GitHub Actions)

Créer `.github/workflows/build.yml` :

```yaml
name: Build executables

on:
  push:
    tags: ['v*']

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.13' }
      - run: pip install -r requirements.txt pyinstaller
      - run: python manage.py collectstatic --noinput
        env: { DJANGO_SETTINGS_MODULE: born_dz.settings, SECRET_KEY: build-key, DEBUG: 'True' }
      - run: pyinstaller born_dz.spec
      - uses: actions/upload-artifact@v4
        with:
          name: clickgo-windows
          path: dist/clickgo_server/

  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.13' }
      - run: pip install -r requirements.txt pyinstaller
      - run: python manage.py collectstatic --noinput
        env: { DJANGO_SETTINGS_MODULE: born_dz.settings, SECRET_KEY: build-key, DEBUG: 'True' }
      - run: pyinstaller born_dz.spec
      - uses: actions/upload-artifact@v4
        with:
          name: clickgo-macos
          path: dist/clickgo_server/
```

Chaque `git tag v1.x.x + push` déclenche les deux builds en parallèle.

### Configuration du PC restaurant

Après avoir copié `dist/clickgo_server/` sur le PC :

1. Créer un fichier `.env` dans le même dossier que l'exe :
   ```
   DEBUG=False
   SECRET_KEY=cle-unique-par-restaurant
   DEMO_MODE=False
   ```
2. Lancer `clickgo_server.exe` (ou `./clickgo_server` sur macOS)
3. Premier lancement uniquement :
   ```
   # Ouvrir une invite de commande dans le dossier dist/
   clickgo_server.exe migrate
   clickgo_server.exe createsuperuser
   ```
4. Le serveur écoute sur `http://0.0.0.0:8000`
5. Les autres appareils (bornes, TV) se connectent via l'IP locale :
   `http://192.168.1.X:8000`

---

## 5. Build web des apps Expo

Les apps POS et Borne peuvent être compilées pour le navigateur (démo en ligne).

### POS-APP (Caisse)

```bash
cd POS-APP/POS
npx expo export --platform web
# Résultat dans dist/
```

### Born-APP (Borne)

```bash
cd Born-APP/born_dz
npx expo export --platform web
# Résultat dans dist/
```

### Déployer sur Vercel

```bash
npm i -g vercel

# POS
cd POS-APP/POS/dist && vercel --prod

# Born
cd Born-APP/born_dz/dist && vercel --prod
```

> Avant le build, s'assurer que `SERVER_URL` dans les apps pointe vers
> l'URL Railway du backend démo (ex: `https://borndz-production.up.railway.app`).

---

## 6. URLs utiles

| URL | Description |
|-----|-------------|
| `http://IP:8000/admin/` | Admin Django |
| `http://IP:8000/order/display/` | Écran client salle (auto-détecte le restaurant) |
| `http://IP:8000/order/display/<id>/` | Écran client pour un restaurant précis |
| `http://IP:8000/api/sync/discover/` | Découverte réseau (IP + restaurant_id) |
| `ws://IP:8000/ws/kds/` | WebSocket KDS |
| `ws://IP:8000/ws/borne/sync/` | WebSocket sync borne |

---

## Structure des fichiers clés

```
born_dz/
├── born_dz/
│   ├── settings.py      ← config env vars (DEBUG, DATABASE_URL, REDIS_URL, DEMO_MODE)
│   ├── asgi.py          ← point d'entrée WebSocket
│   └── urls.py          ← routes principales
├── born_dz.spec         ← config PyInstaller (cross-platform)
├── run_daphne.py        ← point d'entrée pour l'exe
├── railway.toml         ← config déploiement Railway
├── requirements.txt     ← dépendances Python
├── .env.example         ← template variables d'environnement
├── restaurant/
│   └── management/commands/create_demo_data.py  ← données démo
└── templates/
    └── customer_display.html  ← écran client TV
```
