"""
Point d'entrée principal de l'API FastAPI - Gestion des Bons de Commande & Envoi Mail LWS.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.database import Base, engine, SessionLocal
from app.models import User, Supplier, PurchaseOrder, OrderItem, OrderStatus, UserRole
from app.auth import get_password_hash
from app.routers import auth, orders, suppliers, mail
from datetime import datetime, timedelta

def init_db_with_samples():
    """Initialise les tables et injecte des données de démonstration si la base est vide."""
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Création de l'utilisateur admin s'il n'existe pas
        admin_user = db.query(User).filter(User.email == "admin@entreprise.com").first()
        if not admin_user:
            admin_user = User(
                email="admin@entreprise.com",
                hashed_password=get_password_hash("Admin1234!"),
                full_name="Jean Dupont (Responsable Achats)",
                role=UserRole.ADMIN.value,
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)

        # Création de fournisseurs initiaux
        if db.query(Supplier).count() == 0:
            fournisseurs = [
                Supplier(
                    name="Bureau Express SARL",
                    contact_name="Sophie Martin",
                    email="commandes@bureau-express.fr",
                    phone="01 45 67 89 10",
                    address="15 Avenue des Fournisseurs, 69002 Lyon",
                    siret="451 892 312 00024",
                    payment_terms="Virement 30 jours net",
                    notes="Fournisseur principal de fournitures et mobilier de bureau."
                ),
                Supplier(
                    name="TechLogix Distribution",
                    contact_name="Marc Leroy",
                    email="sales@techlogix-distrib.com",
                    phone="01 80 90 20 30",
                    address="8 Boulevard de l'Innovation, 31000 Toulouse",
                    siret="789 123 456 00018",
                    payment_terms="30 jours fin de mois",
                    notes="Matériel informatique, serveurs et périphériques."
                ),
                Supplier(
                    name="Papeterie & Emballages Pro",
                    contact_name="Claire Renaud",
                    email="contact@emballages-pro.fr",
                    phone="04 78 55 44 33",
                    address="22 Rue de la Logistique, 44000 Nantes",
                    siret="333 444 555 00031",
                    payment_terms="45 jours net",
                    notes="Cartons d'expédition, adhésifs et consommables."
                )
            ]
            db.add_all(fournisseurs)
            db.commit()

            # Création d'un premier bon de commande exemple
            sup = db.query(Supplier).first()
            if sup and admin_user:
                po = PurchaseOrder(
                    order_number="BC-2026-0001",
                    supplier_id=sup.id,
                    user_id=admin_user.id,
                    status=OrderStatus.VALIDE.value,
                    order_date=datetime.utcnow() - timedelta(days=2),
                    expected_delivery_date=datetime.utcnow() + timedelta(days=5),
                    total_ht=540.0,
                    total_tva=108.0,
                    total_ttc=648.0,
                    payment_terms="Virement bancaire 30 jours",
                    delivery_address="Siège Social, 10 Rue du Commerce, 75001 Paris",
                    notes="Merci de livrer au rez-de-chaussée avant 12h."
                )
                db.add(po)
                db.flush()

                item1 = OrderItem(
                    order_id=po.id,
                    reference="BUR-ERG-01",
                    description="Fauteuil de bureau ergonomique confort mesh noir",
                    quantity=2.0,
                    unit_price_ht=180.0,
                    tva_rate=20.0,
                    total_ht=360.0,
                    total_ttc=432.0
                )
                item2 = OrderItem(
                    order_id=po.id,
                    reference="PAP-A4-80G",
                    description="Carton de 5 ramettes papier A4 80g blanc supérieur",
                    quantity=10.0,
                    unit_price_ht=18.0,
                    tva_rate=20.0,
                    total_ht=180.0,
                    total_ttc=216.0
                )
                db.add_all([item1, item2])
                db.commit()

    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Démarrage : création des tables et des données d'exemple
    init_db_with_samples()
    yield

app = FastAPI(
    title=settings.APP_NAME,
    description="""
API Backend haute performance construite avec **FastAPI** pour la gestion de bons de commande
et l'expédition d'emails transactionnels avec pièces jointes via les serveurs SMTP de l'hébergeur **LWS**.

### Fonctionnalités principales :
* 🔐 **Authentification JWT & RBAC** (Administrateur, Acheteur, Lecteur)
* 🏢 **Gestion des Fournisseurs** (Annuaire, coordonnées, conditions de règlement)
* 📄 **Bons de Commande** (Lignes d'articles, TVA dynamique, calculs HT/TTC, états du cycle de vie)
* 📧 **Envoi Mail Transactionnel LWS** (Templates HTML responsives, gestion SSL 465 / TLS 587, audit d'envoi)
* ⚙️ **Diagnostic SMTP LWS** (Test de connexion instantané et validation d'infrastructure)
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configuration CORS pour autoriser les requêtes depuis l'application web
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusion des routeurs modulaires
app.include_router(auth.router)
app.include_router(orders.router)
app.include_router(suppliers.router)
app.include_router(mail.router)

@app.get("/", tags=["Système"], summary="Statut de l'API")
def root_info():
    """Vérification de l'état de l'API et liens d'accès rapides."""
    return {
        "status": "online",
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "docs_swagger": "/docs",
        "docs_redoc": "/redoc",
        "lws_smtp_configured": bool(settings.LWS_SMTP_HOST and settings.LWS_SMTP_USER),
        "smtp_server": f"{settings.LWS_SMTP_HOST}:{settings.LWS_SMTP_PORT}"
    }

@app.get("/health", tags=["Système"], summary="Health check pour monitoring LWS / Nginx")
def health_check():
    """Contrôle de santé pour l'orchestrateur de l'hébergeur LWS."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}
