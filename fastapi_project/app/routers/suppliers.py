"""
Routes de gestion des fournisseurs (tiers destinataires des bons de commande).
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Supplier, User
from app.schemas import SupplierCreate, SupplierUpdate, SupplierOut
from app.auth import get_current_user

router = APIRouter(prefix="/api/suppliers", tags=["Fournisseurs"])

@router.get("/", response_model=List[SupplierOut], summary="Lister les fournisseurs")
def list_suppliers(
    search: Optional[str] = Query(None, description="Recherche par nom, contact ou email"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Récupère l'annuaire des fournisseurs avec recherche optionnelle."""
    query = db.query(Supplier)
    if search:
        search_fmt = f"%{search}%"
        query = query.filter(
            (Supplier.name.ilike(search_fmt)) |
            (Supplier.email.ilike(search_fmt)) |
            (Supplier.contact_name.ilike(search_fmt))
        )
    return query.order_by(Supplier.name.asc()).offset(skip).limit(limit).all()

@router.post("/", response_model=SupplierOut, status_code=status.HTTP_201_CREATED, summary="Créer un fournisseur")
def create_supplier(
    supplier_in: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Enregistre un nouveau fournisseur dans le référentiel."""
    supplier = Supplier(**supplier_in.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier

@router.get("/{supplier_id}", response_model=SupplierOut, summary="Détails d'un fournisseur")
def get_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retourne la fiche détaillée d'un fournisseur."""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fournisseur introuvable")
    return supplier

@router.put("/{supplier_id}", response_model=SupplierOut, summary="Mettre à jour un fournisseur")
def update_supplier(
    supplier_id: int,
    supplier_in: SupplierUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Modifie les coordonnées ou modalités d'un fournisseur."""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fournisseur introuvable")

    update_data = supplier_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(supplier, field, value)

    db.commit()
    db.refresh(supplier)
    return supplier

@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Supprimer un fournisseur")
def delete_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Supprime un fournisseur s'il n'a pas de bons de commande associés."""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fournisseur introuvable")

    if supplier.orders:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossible de supprimer ce fournisseur car des bons de commande lui sont rattachés."
        )

    db.delete(supplier)
    db.commit()
    return None
