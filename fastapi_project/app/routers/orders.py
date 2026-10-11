"""
Routes de gestion des bons de commande et envoi d'emails transactionnels LWS.
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import PurchaseOrder, OrderItem, Supplier, User, OrderStatus
from app.schemas import (
    PurchaseOrderCreate,
    PurchaseOrderUpdate,
    PurchaseOrderStatusUpdate,
    PurchaseOrderOut,
    PurchaseOrderWithDetailsOut,
    SendOrderEmailRequest,
    SendEmailResponse
)
from app.auth import get_current_user
from app.services.email_service import email_service

router = APIRouter(prefix="/api/orders", tags=["Bons de Commande"])

def generate_order_number(db: Session) -> str:
    """Génère un numéro unique séquentiel de bon de commande (ex: BC-2026-0001)."""
    current_year = datetime.utcnow().year
    count = db.query(PurchaseOrder).filter(
        PurchaseOrder.order_number.like(f"BC-{current_year}-%")
    ).count()
    return f"BC-{current_year}-{count + 1:04d}"

def calculate_totals(items_data):
    """Calcule le total HT, total TVA et total TTC d'une liste de lignes."""
    total_ht = 0.0
    total_tva = 0.0
    for item in items_data:
        line_ht = round(item.quantity * item.unit_price_ht, 2)
        line_tva = round(line_ht * (item.tva_rate / 100.0), 2)
        total_ht += line_ht
        total_tva += line_tva
    total_ttc = round(total_ht + total_tva, 2)
    return round(total_ht, 2), round(total_tva, 2), total_ttc

@router.get("/", response_model=List[PurchaseOrderWithDetailsOut], summary="Lister les bons de commande")
def list_orders(
    status_filter: Optional[str] = Query(None, alias="status", description="Filtrer par statut"),
    search: Optional[str] = Query(None, description="Recherche par numéro ou nom de fournisseur"),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Liste tous les bons de commande avec leurs lignes et relations."""
    query = db.query(PurchaseOrder).join(Supplier)
    if status_filter:
        query = query.filter(PurchaseOrder.status == status_filter)
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (PurchaseOrder.order_number.ilike(search_fmt)) |
            (Supplier.name.ilike(search_fmt))
        )
    return query.order_by(PurchaseOrder.created_at.desc()).offset(skip).limit(limit).all()

@router.post("/", response_model=PurchaseOrderWithDetailsOut, status_code=status.HTTP_201_CREATED, summary="Créer un bon de commande")
def create_order(
    order_in: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Crée un nouveau bon de commande avec calcul automatique des montants HT/TVA/TTC."""
    supplier = db.query(Supplier).filter(Supplier.id == order_in.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fournisseur introuvable")

    order_num = order_in.order_number or generate_order_number(db)
    
    # Vérification unicité numéro
    if db.query(PurchaseOrder).filter(PurchaseOrder.order_number == order_num).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Le numéro de bon de commande '{order_num}' existe déjà."
        )

    total_ht, total_tva, total_ttc = calculate_totals(order_in.items)

    order = PurchaseOrder(
        order_number=order_num,
        supplier_id=supplier.id,
        user_id=current_user.id,
        status=OrderStatus.BROUILLON.value,
        order_date=order_in.order_date or datetime.utcnow(),
        expected_delivery_date=order_in.expected_delivery_date,
        total_ht=total_ht,
        total_tva=total_tva,
        total_ttc=total_ttc,
        notes=order_in.notes,
        payment_terms=order_in.payment_terms or supplier.payment_terms,
        delivery_address=order_in.delivery_address,
    )
    db.add(order)
    db.flush()

    for item_data in order_in.items:
        line_ht = round(item_data.quantity * item_data.unit_price_ht, 2)
        line_tva = round(line_ht * (item_data.tva_rate / 100.0), 2)
        line_ttc = round(line_ht + line_tva, 2)
        item = OrderItem(
            order_id=order.id,
            reference=item_data.reference,
            description=item_data.description,
            quantity=item_data.quantity,
            unit_price_ht=item_data.unit_price_ht,
            tva_rate=item_data.tva_rate,
            total_ht=line_ht,
            total_ttc=line_ttc
        )
        db.add(item)

    db.commit()
    db.refresh(order)
    return order

@router.get("/{order_id}", response_model=PurchaseOrderWithDetailsOut, summary="Consulter un bon de commande")
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retourne l'intégralité d'un bon de commande avec lignes, fournisseur et créateur."""
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bon de commande introuvable")
    return order

@router.patch("/{order_id}/status", response_model=PurchaseOrderWithDetailsOut, summary="Changer le statut d'un bon")
def update_order_status(
    order_id: int,
    status_update: PurchaseOrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fait progresser l'état du bon (BROUILLON -> EN_ATTENTE -> VALIDE -> ENVOYE -> RECEPTIONNE -> ANNULE)."""
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bon de commande introuvable")

    order.status = status_update.status
    db.commit()
    db.refresh(order)
    return order

@router.post("/{order_id}/send-email", response_model=SendEmailResponse, summary="Expédier le bon par mail via SMTP LWS")
def send_order_by_email(
    order_id: int,
    email_req: SendOrderEmailRequest = SendOrderEmailRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Envoie le bon de commande au fournisseur par courrier électronique en utilisant
    l'infrastructure SMTP de l'hébergeur LWS (port 465 SSL ou 587 TLS).
    Génère un rendu HTML soigné et trace l'envoi dans la table d'audit.
    """
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bon de commande introuvable")

    supplier = order.supplier
    target_email = email_req.recipient_email or supplier.email

    if not target_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le fournisseur n'a pas d'adresse email configurée et aucun destinataire n'a été spécifié."
        )

    # Envoi via la classe de service SMTP LWS
    success, message = email_service.send_purchase_order_email(
        order=order,
        supplier=supplier,
        recipient_override=target_email,
        custom_message=email_req.custom_message,
        cc_emails=email_req.cc_emails,
        db=db
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Échec de l'envoi via le SMTP LWS : {message}"
        )

    return SendEmailResponse(
        success=True,
        message=message,
        recipient=target_email,
        sent_at=datetime.utcnow(),
        smtp_server_used=f"{email_service.host}:{email_service.port}"
    )

@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Supprimer un bon de commande")
def delete_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Supprime un bon de commande (uniquement si BROUILLON ou rôle admin)."""
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bon de commande introuvable")

    if order.status not in [OrderStatus.BROUILLON.value, OrderStatus.ANNULE.value] and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seuls les bons à l'état 'BROUILLON' ou 'ANNULE' peuvent être supprimés."
        )

    db.delete(order)
    db.commit()
    return None
