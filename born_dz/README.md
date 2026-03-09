# ClickGo — Backend Django

Serveur central pour la caisse (POS), la borne (Born), le KDS et l'écran client.

---

## Sommaire

1. [Installation locale](#1-installation-locale)
2. [Passer de Production à Démo](#2-passer-de-production-à-démo)
3. [Système de démo en ligne](#3-système-de-démo-en-ligne)
4. [Déploiement cloud (Railway)](#4-déploiement-cloud-railway)
5. [Générer l'exécutable (.exe / .app)](#5-générer-lexécutable-exe--app)
6. [Build web des apps Expo](#6-build-web-des-apps-expo)
7. [URLs utiles](#7-urls-utiles)

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

## 3. Système de démo en ligne

### Architecture

La démo permet à un prospect de tester l'intégralité du système depuis son navigateur,
sans rien installer. Elle repose sur 3 services hébergés :

```
clickgo-site.vercel.app/demo        ← page d'entrée (liens vers tout)
        │
        ├── born-app.vercel.app             ← Borne client (Expo web build)
        ├── born-app-2xag.vercel.app        ← Caisse + KDS (Expo web build)
        ├── borndz-production.up.railway.app/order/display/   ← Écran salle
        └── borndz-production.up.railway.app  ← API Django (backend commun)
```

Toutes les apps pointent vers le même backend Railway. Une commande passée
sur la borne apparaît en temps réel sur le KDS et l'écran salle.

---

### Données démo

Le restaurant démo est créé via la commande :

```bash
python manage.py create_demo_data
```

Ce qu'elle crée :

| Élément | Détail |
|---------|--------|
| Restaurant | ClickGo Démo |
| Catégories | Burgers, Sandwichs, Boissons, Desserts |
| Menus | 10 articles avec prix, descriptions, étapes |
| Étapes | Sauce (2 choix max), Cuisson, Boisson du menu, Garniture glace |
| Options | 15 options (BBQ, Ketchup, Saignant, Coca-Cola, Caramel…) |
| Licence | Premium, valide 2 ans |
| Compte caissier | `0600000000` / `123456` |
| Compte manager | `0600000001` / `123456` |

Pour remettre les données à zéro (ex: avant une démo importante) :

```bash
python manage.py create_demo_data --reset
```

---

### Flux à montrer à un prospect

```
1. Ouvrir la borne  → born-app.vercel.app
   └── Choisir un burger → personnaliser → valider la commande

2. Ouvrir la caisse → born-app-2xag.vercel.app (0600000000 / 123456)
   └── Voir la commande arriver dans l'onglet "Commandes"
   └── Aller sur l'onglet 🔥 Cuisine (KDS) → commencer la préparation

3. Ouvrir l'écran salle → borndz-production.up.railway.app/order/display/
   └── Le numéro de commande passe en vert quand marqué "Prêt"
```

Tout se met à jour en **temps réel via WebSocket** — aucun rechargement manuel.

---

### Partager la démo

Envoyer simplement ce lien au prospect :

```
https://clickgo-site.vercel.app/demo
```

La page explique le fonctionnement, affiche les identifiants et propose
un bouton "Ouvrir" pour chaque composant.

---

### Limitations de la démo web

| Fonctionnalité | Démo web | Production locale |
|----------------|----------|-------------------|
| Commandes en temps réel | ✅ | ✅ |
| Menus, étapes, options | ✅ | ✅ |
| Impression ticket Bluetooth | ❌ | ✅ |
| Scan réseau local automatique | ❌ | ✅ |
| Fonctionnement hors-ligne | ❌ | ✅ (partiel) |
| Performance | Dépend d'internet | Réseau local rapide |

---

## 4. Déploiement cloud (Railway)


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

## 5. Générer l'exécutable (.exe / .app)

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

## 6. Build web des apps Expo

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

## 7. URLs utiles

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
