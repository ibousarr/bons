"""
Configuration de la base de données SQLAlchemy.
Supporte SQLite (développement/démarrage rapide) ainsi que PostgreSQL/MySQL (production LWS).
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

# Création du dossier local si base SQLite
if settings.DATABASE_URL.startswith("sqlite"):
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """
    Générateur de session SQLAlchemy pour les dépendances FastAPI.
    Ferme automatiquement la session après traitement de la requête.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
