"""DevPilot Auth Service — Authentication + Chat API Proxy.

v0.3.0:
- User authentication (register/login/JWT)
- /chat/* proxy: validates JWT, injects API Key, forwards to ClawAPI
- API Key never exposed to frontend
"""

from __future__ import annotations

import base64
import os
import secrets
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
import httpx
import jwt
import structlog
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import Body, Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import Boolean, Column, DateTime, String, Text, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "RS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))
JWT_PRIVATE_KEY_FILE = os.getenv("JWT_PRIVATE_KEY_FILE", "")
JWT_PUBLIC_KEY_FILE = os.getenv("JWT_PUBLIC_KEY_FILE", "")
DATABASE_URL = os.getenv("AUTH_DATABASE_URL", "postgresql+asyncpg://devpilot:devpilot123@localhost/devpilot")
HOST = os.getenv("AUTH_HOST", "127.0.0.1")
PORT = int(os.getenv("AUTH_PORT", "16001"))
CORS_ORIGINS = os.getenv("AUTH_CORS_ORIGINS", "*").split(",")
DEBUG = os.getenv("AUTH_DEBUG", "false").lower() == "true"
ADMIN_USERNAME = os.getenv("AUTH_ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("AUTH_ADMIN_PASSWORD", "")

# ClawAPI connection (for /chat/* proxy)
CLAWAPI_URL = os.getenv("CLAWAPI_URL", "http://127.0.0.1:16002")
CLAWAPI_KEY = os.getenv("CLAWAPI_KEY", "")  # API Key — server-side only

# Legacy HS256 fallback
JWT_SECRET = os.getenv("JWT_SECRET", "")

# ---------------------------------------------------------------------------
# RSA Key Loading
# ---------------------------------------------------------------------------

_private_key = None
_public_key = None
_public_key_pem: str = ""
_jwks_cache: dict | None = None


def _load_rsa_keys() -> None:
    global _private_key, _public_key, _public_key_pem, JWT_ALGORITHM

    priv_path = JWT_PRIVATE_KEY_FILE
    pub_path = JWT_PUBLIC_KEY_FILE

    if priv_path and Path(priv_path).exists():
        _private_key = serialization.load_pem_private_key(
            Path(priv_path).read_bytes(), password=None,
        )
        logger.info("auth_rsa_private_key_loaded", path=priv_path)
    else:
        if JWT_ALGORITHM == "RS256":
            logger.warning("auth_no_private_key",
                           msg="Generating ephemeral RSA key pair (not for production)")
            _private_key = rsa.generate_private_key(
                public_exponent=65537, key_size=2048,
            )
        else:
            return

    _public_key = _private_key.public_key()
    _public_key_pem = _public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()

    if pub_path and Path(pub_path).exists():
        _public_key_pem = Path(pub_path).read_text()
        _public_key = serialization.load_pem_public_key(_public_key_pem.encode())
        logger.info("auth_rsa_public_key_loaded", path=pub_path)


def _build_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache
    if not _public_key:
        return {"keys": []}
    pub_numbers = _public_key.public_numbers()

    def _int_to_b64url(n: int, length: int) -> str:
        return base64.urlsafe_b64encode(n.to_bytes(length, "big")).rstrip(b"=").decode()

    n_bytes = (pub_numbers.n.bit_length() + 7) // 8
    e_bytes = (pub_numbers.e.bit_length() + 7) // 8
    _jwks_cache = {"keys": [{"kty": "RSA", "use": "sig", "alg": "RS256",
                              "kid": "devpilot-auth-1",
                              "n": _int_to_b64url(pub_numbers.n, n_bytes),
                              "e": _int_to_b64url(pub_numbers.e, e_bytes)}]}
    return _jwks_cache


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

_engine = None
_session_factory: async_sessionmaker | None = None


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(200), unique=True, nullable=True, index=True)
    password_hash = Column(String(128), nullable=False)
    role = Column(String(10), nullable=False, default="user")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now())
    updated_at = Column(DateTime, default=lambda: datetime.now(),
                        onupdate=lambda: datetime.now())




