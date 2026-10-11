# 🚀 GUIDE DE DÉPLOIEMENT FASTAPI & CONFIGURATION MAIL LWS

Ce guide complet vous accompagne pas à pas pour déployer l'API FastAPI de gestion des bons de commande sur l'hébergeur français **LWS (Ligne Web Services)** et configurer l'envoi fiable des courriels transactionnels.

---

## 📋 Sommaire
1. [Architecture & Fonctionnalités de l'API](#1-architecture--fonctionnalités)
2. [Configuration des Adresses Emails sur LWS](#2-configuration-des-adresses-emails-sur-lws)
3. [Déploiement sur Hébergement Mutualisé LWS (cPanel)](#3-déploiement-sur-hébergement-mutualisé-lws-cpanel)
4. [Déploiement sur VPS ou Serveur Cloud LWS (Linux)](#4-déploiement-sur-vps-ou-serveur-cloud-lws-linux)
5. [Enregistrements DNS LWS pour la délivrabilité (SPF & DKIM)](#5-enregistrements-dns-lws-pour-la-délivrabilité)
6. [Dépannage & Erreurs Fréquentes](#6-dépannage--erreurs-fréquentes)

---

## 1. Architecture & Fonctionnalités

L'API fournit :
- **Authentification sécurisée** : Hash bcrypt, génération de tokens JWT (HS256) avec rôles `admin`, `acheteur`, `lecteur`.
- **Référentiel Fournisseurs** : SIRET, coordonnées, conditions de paiement.
- **Bons de Commande** : Génération séquentielle `BC-YYYY-XXXX`, articles, taux de TVA personnalisés, calcul automatique HT/TTC, états du cycle de vie (`BROUILLON` ➔ `VALIDE` ➔ `ENVOYE` ➔ `RECEPTIONNE`).
- **Passerelle Email LWS** : Modèle HTML élégant, envoi direct via `mail.lws.fr` (Port 465 SSL), trace horodatée des envois en base.

---

## 2. Configuration des Adresses Emails sur LWS

Pour expédier les bons de commande, vous devez disposer d'une boîte email active chez LWS :

1. Connectez-vous à votre **Espace Client LWS** (ou cPanel).
2. Cliquez sur votre domaine puis sur **Comptes de messagerie** (ou **Gestion des emails**).
3. Cliquez sur **Créer une boîte email** (ex : `commandes@votredomaine.com` ou `achats@votredomaine.com`).
4. Définissez un mot de passe fort (notez-le précieusement).
5. Vérifiez le bon fonctionnement de la boîte en vous connectant sur le **Webmail LWS** :
   👉 `https://webmail.lws.fr`

### Paramètres SMTP officiels LWS :
| Paramètre | Valeur Recommandée (Option A) | Alternative (Option B) |
|---|---|---|
| **Serveur sortant (SMTP)** | `mail.lws.fr` | `mail.votredomaine.com` |
| **Port** | **`465`** (SSL direct) | **`587`** (STARTTLS) |
| **Sécurité** | `SSL / TLS` activé | `STARTTLS` activé |
| **Nom d'utilisateur** | Adresse email complète (ex: `commandes@domaine.com`) | Identique |
| **Authentification** | Obligatoire (mot de passe du compte email) | Obligatoire |

---

## 3. Déploiement sur Hébergement Mutualisé LWS (cPanel)

LWS cPanel propose la fonctionnalité **CloudLinux "Configurer l'application Python"** (Setup Python App) basée sur Phusion Passenger.

### Étape 3.1 : Créer l'application Python dans cPanel
1. Connectez-vous au **cPanel LWS**.
2. Dans la rubrique **Logiciels**, cliquez sur **Configurer l'application Python** (*Setup Python App*).
3. Cliquez sur **Créer une application** (*Create Application*) :
   - **Version de Python** : Choisissez `3.10` ou `3.11`.
   - **Répertoire de l'application** : `fastapi_commandes` (dans votre dossier racine utilisateur).
   - **URI de l'application** : `api` (votre API répondra sur `https://votredomaine.com/api`) ou laissez vide pour la racine.
   - **Fichier de démarrage de l'application** : `passenger_wsgi.py`.
   - **Objet de point d'entrée de l'application** : `application`.
4. Cliquez sur **Créer** (*Create*).

### Étape 3.2 : Téléverser les fichiers du projet
1. Utilisez le **Gestionnaire de fichiers** cPanel ou un client **FTP / SFTP** (FileZilla).
2. Téléversez l'ensemble du dossier de ce projet dans le répertoire créé (`/home/votrecompte/fastapi_commandes`).
3. Veillez à bien inclure les fichiers :
   - `app/`
   - `passenger_wsgi.py`
   - `requirements.txt`
   - `.env` (créé à partir de `.env.example`)

### Étape 3.3 : Configurer l'environnement virtuel et les dépendances
1. En haut de la page cPanel de l'application Python, copiez la commande d'activation du venv, par exemple :
   ```bash
   source /home/votrecompte/nodevenv/fastapi_commandes/3.11/bin/activate
   ```
2. Ouvrez le **Terminal cPanel** (rubrique Avancé) et collez la commande.
3. Installez les packages nécessaires :
   ```bash
   cd /home/votrecompte/fastapi_commandes
   pip install --upgrade pip
   pip install -r requirements.txt
   pip install a2wsgi
   ```
4. Créez votre fichier `.env` avec vos accès LWS :
   ```bash
   cp .env.example .env
   nano .env
   ```
5. Cliquez sur le bouton **Redémarrer** (*Restart*) de l'application dans le cPanel.
6. Testez votre API en ouvrant :
   `https://votredomaine.com/docs`

---

## 4. Déploiement sur VPS ou Serveur Cloud LWS (Linux)

Si vous avez un serveur VPS LWS (Debian 12 ou Ubuntu 22.04 / 24.04), vous bénéficiez d'une liberté totale et d'un serveur asynchrone Uvicorn ultra-performant.

### Étape 4.1 : Préparation du système
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv nginx git curl
```

### Étape 4.2 : Cloner ou copier le projet
```bash
sudo mkdir -p /var/www/fastapi-commandes
sudo chown $USER:$USER /var/www/fastapi-commandes
cd /var/www/fastapi-commandes

# Copiez vos fichiers ici puis :
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
nano .env
```

### Étape 4.3 : Configurer le service Systemd
Créez le service d'arrière-plan :
```bash
sudo nano /etc/systemd/system/fastapi-commandes.service
```

Collez le contenu suivant :
```ini
[Unit]
Description=FastAPI Gestion Bons de Commande & Mail LWS
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/fastapi-commandes
EnvironmentFile=/var/www/fastapi-commandes/.env
ExecStart=/var/www/fastapi-commandes/venv/bin/uvicorn app.main:app --workers 3 --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Activez et démarrez le service :
```bash
sudo systemctl daemon-reload
sudo systemctl enable fastapi-commandes
sudo systemctl start fastapi-commandes
sudo systemctl status fastapi-commandes
```

### Étape 4.4 : Configuration de Nginx en reverse proxy
```bash
sudo nano /etc/nginx/sites-available/commandes.conf
```

Configuration Nginx :
```nginx
server {
    server_name api.votredomaine.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activez le site et installez SSL Let's Encrypt :
```bash
sudo ln -s /etc/nginx/sites-available/commandes.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.votredomaine.com
```

---

## 5. Enregistrements DNS LWS pour la délivrabilité

Pour éviter que les bons de commande envoyés à vos fournisseurs n'arrivent dans les dossiers **Spam / Courrier Indésirable**, configurez ces deux enregistrements dans votre **Zone DNS LWS** :

### 1. Enregistrement SPF (Sender Policy Framework)
Dans l'espace client LWS -> **Zone DNS** :
- **Type** : `TXT`
- **Hôte** : `@` (ou laissez vide)
- **Valeur** :
  ```text
  v=spf1 include:spf.lws.fr ~all
  ```
*(Si vous avez déjà un SPF pour Google Workspace ou Microsoft 365, ajoutez simplement `include:spf.lws.fr` avant `~all`)*.

### 2. Enregistrement DKIM
Activez simplement le bouton **DKIM** disponible dans la gestion des emails de votre espace client LWS : la clé cryptographique sera signée automatiquement sur chaque email sortant.

---

## 6. Dépannage & Erreurs Fréquentes

### Erreur `535 Incorrect authentication data`
- **Cause** : Mauvais identifiant ou mot de passe dans `.env`.
- **Solution** :
  1. Vérifiez que `LWS_SMTP_USER` contient bien l'adresse email complète (`contact@domaine.com`).
  2. Vérifiez que le mot de passe correspond exactement à celui défini dans l'espace client LWS.
  3. Connectez-vous sur `https://webmail.lws.fr` avec ces coordonnées pour valider.

### Erreur `Connection timed out` sur le port 465
- **Cause** : Le port sortant 465 est bloqué par votre hébergeur ou votre pare-feu local.
- **Solution** :
  Changez pour le port 587 avec STARTTLS dans votre `.env` :
  ```env
  LWS_SMTP_PORT=587
  LWS_SMTP_USE_SSL=False
  LWS_SMTP_USE_TLS=True
  ```

### Test rapide en ligne de commande
Vous pouvez lancer le script de test intégré pour diagnostiquer la liaison SMTP en 2 secondes :
```bash
python test_lws_smtp.py monemail@test.com
```
