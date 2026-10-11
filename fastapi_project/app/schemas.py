"""
Schémas Pydantic (v2) pour la validation des données d'entrée/sortie.
"""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator

# ------------------------------------------------------------------------------
# AUTH & USERS
# ------------------------------------------------------------------------------
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: Optional[str] = "acheteur"

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="Mot de passe avec au moins 6 caractères")

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None

# ------------------------------------------------------------------------------
# FOURNISSEURS (SUPPLIERS)
# ------------------------------------------------------------------------------
class SupplierBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    contact_name: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    siret: Optional[str] = None
    payment_terms: Optional[str] = "30 jours net"
    notes: Optional[str] = None

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    siret: Optional[str] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None

class SupplierOut(SupplierBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# ------------------------------------------------------------------------------
# LIGNES DE BON DE COMMANDE (ORDER ITEMS)
# ------------------------------------------------------------------------------
class OrderItemCreate(BaseModel):
    reference: Optional[str] = None
    description: str = Field(..., min_length=1)
    quantity: float = Field(..., gt=0)
    unit_price_ht: float = Field(..., ge=0)
    tva_rate: float = Field(default=20.0, ge=0, le=100)

class OrderItemOut(OrderItemCreate):
    id: int
    total_ht: float
    total_ttc: float

    class Config:
        from_attributes = True

# ------------------------------------------------------------------------------
# BONS DE COMMANDE (PURCHASE ORDERS)
# ------------------------------------------------------------------------------
class PurchaseOrderCreate(BaseModel):
    order_number: Optional[str] = None  # Si non renseigné, auto-généré
    supplier_id: int
    order_date: Optional[datetime] = None
    expected_delivery_date: Optional[datetime] = None
    notes: Optional[str] = None
    payment_terms: Optional[str] = "Virement bancaire 30 jours"
    delivery_address: Optional[str] = None
    items: List[OrderItemCreate] = Field(..., min_items=1)

class PurchaseOrderUpdate(BaseModel):
    supplier_id: Optional[int] = None
    expected_delivery_date: Optional[datetime] = None
    notes: Optional[str] = None
    payment_terms: Optional[str] = None
    delivery_address: Optional[str] = None
    items: Optional[List[OrderItemCreate]] = None

class PurchaseOrderStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(BROUILLON|EN_ATTENTE|VALIDE|ENVOYE|RECEPTIONNE|ANNULE)$")

class PurchaseOrderOut(BaseModel):
    id: int
    order_number: str
    supplier_id: int
    user_id: int
    status: str
    order_date: datetime
    expected_delivery_date: Optional[datetime] = None
    total_ht: float
    total_tva: float
    total_ttc: float
    notes: Optional[str] = None
    payment_terms: Optional[str] = None
    delivery_address: Optional[str] = None
    email_sent_at: Optional[datetime] = None
    email_sent_to: Optional[str] = None
    email_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PurchaseOrderWithDetailsOut(PurchaseOrderOut):
    supplier: SupplierOut
    creator: UserOut
    items: List[OrderItemOut]

    class Config:
        from_attributes = True

# ------------------------------------------------------------------------------
# ENVOI D'EMAILS LWS & DIAGNOSTIC SMTP
# ------------------------------------------------------------------------------
class SendOrderEmailRequest(BaseModel):
    recipient_email: Optional[EmailStr] = None  # Si non fourni, prend l'email du fournisseur
    subject: Optional[str] = None
    custom_message: Optional[str] = None
    cc_emails: Optional[List[EmailStr]] = []
    attach_pdf: bool = True

class SendEmailResponse(BaseModel):
    success: bool
    message: str
    recipient: str
    sent_at: datetime
    smtp_server_used: str

class SmtpTestRequest(BaseModel):
    host: Optional[str] = None
    port: Optional[int] = None
    user: Optional[str] = None
    password: Optional[str] = None
    use_ssl: Optional[bool] = None
    use_tls: Optional[bool] = None
    test_recipient: Optional[EmailStr] = None

class SmtpTestResponse(BaseModel):
    success: bool
    message: str
    server: str
    port: int
    details: Optional[str] = None
