"""
Point d'entrée Phusion Passenger pour l'hébergement cPanel de LWS.
Dans le cPanel LWS -> "Configurer l'application Python" :
- Version Python : 3.10 ou 3.11
- Répertoire d'application : /home/moncompte/fastapi_commandes
- Fichier de démarrage : passenger_wsgi.py
- Objet d'application : application
"""
import sys
import os

# Ajout du répertoire actuel au chemin Python
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

# Import de l'application FastAPI
from app.main import app as fastapi_app

# Passerelle ASGI -> WSGI pour Phusion Passenger cPanel
# Passenger sur hébergement mutualisé cPanel LWS attend une application WSGI synchrone.
try:
    from a2wsgi import ASGIMiddleware
    application = ASGIMiddleware(fastapi_app)
except ImportError:
    # Si a2wsgi n'est pas encore installé dans l'environnement virtuel LWS
    def application(environ, start_response):
        start_response('500 Internal Server Error', [('Content-Type', 'text/html; charset=utf-8')])
        return [
            b"<h3>Erreur de demarrage FastAPI sur LWS</h3>"
            b"<p>Veuillez installer le package <strong>a2wsgi</strong> dans votre environnement virtuel cPanel LWS :</p>"
            b"<pre>pip install a2wsgi uvicorn</pre>"
        ]
