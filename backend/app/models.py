from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, field_validator

CaptureType = Literal["selection", "full_page"]

MAX_CONTENT_LENGTH = 200_000
MAX_TITLE_LENGTH = 1000
MAX_URL_LENGTH = 4000


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
