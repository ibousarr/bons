"""
Routes d'authentification utilisateur (Inscription, Connexion OAuth2/JWT, Profil me).
"""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models import User, UserRole
from app.schemas import UserCreate, UserOut, Token, UserLogin
from app.auth import get_password_hash, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentification"])

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED, summary="Créer un compte utilisateur")
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """Enregistre un nouvel utilisateur (acheteur, gestionnaire, admin)."""
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Une adresse email identique existe déjà."
        )

    # Si c'est le premier utilisateur de la base, on lui attribue le rôle admin
    users_count = db.query(User).count()
    assigned_role = UserRole.ADMIN.value if users_count == 0 else (user_in.role or UserRole.ACHETEUR.value)

    new_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=assigned_role,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/token", response_model=Token, summary="Connexion OAuth2 standard (compatible Swagger UI)")
def login_oauth2(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Point d'entrée standard OAuth2 utilisé par la documentation Swagger UI."""
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compte inactif")

    token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role},
        expires_delta=token_expires
    )
    return {"access_token": token, "token_type": "bearer", "user": user}

@router.post("/login", response_model=Token, summary="Connexion JSON directe pour les applications web")
def login_json(credentials: UserLogin, db: Session = Depends(get_db)):
    """Connexion avec corps JSON (email + password), idéal pour les formulaires React/Vue/Angular."""
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compte inactif")

    token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role},
        expires_delta=token_expires
    )
    return {"access_token": token, "token_type": "bearer", "user": user}

@router.get("/me", response_model=UserOut, summary="Profil de l'utilisateur authentifié")
def get_me(current_user: User = Depends(get_current_user)):
    """Retourne les informations de l'utilisateur actuellement connecté."""
    return current_user
