import asyncio
import logging
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from .auth import verify_token
from .config import get_settings
from .hub_reader import HubReader
from .hub_writer import HubWriter
from .logging_config import configure_logging
from .models import (
    ActivityResponse,
    CapturedItem,
    DeleteResponse,
    ItemsResponse,
    SaveRequest,
    SaveResponse,
    SearchResponse,
)
from .rate_limit import limiter

configure_logging()
logger = logging.getLogger("recall.api")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await app.state.writer.start()
    yield
    await app.state.writer.stop()


app = FastAPI(title="Recall API", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.state.writer = HubWriter(settings)
app.state.reader = HubReader(settings, app.state.writer.data_dir)


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


@app.post("/v1/save", response_model=SaveResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def save_item(payload: SaveRequest, request: Request, token: str = Depends(verify_token)) -> SaveResponse:
    now = datetime.now(timezone.utc)
    domain = urlparse(payload.url).hostname or ""
    item = CapturedItem(
        id=str(uuid.uuid4()),
        captureType=payload.captureType,
        url=payload.url,
        domain=domain,
        title=payload.title,
        content=payload.content,
        savedAt=now.isoformat(),
        dateKey=now.strftime("%Y-%m-%d"),
    )
    request.app.state.writer.save(item)
    if request.app.state.writer.should_flush_now():
        asyncio.create_task(request.app.state.writer.flush())
    return SaveResponse(item=item)


@app.get("/v1/items", response_model=ItemsResponse)
@limiter.limit("120/minute")
async def list_items(request: Request, date: str, token: str = Depends(verify_token)) -> ItemsResponse:
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
    items = request.app.state.reader.get_items_for_date(date)
    return ItemsResponse(date=date, items=items)


@app.get("/v1/search", response_model=SearchResponse)
@limiter.limit("60/minute")
async def search_items(request: Request, q: str, token: str = Depends(verify_token)) -> SearchResponse:
    if not q or not q.strip():
        raise HTTPException(status_code=400, detail="q must not be empty")
    items = request.app.state.reader.search(q.strip())
    return SearchResponse(query=q, items=items)


@app.get("/v1/activity", response_model=ActivityResponse)
@limiter.limit("60/minute")
async def activity(request: Request, days: int = 30, token: str = Depends(verify_token)) -> ActivityResponse:
    return ActivityResponse(counts=request.app.state.reader.activity_counts(days=min(days, 90)))


@app.delete("/v1/item/{item_id}", response_model=DeleteResponse)
@limiter.limit("30/minute")
async def delete_item(item_id: str, request: Request, token: str = Depends(verify_token)) -> DeleteResponse:
    deleted = request.app.state.writer.delete(item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="item not found")
    if request.app.state.writer.should_flush_now():
        asyncio.create_task(request.app.state.writer.flush())
    return DeleteResponse(id=item_id, deleted=True)
