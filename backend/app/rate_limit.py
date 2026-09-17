import jwt
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from .config import get_settings


def _key_func(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        token = auth[len("Bearer ") :]
        try:
            settings = get_settings()
            payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        except jwt.PyJWTError:
            payload = None
        if payload and payload.get("sub"):
            return "user:" + payload["sub"]
    return get_remote_address(request)


limiter = Limiter(key_func=_key_func, default_limits=[])
