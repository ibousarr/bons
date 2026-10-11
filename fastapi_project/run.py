"""
Script de lancement direct de l'API FastAPI avec Uvicorn.
Idéal pour le développement ou les serveurs VPS / Dédiés LWS.
Usage : python run.py
"""
import uvicorn
from app.config import settings

if __name__ == "__main__":
    print(f"🚀 Démarrage de {settings.APP_NAME}...")
    print(f"📧 Serveur SMTP configuré : {settings.LWS_SMTP_HOST}:{settings.LWS_SMTP_PORT}")
    print(f"📖 Documentation Swagger : http://localhost:8000/docs")
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        workers=1 if settings.DEBUG else 4
    )
