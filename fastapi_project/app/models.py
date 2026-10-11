"""
Modèles de données SQLAlchemy pour la gestion de bons de commande et des envois mails LWS.
"""
from datetime import datetime
import enum
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean, Enum
from sqlalchemy.orm import relationship
from app.database import Base

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    ACHETEUR = "acheteur"
    LECTEUR = "lecteur"

class OrderStatus(str, enum.Enum):
    BROUILLON = "BROUILLON"
    EN_ATTENTE = "EN_ATTENTE"
    VALIDE = "VALIDE"
    ENVOYE = "ENVOYE"
    RECEPTIONNE = "RECEPTIONNE"
    ANNULE = "ANNULE"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default=UserRole.ACHETEUR.value, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    orders = relationship("PurchaseOrder", back_populates="creator")

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True, nullable=False)
    contact_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    siret = Column(String(50), nullable=True)
    payment_terms = Column(String(100), default="30 jours net")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    orders = relationship("PurchaseOrder", back_populates="supplier")

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, index=True, nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    status = Column(String(50), default=OrderStatus.BROUILLON.value, nullable=False)
    order_date = Column(DateTime, default=datetime.utcnow)
    expected_delivery_date = Column(DateTime, nullable=True)

    total_ht = Column(Float, default=0.0)
    total_tva = Column(Float, default=0.0)
    total_ttc = Column(Float, default=0.0)

    notes = Column(Text, nullable=True)
    payment_terms = Column(String(100), default="Virement bancaire 30 jours")
    delivery_address = Column(Text, nullable=True)

    # Suivi envoi email LWS
    email_sent_at = Column(DateTime, nullable=True)
    email_sent_to = Column(String(255), nullable=True)
    email_status = Column(String(50), nullable=True)  # ex: SUCCESS, FAILED

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    supplier = relationship("Supplier", back_populates="orders")
    creator = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    email_logs = relationship("EmailLog", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    reference = Column(String(100), nullable=True)
    description = Column(String(255), nullable=False)
    quantity = Column(Float, default=1.0, nullable=False)
    unit_price_ht = Column(Float, default=0.0, nullable=False)
    tva_rate = Column(Float, default=20.0, nullable=False)  # ex: 20.0, 10.0, 5.5
    
    total_ht = Column(Float, default=0.0, nullable=False)
    total_ttc = Column(Float, default=0.0, nullable=False)

    # Relations
    order = relationship("PurchaseOrder", back_populates="items")

class EmailLog(Base):
    __tablename__ = "email_logs"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=True)
    recipient = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False)  # SUCCESS, FAILED
    error_message = Column(Text, nullable=True)
    smtp_host = Column(String(255), nullable=True)
    sent_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    order = relationship("PurchaseOrder", back_populates="email_logs")