class Project(Base):
    __tablename__ = "projects"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    owner_id = Column(String, nullable=False, index=True)
    notion_page_id = Column(String(50), nullable=True)
    github_repo = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now())
    updated_at = Column(DateTime, default=lambda: datetime.now(), onupdate=lambda: datetime.now())


class ProjectOut(BaseModel):
    id: str
    name: str
    description: str | None
    owner_id: str
    notion_page_id: str | None
    github_repo: str | None
    created_at: datetime
    updated_at: datetime


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    notion_page_id: str | None = None
    github_repo: str | None = None

def _get_engine():
    global _engine
    if _engine is None:
        connect_args = {}
        if DATABASE_URL.startswith("sqlite"):
            connect_args["check_same_thread"] = False
        _engine = create_async_engine(DATABASE_URL, connect_args=connect_args)
    return _engine


def _get_session_factory() -> async_sessionmaker:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(_get_engine(), expire_on_commit=False)
    return _session_factory


async def get_db():
    factory = _get_session_factory()
    async with factory() as session:
        yield session


async def init_db():
    engine = _get_engine()
    os.makedirs("data", exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_jwt_token(user: User) -> tuple[str, datetime]:
    expires = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {
        "sub": user.id, "username": user.username, "role": user.role,
        "iss": "devpilot-auth",
        "iat": datetime.now(timezone.utc), "exp": expires,
    }
    if JWT_ALGORITHM == "RS256" and _private_key:
        token = jwt.encode(payload, _private_key, algorithm="RS256")
    elif JWT_SECRET:
        token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    else:
        raise RuntimeError("No signing key configured")
    return token, expires


def decode_jwt(token: str) -> dict:
    if JWT_ALGORITHM == "RS256" and _public_key:
        return jwt.decode(token, _public_key, algorithms=["RS256"])
    elif JWT_SECRET:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    else:
        raise RuntimeError("No verification key configured")


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise AuthError(401, "AUTH_REQUIRED", "Authorization header required")
    try:
        payload = decode_jwt(auth[7:])
    except jwt.ExpiredSignatureError:
        raise AuthError(401, "AUTH_INVALID", "Token expired")
    except jwt.InvalidTokenError:
        raise AuthError(401, "AUTH_INVALID", "Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise AuthError(401, "AUTH_INVALID", "Invalid token payload")

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user or not user.is_active:
        raise AuthError(401, "AUTH_INVALID", "User not found or inactive")
    return user


def _verify_jwt_only(request: Request) -> dict:
    """Verify JWT without DB lookup — lightweight for proxy routes."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise AuthError(401, "AUTH_REQUIRED", "Authorization header required")
    try:
        return decode_jwt(auth[7:])
    except jwt.ExpiredSignatureError:
        raise AuthError(401, "AUTH_INVALID", "Token expired")
    except jwt.InvalidTokenError:
        raise AuthError(401, "AUTH_INVALID", "Invalid token")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    password: str = Field(..., min_length=8, max_length=128)
    email: str | None = None


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1)


class UserOut(BaseModel):
    id: str
    username: str
    role: str
    email: str | None = None
    is_active: bool
    created_at: datetime


class ChatRequest(BaseModel):
    message: str
    project_id: str | None = None
    session_id: str | None = None

class ChatResponse(BaseModel):
    ok: bool = True
    message: str
    session_id: str | None = None

class TokenResponse(BaseModel):
    ok: bool = True
    token: str
    expires_at: datetime
    user: UserOut


class AuthError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status = status
        self.code = code
        self.message = message


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

async def _ensure_admin():
    factory = _get_session_factory()
    async with factory() as db:
        existing = (await db.execute(select(User).where(User.username == ADMIN_USERNAME))).scalar_one_or_none()
        if existing:
            return
        password = ADMIN_PASSWORD or secrets.token_urlsafe(16)
        admin = User(username=ADMIN_USERNAME, password_hash=hash_password(password), role="admin")
        db.add(admin)
        try:
            await db.commit()
        except Exception:
            return  # another worker already created it
        if not ADMIN_PASSWORD:
            print("=" * 60)
            print(f"  Admin user created: {ADMIN_USERNAME}")
            print(f"  Generated password: {password}")
            print("  Save this password!")
            print("=" * 60)
        else:
            logger.info("admin_created", username=ADMIN_USERNAME)


# Shared httpx client for proxying
_http_client: httpx.AsyncClient | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _http_client
    logger.info("devpilot_auth_starting", port=PORT, algorithm=JWT_ALGORITHM)
    _load_rsa_keys()
    await init_db()
    await _ensure_admin()

    # Init proxy HTTP client
    _http_client = httpx.AsyncClient(
        base_url=CLAWAPI_URL,
        timeout=httpx.Timeout(connect=10.0, read=180.0, write=30.0, pool=10.0),
    )

    if CLAWAPI_KEY:
        logger.info("chat_proxy_configured", clawapi_url=CLAWAPI_URL, key_prefix=CLAWAPI_KEY[:7] + "...")
    else:
        logger.warning("chat_proxy_no_key", msg="CLAWAPI_KEY not set — /chat/* proxy will fail")

    logger.info("devpilot_auth_started", port=PORT)
    yield

    await _http_client.aclose()
    logger.info("devpilot_auth_stopped")


app = FastAPI(
    title="DevPilot Auth + Chat Proxy",
    description="Authentication Service + Chat API Gateway",
    version="0.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(AuthError)
async def auth_error_handler(request: Request, exc: AuthError):
    return JSONResponse(status_code=exc.status,
                        content={"ok": False, "error": {"code": exc.code, "message": exc.message}})


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception):
    logger.error("unhandled_error", error=str(exc), type=type(exc).__name__)
    return JSONResponse(status_code=500,
                        content={"ok": False, "error": {"code": "INTERNAL_ERROR", "message": "Internal error"}})


# ---------------------------------------------------------------------------
# Routes — Authentication
# ---------------------------------------------------------------------------

def _user_out(u: User) -> UserOut:
    return UserOut(id=u.id, username=u.username, role=u.role,
                   email=u.email, is_active=u.is_active, created_at=u.created_at)


@app.post("/auth/register", response_model=TokenResponse, summary="Register")
@limiter.limit("10/minute")
async def register(body: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(select(User).where(User.username == body.username))).scalar_one_or_none()
    if existing:
        raise AuthError(409, "CONFLICT", "Username already taken")
    if body.email:
        existing_email = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
        if existing_email:
            raise AuthError(409, "CONFLICT", "Email already registered")
    user = User(username=body.username, email=body.email,
                password_hash=hash_password(body.password), role="user")
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token, expires = create_jwt_token(user)
    logger.info("user_registered", username=user.username)
    return TokenResponse(token=token, expires_at=expires, user=_user_out(user))


@app.post("/auth/login", response_model=TokenResponse, summary="Login")
@limiter.limit("20/minute")
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.username == body.username))).scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise AuthError(401, "AUTH_INVALID", "Invalid username or password")
    if not user.is_active:
        raise AuthError(403, "FORBIDDEN", "Account is disabled")
    token, expires = create_jwt_token(user)
    logger.info("user_login", username=user.username)
    return TokenResponse(token=token, expires_at=expires, user=_user_out(user))


@app.post("/auth/refresh", response_model=TokenResponse, summary="Refresh token")
async def refresh(user: User = Depends(get_current_user)):
    token, expires = create_jwt_token(user)
    return TokenResponse(token=token, expires_at=expires, user=_user_out(user))


@app.get("/auth/me", response_model=UserOut, summary="Current user info")
async def me(user: User = Depends(get_current_user)):
    return _user_out(user)


# ---------------------------------------------------------------------------
# Routes — Public Key Distribution
# ---------------------------------------------------------------------------

@app.get("/auth/.well-known/jwks.json", summary="JWKS public key")
async def jwks():
    return _build_jwks()


@app.get("/auth/public-key", summary="Public key in PEM format")
async def public_key_pem():
    if not _public_key_pem:
        raise AuthError(500, "NO_PUBLIC_KEY", "Public key not configured")
    return JSONResponse(content={"algorithm": JWT_ALGORITHM, "public_key": _public_key_pem})


# ---------------------------------------------------------------------------
# Routes — Chat Proxy (/chat/* → ClawAPI with API Key injection)
#
# Flow:  Frontend → JWT → Auth verifies → forward to ClawAPI with X-API-Key
#        API Key is server-side only, never exposed to the browser.
# ---------------------------------------------------------------------------

@app.api_route("/chat/{path:path}", methods=["GET", "POST", "PUT", "DELETE"],
               summary="Chat API proxy (JWT → API Key)")
async def chat_proxy(request: Request, path: str):
    """Proxy /chat/* to ClawAPI's /api/v1/*.

    Mapping: /chat/{path} → ClawAPI /api/v1/{path}

    1. Verify user JWT
    2. Strip user's Authorization header
    3. Inject X-API-Key (server-side secret)
    4. Forward request to ClawAPI
    5. Stream response back to user
    """
    # 1. Verify JWT
    jwt_payload = _verify_jwt_only(request)
    username = jwt_payload.get("username", "unknown")

    if not CLAWAPI_KEY:
        raise AuthError(503, "PROXY_ERROR", "ClawAPI key not configured")

    # 2. Build upstream URL: /chat/{path} → /api/v1/{path}
    target_path = f"/api/v1/{path}"
    query = str(request.url.query)
    if query:
        target_path += f"?{query}"

    # 3. Build headers — inject API Key, forward useful headers
    headers = {
        "X-API-Key": CLAWAPI_KEY,
        "X-Forwarded-User": username,
        "X-Forwarded-User-Id": jwt_payload.get("sub", ""),
        "Content-Type": request.headers.get("Content-Type", "application/json"),
        "Accept": request.headers.get("Accept", "*/*"),
    }
    # Forward Last-Event-ID for SSE reconnection
    lei = request.headers.get("Last-Event-ID")
    if lei:
        headers["Last-Event-ID"] = lei

    # 4. Read request body
    body = await request.body()

    # 5. Forward — handle SSE streaming
    accept = request.headers.get("Accept", "")
    is_sse = "text/event-stream" in accept

    # SSE streaming endpoints — these always return SSE regardless of Accept header
    is_streaming = (
        path.endswith("completions") or
        path.startswith("chat/stream/") or
        path.startswith("openai/chat/completions")
    )

    try:
        if is_sse or is_streaming:
            return await _proxy_stream(request.method, target_path, headers, body, username)
        else:
            return await _proxy_json(request.method, target_path, headers, body)
    except httpx.ConnectError:
        raise AuthError(502, "PROXY_ERROR", "Cannot connect to ClawAPI")
    except httpx.TimeoutException:
        raise AuthError(504, "PROXY_TIMEOUT", "ClawAPI request timed out")
    except Exception as e:
        logger.error("chat_proxy_error", error=str(e), path=path, user=username)
        raise AuthError(502, "PROXY_ERROR", f"Proxy error: {str(e)}")


async def _proxy_json(method: str, path: str, headers: dict, body: bytes) -> JSONResponse:
    """Forward a regular JSON request to ClawAPI."""
    resp = await _http_client.request(
        method=method, url=path, headers=headers, content=body,
    )
    # Pass through ClawAPI's response
    return JSONResponse(
        status_code=resp.status_code,
        content=resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {"raw": resp.text},
        headers={"X-Session-Key": resp.headers.get("X-Session-Key", "")},
    )


async def _proxy_stream(method: str, path: str, headers: dict, body: bytes, username: str) -> StreamingResponse:
    """Forward an SSE streaming request to ClawAPI — raw byte passthrough."""
    req = _http_client.build_request(
        method=method, url=path, headers=headers, content=body,
    )
    resp = await _http_client.send(req, stream=True)

    session_key = resp.headers.get("X-Session-Key", "")
    logger.info("chat_proxy_stream", user=username, path=path, session_key=session_key)

    async def stream_generator():
        try:
            async for chunk in resp.aiter_raw():
                yield chunk
        except Exception as e:
            logger.error("proxy_stream_error", error=str(e))
        finally:
            await resp.aclose()

    return StreamingResponse(
        stream_generator(),
        status_code=resp.status_code,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Session-Key": session_key,
        },
    )



