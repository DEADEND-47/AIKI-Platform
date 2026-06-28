from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
import uuid

from app.auth import verify_token, verify_password, get_password_hash, create_access_token
from app.services.db_service import db_service

router = APIRouter(tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login", auto_error=False)

# Pydantic schemas
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    role: str = "viewer"

# Allowed roles mapping
def get_allowed_roles(role: str) -> list[str]:
    roles_map = {
        "admin": ["admin"],
        "engineer": ["admin", "engineer"],
        "viewer": ["admin", "engineer", "viewer"]
    }
    return roles_map.get(role, ["admin"])

# Authenticated user dependencies
async def get_current_user(token: str = Depends(oauth2_scheme)):
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = verify_token(token)
    if not payload or "email" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    email = payload["email"]
    
    rows = db_service.execute_read("SELECT user_id, email, role FROM users WHERE email = %s", (email,))
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return rows[0]

def require_role(required_role: str):
    def checker(current_user = Depends(get_current_user)):
        if current_user["role"] not in get_allowed_roles(required_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return checker

# Endpoints
@router.post("/auth/login")
async def login(req: LoginRequest):
    rows = db_service.execute_read("SELECT user_id, email, password_hash, role FROM users WHERE email = %s", (req.email,))
    if not rows:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    user = rows[0]
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    access_token = create_access_token(data={"email": user["email"], "role": user["role"]})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "user_id": user["user_id"],
            "email": user["email"],
            "role": user["role"]
        }
    }

@router.post("/auth/register", status_code=201)
async def register(req: RegisterRequest, current_user = Depends(require_role("admin"))):
    # Verify if user already exists
    exists = db_service.execute_read("SELECT user_id FROM users WHERE email = %s", (req.email,))
    if exists:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    if req.role not in ["admin", "engineer", "viewer"]:
        raise HTTPException(status_code=400, detail="Invalid role type")
        
    user_id = str(uuid.uuid4())
    pw_hash = get_password_hash(req.password)
    
    db_service.execute_write(
        "INSERT INTO users (user_id, email, password_hash, role) VALUES (%s, %s, %s, %s)",
        (user_id, req.email, pw_hash, req.role)
    )
    return {
        "message": "User registered successfully",
        "user_id": user_id,
        "email": req.email,
        "role": req.role
    }

@router.get("/auth/me")
async def get_me(current_user = Depends(get_current_user)):
    return {
        "user_id": current_user["user_id"],
        "email": current_user["email"],
        "role": current_user["role"]
    }
