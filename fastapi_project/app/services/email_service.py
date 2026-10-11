"""
Service d'envoi d'emails via le serveur SMTP de l'hébergeur LWS (Ligne Web Services).
Gère la connexion SSL (port 465) / TLS (port 587), l'authentification et le rendu HTML.
"""
import os
import smtplib
import socket
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from typing import List, Optional, Tuple
from jinja2 import Environment, FileSystemLoader
from app.config import settings
from app.models import PurchaseOrder, Supplier, EmailLog
from sqlalchemy.orm import Session

# Initialisation du moteur de template Jinja2
templates_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")
jinja_env = Environment(loader=FileSystemLoader(templates_dir), autoescape=True)

class LWSEmailService:
    """
    Gestionnaire d'expédition d'emails calibré pour l'infrastructure LWS :
    - Serveur SMTP sortant : mail.lws.fr ou mail.votredomaine.com
    - Port recommandé : 465 avec SSL
    - Port alternatif : 587 avec STARTTLS
    """

    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        user: Optional[str] = None,
        password: Optional[str] = None,
        use_ssl: Optional[bool] = None,
        use_tls: Optional[bool] = None,
    ):
        self.host = host or settings.LWS_SMTP_HOST
        self.port = port if port is not None else settings.LWS_SMTP_PORT
        self.user = user or settings.LWS_SMTP_USER
        self.password = password or settings.LWS_SMTP_PASSWORD
        self.use_ssl = use_ssl if use_ssl is not None else settings.LWS_SMTP_USE_SSL
        self.use_tls = use_tls if use_tls is not None else settings.LWS_SMTP_USE_TLS
        self.email_from = settings.LWS_EMAIL_FROM
        self.reply_to = settings.LWS_EMAIL_REPLY_TO

    def test_connection(self) -> Tuple[bool, str, str]:
        """
        Teste la poignée de main SMTP et l'authentification auprès de LWS.
        Retourne : (succès: bool, message: str, détails_techniques: str)
        """
        if not self.user or not self.password:
            return (
                False,
                "Identifiants LWS incomplets : LWS_SMTP_USER ou LWS_SMTP_PASSWORD non renseigné dans la configuration.",
                "Veuillez créer une adresse email dans votre cPanel LWS et saisir son mot de passe."
            )

        try:
            # Connexion SSL directe (Port 465 LWS recommandé)
            if self.use_ssl:
                server = smtplib.SMTP_SSL(self.host, self.port, timeout=12)
            else:
                # Connexion STARTTLS (Port 587 LWS)
                server = smtplib.SMTP(self.host, self.port, timeout=12)
                if self.use_tls:
                    server.starttls()

            server.ehlo()
            server.login(self.user, self.password)
            server.quit()
            return (
                True,
                f"Connexion réussie au serveur SMTP LWS ({self.host}:{self.port}) !",
                f"Authentification validée avec le compte {self.user}."
            )

        except smtplib.SMTPAuthenticationError as e:
            return (
                False,
                "Échec d'authentification SMTP LWS (Erreur 535) : identifiant ou mot de passe incorrect.",
                f"Détails SMTP : {str(e)}. Vérifiez que l'adresse '{self.user}' existe bien dans votre cPanel LWS et testez-la sur le Webmail LWS (webmail.lws.fr)."
            )
        except (socket.timeout, smtplib.SMTPConnectError) as e:
            return (
                False,
                f"Impossible de joindre le serveur SMTP LWS ({self.host}:{self.port}).",
                f"Détails : {str(e)}. Vérifiez que le port {self.port} n'est pas bloqué par un pare-feu sortant."
            )
        except Exception as e:
            return (
                False,
                f"Erreur inattendue lors de la connexion SMTP LWS : {str(e)}",
                f"Type: {type(e).__name__}"
            )

    def render_order_html(
        self,
        order: PurchaseOrder,
        supplier: Supplier,
        custom_message: Optional[str] = None
    ) -> str:
        """Génère le code HTML complet du bon de commande pour le corps du courriel."""
        template = jinja_env.get_template("order_email.html")
        return template.render(
            order=order,
            supplier=supplier,
            custom_message=custom_message,
            company=settings
        )

    def send_purchase_order_email(
        self,
        order: PurchaseOrder,
        supplier: Supplier,
        recipient_override: Optional[str] = None,
        custom_message: Optional[str] = None,
        cc_emails: Optional[List[str]] = None,
        pdf_bytes: Optional[bytes] = None,
        db: Optional[Session] = None
    ) -> Tuple[bool, str]:
        """
        Envoie un bon de commande au fournisseur via le relais SMTP LWS.
        Enregistre automatiquement un journal (EmailLog) dans la base de données.
        """
        recipient = recipient_override or supplier.email
        subject = f"Bon de Commande {order.order_number} - {settings.COMPANY_NAME}"

        msg = MIMEMultipart("mixed")
        msg["Subject"] = subject
        msg["From"] = self.email_from
        msg["To"] = recipient
        if self.reply_to:
            msg["Reply-To"] = self.reply_to
        if cc_emails:
            msg["Cc"] = ", ".join(cc_emails)

        # Corps de l'email (version HTML)
        html_content = self.render_order_html(order, supplier, custom_message)
        msg_body = MIMEMultipart("alternative")
        
        # Version texte brut de secours
        plain_text = (
            f"Bon de Commande {order.order_number}\n"
            f"Émis par {settings.COMPANY_NAME} le {order.order_date.strftime('%d/%m/%Y')}\n\n"
            f"Fournisseur : {supplier.name}\n"
            f"Montant Total HT : {order.total_ht:.2f} €\n"
            f"Montant Total TTC : {order.total_ttc:.2f} €\n"
            f"Règlement : {order.payment_terms}\n\n"
            f"Veuillez trouver les détails du bon de commande ci-joints.\n"
        )
        msg_body.attach(MIMEText(plain_text, "plain", "utf-8"))
        msg_body.attach(MIMEText(html_content, "html", "utf-8"))
        msg.attach(msg_body)

        # Pièce jointe PDF facultative
        if pdf_bytes:
            pdf_attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
            pdf_attachment.add_header(
                "Content-Disposition",
                "attachment",
                filename=f"Bon_Commande_{order.order_number}.pdf"
            )
            msg.attach(pdf_attachment)

        # Destinataires effectifs
        all_recipients = [recipient]
        if cc_emails:
            all_recipients.extend(cc_emails)

        success = False
        error_msg = None

        try:
            if self.use_ssl:
                server = smtplib.SMTP_SSL(self.host, self.port, timeout=15)
            else:
                server = smtplib.SMTP(self.host, self.port, timeout=15)
                if self.use_tls:
                    server.starttls()

            server.ehlo()
            if self.user and self.password:
                server.login(self.user, self.password)

            server.sendmail(self.user or self.email_from, all_recipients, msg.as_string())
            server.quit()
            success = True
            result_message = f"Email envoyé avec succès à {recipient} via LWS ({self.host}:{self.port})"

        except smtplib.SMTPAuthenticationError as e:
            error_msg = f"Erreur authentification LWS 535 : {str(e)}"
            result_message = error_msg
        except Exception as e:
            error_msg = f"Erreur envoi SMTP LWS : {str(e)}"
            result_message = error_msg

        # Enregistrement du log en BDD
        if db:
            log_entry = EmailLog(
                order_id=order.id,
                recipient=recipient,
                subject=subject,
                status="SUCCESS" if success else "FAILED",
                error_message=error_msg,
                smtp_host=f"{self.host}:{self.port}"
            )
            db.add(log_entry)
            
            # Mise à jour du statut du bon
            if success:
                from datetime import datetime
                order.email_sent_at = datetime.utcnow()
                order.email_sent_to = recipient
                order.email_status = "SUCCESS"
                order.status = "ENVOYE"
            db.commit()

        return success, result_message

email_service = LWSEmailService()