# ---------------------------------------------------------------------------
# Projects CRUD
# ---------------------------------------------------------------------------

@app.get("/projects", response_model=list[ProjectOut], summary="List projects")
async def list_projects(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.owner_id == user.id))
    return result.scalars().all()


@app.post("/projects", response_model=ProjectOut, summary="Create project")
async def create_project(
    project: ProjectCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    new_project = Project(
        id=str(uuid.uuid4()),
        name=project.name,
        description=project.description,
        owner_id=user.id,
        notion_page_id=project.notion_page_id,
        github_repo=project.github_repo
    )
    db.add(new_project)
    await db.commit()
    await db.refresh(new_project)
    return new_project


@app.get("/projects/{project_id}", response_model=ProjectOut, summary="Get project")
async def get_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.owner_id == user.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise AuthError(status=404, code="NOT_FOUND", message="Project not found")
    return project


@app.delete("/projects/{project_id}", summary="Delete project")
async def delete_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.owner_id == user.id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise AuthError(status=404, code="NOT_FOUND", message="Project not found")
    await db.delete(project)
    await db.commit()
    return {"ok": True}




import re

def parse_intent(msg):
    patterns = {'code': ['写代码','代码'], 'debug': ['调试','bug'], 'explain': ['解释','什么是']}
    for k,v in patterns.items():
        if any(w in msg.lower() for w in v):
            return [k]
    return ['default']

NOTION_KEY = os.getenv('NOTION_API_KEY', '')

async def get_proj_ctx(pid, db):
    from sqlalchemy import select
    r = await db.execute(select(Project).where(Project.id == pid))
    p = r.scalar_one_or_none()
    if p:
        return {'id': p.id, 'name': p.name, 'desc': p.description}
    return None

@app.post('/ai/route')
async def ai_route(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    intents = parse_intent(req.message)
    return {'intents': intents, 'prompt': 'You are a helpful AI assistant.'}

@app.post('/ai/context')
async def ai_ctx(req: ChatRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ctx = await get_proj_ctx(req.project_id, db) if req.project_id else None
    return {'message': req.message, 'project': ctx}

@app.post('/ai/chat')
async def ai_chat(req: ChatRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    intents = parse_intent(req.message)
    ctx = await get_proj_ctx(req.project_id, db) if req.project_id else None
    
    prompt = 'You are a helpful AI programming assistant.'
    if ctx:
        prompt = prompt + ' Current project: ' + ctx.get('name', '')
    
    try:
        r = await _http_client.post('/api/v1/chat/completions',
            headers={'X-API-Key': CLAWAPI_KEY},
            json={'model': 'default', 'message': prompt + ' User: ' + req.message},
            timeout=120.0)
        if r.status_code != 200:
            raise Exception(str(r.status_code))
        # Handle non-JSON response
        text = r.text
        import json
        try:
            data = r.json()
            msg = data.get('data',{}).get('content','') or data.get('text','')
        except:
            msg = text
    except Exception as e:
        return ChatResponse(ok=False, message='Error: ' + str(e))
    
    return ChatResponse(ok=True, message=msg)

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------



class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8)

@app.post("/auth/change-password", response_model=dict)
async def change_password(
    body: ChangePasswordRequest = Body(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not verify_password(body.old_password, user.password_hash):
        raise AuthError(status=401, code="INVALID_PASSWORD", message="Old password is incorrect")
    
    user.password_hash = hash_password(body.new_password)
    await db.commit()
    
    return {"ok": True, "message": "Password changed successfully"}

@app.get("/health", summary="Health check")

async def health(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    clawapi_ok = False
    try:
        resp = await _http_client.get("/health", timeout=5.0)
        clawapi_ok = resp.status_code == 200
    except Exception:
        pass

    return {
        "status": "healthy" if db_ok else "unhealthy",
        "service": "devpilot-auth",
        "version": "0.3.0",
        "jwt_algorithm": JWT_ALGORITHM,
        "clawapi_connected": clawapi_ok,
        "clawapi_url": CLAWAPI_URL,
    }


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=DEBUG)
