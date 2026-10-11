"""
Routes de diagnostic et vérification du service SMTP LWS.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import EmailLog, User
from app.schemas import SmtpTestRequest, SmtpTestResponse
from app.auth import get_current_user, require_admin
from app.services.email_service import LWSEmailService
from app.config import settings

router = APIRouter(prefix="/api/mail", tags=["Diagnostic Email LWS"])

@router.post("/test-connection", response_model=SmtpTestResponse, summary="Tester la connexion au serveur SMTP LWS")
def test_smtp_connection(
    test_req: SmtpTestRequest = SmtpTestRequest(),
    current_user: User = Depends(get_current_user)
):
    """
    Tente d'établir une connexion SSL/TLS et de s'authentifier auprès du serveur SMTP LWS.
    Permet de diagnostiquer immédiatement les erreurs courantes (mauvais mot de passe, port bloqué).
    """
    tester = LWSEmailService(
        host=test_req.host,
        port=test_req.port,
        user=test_req.user,
        password=test_req.password,
        use_ssl=test_req.use_ssl,
        use_tls=test_req.use_tls
    )

    success, message, details = tester.test_connection()

    if not success:
        return SmtpTestResponse(
            success=False,
            message=message,
            server=tester.host,
            port=tester.port,
            details=details
        )

    return SmtpTestResponse(
        success=True,
        message=message,
        server=tester.host,
        port=tester.port,
        details=details
    )

@router.get("/config-info", summary="Informations et recommandations LWS SMTP")
def get_smtp_info(current_user: User = Depends(get_current_user)):
    """Retourne la configuration actuelle (sans exposer le mot de passe) et les paramètres recommandés par LWS."""
    return {
        "current_config": {
            "host": settings.LWS_SMTP_HOST,
            "port": settings.LWS_SMTP_PORT,
            "use_ssl": settings.LWS_SMTP_USE_SSL,
            "use_tls": settings.LWS_SMTP_USE_TLS,
            "user": settings.LWS_SMTP_USER,
            "from_address": settings.LWS_EMAIL_FROM,
        },
        "lws_recommendations": {
            "preferred_server": "mail.lws.fr (ou mail.votre-domaine.com)",
            "recommended_port_ssl": 465,
            "alternative_port_starttls": 587,
            "dns_spf_record": "v=spf1 include:spf.lws.fr ~all",
            "cpanel_mailbox_tip": "Créez l'adresse dans cPanel -> Comptes de messagerie avant de l'utiliser comme expéditeur."
        }
    }

@router.get("/logs", summary="Historique des courriels expédiés")
def get_email_logs(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Historique des tentatives d'envoi d'emails vers les fournisseurs."""
    logs = db.query(EmailLog).order_by(EmailLog.sent_at.desc()).offset(skip).limit(limit).all()
    return logs
