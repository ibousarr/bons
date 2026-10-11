"""
Configuration centralisée de l'application FastAPI.
Lit les variables d'environnement avec validation Pydantic v2.
"""
from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import json
import os

class Settings(BaseSettings):
    # Application
    APP_NAME: str = "API Gestion Bons de Commande"
    APP_ENV: str = "production"
    DEBUG: bool = False
    SECRET_KEY: str = "cle_secrete_par_defaut_a_changer_absolument_en_production_123456"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 heures

    # Base de données
    DATABASE_URL: str = "sqlite:///./commandes.db"

    # SMTP LWS (Ligne Web Services)
    LWS_SMTP_HOST: str = "mail.lws.fr"
    LWS_SMTP_PORT: int = 465
    LWS_SMTP_USE_SSL: bool = True
    LWS_SMTP_USE_TLS: bool = False
    LWS_SMTP_USER: str = "contact@votredomaine.com"
    LWS_SMTP_PASSWORD: str = ""
    LWS_EMAIL_FROM: str = "Service Achats <contact@votredomaine.com>"
    LWS_EMAIL_REPLY_TO: str = "contact@votredomaine.com"

    # Données société
    COMPANY_NAME: str = "Mon Entreprise SAS"
    COMPANY_SIRET: str = "123 456 789 00012"
    COMPANY_EMAIL: str = "contact@votredomaine.com"
    COMPANY_PHONE: str = "+33 1 23 45 67 89"
    COMPANY_ADDRESS: str = "10 Rue du Commerce, 75001 Paris"

    # CORS
    CORS_ORIGINS: Union[List[str], str] = ["*"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, str) and v.startswith("["):
            return json.loads(v)
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
