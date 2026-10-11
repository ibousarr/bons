"""
Script de test autonome pour valider les paramètres SMTP LWS.
Usage : python test_lws_smtp.py [email_destinataire_test]
"""
import sys
import os
import smtplib
from email.mime.text import MIMEText

# Chargement de la configuration
from app.config import settings

def run_smtp_diagnostic(destinataire: str = None):
    host = settings.LWS_SMTP_HOST
    port = settings.LWS_SMTP_PORT
    user = settings.LWS_SMTP_USER
    password = settings.LWS_SMTP_PASSWORD
    use_ssl = settings.LWS_SMTP_USE_SSL

    print("=" * 60)
    print("🔍 DIAGNOSTIC DE CONNEXION SMTP LWS (Ligne Web Services)")
    print("=" * 60)
    print(f"Hôte SMTP : {host}")
    print(f"Port      : {port}")
    print(f"Protocole : {'SSL direct' if use_ssl else 'STARTTLS'}")
    print(f"Compte    : {user}")
    print(f"Password  : {'*' * len(password) if password else '[NON DEFINI]'}")
    print("-" * 60)

    if not user or not password:
        print("❌ ERREUR : Vous devez renseigner LWS_SMTP_USER et LWS_SMTP_PASSWORD dans le fichier .env !")
        return

    try:
        print(f"⏳ Connexion à {host}:{port}...")
        if use_ssl:
            server = smtplib.SMTP_SSL(host, port, timeout=10)
        else:
            server = smtplib.SMTP(host, port, timeout=10)
            server.starttls()

        server.ehlo()
        print("✅ Connexion réseau et négociation TLS/SSL réussies !")

        print(f"⏳ Authentification de l'utilisateur {user}...")
        server.login(user, password)
        print("✅ Authentification acceptée par le serveur LWS !")

        if destinataire:
            print(f"⏳ Envoi d'un courriel de test vers {destinataire}...")
            msg = MIMEText("Ceci est un email de test valide expedie via l'API FastAPI et le serveur SMTP LWS.")
            msg["Subject"] = "Test SMTP Reussi - API Bons de Commande LWS"
            msg["From"] = user
            msg["To"] = destinataire

            server.sendmail(user, [destinataire], msg.as_string())
            print(f"🎉 Email de test délivré avec succès à {destinataire} !")

        server.quit()
        print("-" * 60)
        print("✨ TOUT FONCTIONNE PARFAITEMENT ! Votre configuration LWS est opérationnelle.")
        print("=" * 60)

    except smtplib.SMTPAuthenticationError as e:
        print("\n❌ ERREUR D'AUTHENTIFICATION 535 :")
        print("Le serveur LWS a refusé vos identifiants.")
        print("Solutions :")
        print("1. Vérifiez l'orthographe exacte de l'email complet (ex: contact@domaine.com).")
        print("2. Connectez-vous sur https://webmail.lws.fr avec ces mêmes identifiants pour tester le mot de passe.")
        print("3. Dans l'espace LWS cPanel, vérifiez que la boîte n'est pas suspendue ou pleine.")
    except Exception as e:
        print(f"\n❌ ERREUR TECHNIQUE : {e}")
        print("Solutions :")
        print("1. Si timeout : vérifiez que le port 465 ou 587 n'est pas bloqué par votre pare-feu.")
        print("2. Vérifiez le nom d'hôte : essayez 'mail.lws.fr' ou 'mail.votredomaine.com'.")

if __name__ == "__main__":
    test_email = sys.argv[1] if len(sys.argv) > 1 else None
    run_smtp_diagnostic(test_email)
