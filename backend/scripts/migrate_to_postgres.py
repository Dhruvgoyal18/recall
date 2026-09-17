"""One-time migration: import items from the old single-tenant JSONL-backed
backend into the new Postgres multi-tenant schema, tagged under one owner
account.

Run once, locally, against the OLD (still-live) backend and the NEW Postgres
database, before cutting the Railway service over to the new code:

    cd backend
    DATABASE_URL=postgresql+asyncpg://... JWT_SECRET=unused-here \\
        python scripts/migrate_to_postgres.py \\
        --old-backend-url https://recall-production-911c.up.railway.app \\
        --old-auth-token <old AUTH_TOKEN> \\
        --owner-email you@example.com \\
        --owner-password <new password> \\
        --days 90
"""

import argparse
import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.auth import hash_password  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.db_models import Base, Item, User  # noqa: E402


async def fetch_old_items(base_url: str, token: str, days: int) -> list[dict]:
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(base_url=base_url, headers=headers, timeout=30) as client:
        activity = await client.get("/v1/activity", params={"days": days})
        activity.raise_for_status()
        date_keys = sorted(activity.json()["counts"].keys())

        items: list[dict] = []
        for date_key in date_keys:
            resp = await client.get("/v1/items", params={"date": date_key})
            resp.raise_for_status()
            items.extend(resp.json()["items"])
        return items


async def migrate(args: argparse.Namespace) -> None:
    old_items = await fetch_old_items(args.old_backend_url, args.old_auth_token, args.days)
    print(f"Fetched {len(old_items)} item(s) from the old backend.")

    settings = get_settings()
    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as db:
        result = await db.execute(select(User).where(User.email == args.owner_email))
        owner = result.scalar_one_or_none()
        if owner is None:
            owner = User(email=args.owner_email, password_hash=hash_password(args.owner_password))
            db.add(owner)
            await db.commit()
            await db.refresh(owner)
            print(f"Created owner account {args.owner_email} ({owner.id}).")
        else:
            print(f"Owner account {args.owner_email} already exists ({owner.id}), reusing it.")

        imported = 0
        for raw in old_items:
            if raw.get("deleted"):
                continue
            existing = await db.execute(select(Item).where(Item.id == raw["id"]))
            if existing.scalar_one_or_none() is not None:
                continue
            db.add(
                Item(
                    id=raw["id"],
                    user_id=owner.id,
                    capture_type=raw["captureType"],
                    url=raw["url"],
                    domain=raw["domain"],
                    title=raw["title"],
                    content=raw["content"],
                    saved_at=datetime.fromisoformat(raw["savedAt"]),
                    date_key=raw["dateKey"],
                    deleted=False,
                )
            )
            imported += 1
        await db.commit()

    print(f"Imported {imported} item(s) into Postgres under {args.owner_email}.")
    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--old-backend-url", required=True)
    parser.add_argument("--old-auth-token", required=True)
    parser.add_argument("--owner-email", required=True)
    parser.add_argument("--owner-password", required=True)
    parser.add_argument("--days", type=int, default=90, help="How many days of activity to pull from the old backend")
    args = parser.parse_args()
    asyncio.run(migrate(args))


if __name__ == "__main__":
    main()
