from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, EmailStr, field_validator

CaptureType = Literal["selection", "full_page"]

MAX_CONTENT_LENGTH = 200_000
MAX_TITLE_LENGTH = 1000
MAX_URL_LENGTH = 4000
MIN_PASSWORD_LENGTH = 8
# bcrypt only considers the first 72 bytes of a password; anything longer is
# silently ignored by some implementations and rejected outright by others.
MAX_PASSWORD_BYTES = 72


def _normalize_email(v: str) -> str:
    return v.strip().lower()


class CapturedItem(BaseModel):
    id: str
    captureType: CaptureType
    url: str
    domain: str
    title: str
    content: str
    savedAt: str
    dateKey: str
    deleted: bool = False


class SaveRequest(BaseModel):
    captureType: CaptureType
    url: str
    title: str = ""
    content: str

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if len(v) > MAX_URL_LENGTH:
            raise ValueError(f"url exceeds max length of {MAX_URL_LENGTH}")
        parsed = urlparse(v)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise ValueError("url must be an absolute http(s) URL")
        return v

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("content must not be empty")
        if len(v) > MAX_CONTENT_LENGTH:
            raise ValueError(f"content exceeds max length of {MAX_CONTENT_LENGTH}")
        return v

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        return v[:MAX_TITLE_LENGTH]


class SaveResponse(BaseModel):
    item: CapturedItem


class ItemsResponse(BaseModel):
    date: str
    items: list[CapturedItem]


class SearchResponse(BaseModel):
    query: str
    items: list[CapturedItem]


class DeleteResponse(BaseModel):
    id: str
    deleted: bool


class ActivityResponse(BaseModel):
    counts: dict[str, int]


class SignupRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return _normalize_email(v)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < MIN_PASSWORD_LENGTH:
            raise ValueError(f"password must be at least {MIN_PASSWORD_LENGTH} characters")
        if len(v.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValueError(f"password exceeds max length of {MAX_PASSWORD_BYTES} bytes")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return _normalize_email(v)


class AuthResponse(BaseModel):
    token: str
    expiresAt: str
