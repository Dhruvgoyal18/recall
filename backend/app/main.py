import logging
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import create_access_token, get_current_user, hash_password, verify_password
from .config import get_settings
from .db import get_db, init_db
from .db_models import Item, User
from .logging_config import configure_logging
from .models import (
    ActivityResponse,
    AuthResponse,
    CapturedItem,
    DeleteResponse,
    ItemsResponse,
    LoginRequest,
    SaveRequest,
    SaveResponse,
    SearchResponse,
    SignupRequest,
)
from .rate_limit import limiter

configure_logging()
logger = logging.getLogger("recall.api")
settings = get_settings()

GENERIC_AUTH_ERROR = "invalid email or password"
GENERIC_SIGNUP_CONFLICT = "an account with that email already exists"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Recall API", version="2.0.0", lifespan=lifespan)
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(status_code=429, content={"detail": "rate limit exceeded"})


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def request_logging(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start = time.time()
    response = None
    try:
        response = await call_next(request)
        return response
    finally:
        duration_ms = round((time.time() - start) * 1000, 2)
        logger.info(
            "request",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code if response else 500,
                "duration_ms": duration_ms,
            },
        )


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "time": time.time()}


def _to_captured_item(row: Item) -> CapturedItem:
    return CapturedItem(
        id=row.id,
        captureType=row.capture_type,
        url=row.url,
        domain=row.domain,
        title=row.title,
        content=row.content,
        savedAt=row.saved_at.isoformat(),
        dateKey=row.date_key,
        deleted=row.deleted,
    )


@app.post("/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def signup(payload: SignupRequest, request: Request, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=GENERIC_SIGNUP_CONFLICT)

    user = User(email=payload.email, password_hash=hash_password(payload.password))
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=GENERIC_SIGNUP_CONFLICT)
    await db.refresh(user)

    token, expires_at = create_access_token(user.id, settings)
    return AuthResponse(token=token, expiresAt=expires_at.isoformat())


@app.post("/auth/login", response_model=AuthResponse)
@limiter.limit("20/minute")
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GENERIC_AUTH_ERROR)

    token, expires_at = create_access_token(user.id, settings)
    return AuthResponse(token=token, expiresAt=expires_at.isoformat())


@app.post("/v1/save", response_model=SaveResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def save_item(
    payload: SaveRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SaveResponse:
    now = datetime.now(timezone.utc)
    domain = urlparse(payload.url).hostname or ""
    row = Item(
        id=str(uuid.uuid4()),
        user_id=user.id,
        capture_type=payload.captureType,
        url=payload.url,
        domain=domain,
        title=payload.title,
        content=payload.content,
        saved_at=now,
        date_key=now.strftime("%Y-%m-%d"),
    )
    db.add(row)
    await db.commit()
    return SaveResponse(item=_to_captured_item(row))


@app.get("/v1/items", response_model=ItemsResponse)
@limiter.limit("120/minute")
async def list_items(
    request: Request,
    date: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ItemsResponse:
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")

    result = await db.execute(
        select(Item)
        .where(Item.user_id == user.id, Item.date_key == date, Item.deleted.is_(False))
        .order_by(Item.saved_at.desc())
    )
    items = [_to_captured_item(row) for row in result.scalars().all()]
    return ItemsResponse(date=date, items=items)


@app.get("/v1/search", response_model=SearchResponse)
@limiter.limit("60/minute")
async def search_items(
    request: Request,
    q: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SearchResponse:
    if not q or not q.strip():
        raise HTTPException(status_code=400, detail="q must not be empty")

    pattern = f"%{q.strip()}%"
    result = await db.execute(
        select(Item)
        .where(
            Item.user_id == user.id,
            Item.deleted.is_(False),
            (Item.title.ilike(pattern) | Item.content.ilike(pattern) | Item.url.ilike(pattern)),
        )
        .order_by(Item.saved_at.desc())
    )
    items = [_to_captured_item(row) for row in result.scalars().all()]
    return SearchResponse(query=q, items=items)


@app.get("/v1/activity", response_model=ActivityResponse)
@limiter.limit("60/minute")
async def activity(
    request: Request,
    days: int = 30,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ActivityResponse:
    days = min(days, 90)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    result = await db.execute(
        select(Item.date_key).where(
            Item.user_id == user.id,
            Item.deleted.is_(False),
            Item.date_key >= cutoff,
        )
    )
    counts: dict[str, int] = {}
    for (date_key,) in result.all():
        counts[date_key] = counts.get(date_key, 0) + 1
    return ActivityResponse(counts=counts)


@app.delete("/v1/item/{item_id}", response_model=DeleteResponse)
@limiter.limit("30/minute")
async def delete_item(
    item_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeleteResponse:
    result = await db.execute(select(Item).where(Item.id == item_id, Item.user_id == user.id))
    row = result.scalar_one_or_none()
    if row is None or row.deleted:
        raise HTTPException(status_code=404, detail="item not found")

    row.deleted = True
    await db.commit()
    return DeleteResponse(id=item_id, deleted=True)
