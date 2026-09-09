from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def _key_func(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        return "token:" + auth[len("Bearer ") :][:32]
    return get_remote_address(request)


limiter = Limiter(key_func=_key_func, default_limits=[])
