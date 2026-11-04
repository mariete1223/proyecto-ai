#!/usr/bin/env python3
"""Backup cloud database (Neon PostgreSQL) to local SQLite and JSON snapshot.

Usage:
    uv run python scripts/backup_cloud_to_local.py
"""

from __future__ import annotations

import json
import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import psycopg
from psycopg.rows import dict_row

TABLES = [
    "users",
    "categories",
    "tags",
    "entries",
    "entry_tags",
    "save_preferences",
    "deletion_tombstones",
    "push_subscriptions",
]


def load_cloud_database_url() -> str:
    """Read DATABASE_URL from environment or .env file."""
    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]

    # Look in backend/.env, .env, etc.
    for candidate in [Path(".env"), Path("backend/.env"), Path("../.env")]:
        if candidate.exists():
            for line in candidate.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line.startswith("DATABASE_URL="):
                    val = line.split("=", 1)[1].strip().strip('"').strip("'")
                    if val:
                        return val

    raise RuntimeError(
        "No DATABASE_URL found. Please set DATABASE_URL or configure .env."
    )


def serialize_value_for_sqlite(val: Any) -> Any:
    """Format PostgreSQL types into SQLite-compatible types."""
    if val is None:
        return None
    if isinstance(val, bool):
        return 1 if val else 0
    if isinstance(val, datetime):
        return val.isoformat()
    return str(val) if not isinstance(val, (int, float, str, bytes)) else val


def serialize_value_for_json(val: Any) -> Any:
    """Format PostgreSQL types into JSON-serializable types."""
    if val is None:
        return None
    if isinstance(val, (datetime,)):
        return val.isoformat()
    if isinstance(val, (int, float, bool, str)):
        return val
    return str(val)


def run_backup() -> None:
    cloud_url = load_cloud_database_url()
    backend_dir = Path(__file__).resolve().parent.parent
    sqlite_path = backend_dir / "app.db"
    backup_dir = backend_dir / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = backup_dir / f"backup_{timestamp}.json"

    print("==================================================")
    print(" 📦 RESPALDO NUBE (Neon) ➔ LOCAL (SQLite & JSON)")
    print("==================================================")
    print(
        f"📡 Conectando a Neon: {cloud_url.split('@')[-1] if '@' in cloud_url else 'URL'}"
    )

    full_dump: dict[str, list[dict[str, Any]]] = {}
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row

    try:
        with psycopg.connect(cloud_url, row_factory=dict_row) as pg_conn:
            with pg_conn.cursor() as pg_cur:
                for table in TABLES:
                    # Check if table exists in PostgreSQL
                    pg_cur.execute(
                        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = %s);",
                        (table,),
                    )
                    res = pg_cur.fetchone()
                    if not res or not list(res.values())[0]:
                        continue

                    pg_cur.execute(f'SELECT * FROM "{table}";')
                    rows = pg_cur.fetchall()
                    full_dump[table] = [
                        {k: serialize_value_for_json(v) for k, v in r.items()}
                        for r in rows
                    ]

                    if not rows:
                        print(f"  • {table:<22} 0 filas (vacía)")
                        continue

                    # Insert / update into local SQLite
                    columns = list(rows[0].keys())
                    cols_str = ", ".join(f'"{c}"' for c in columns)
                    placeholders = ", ".join("?" for _ in columns)

                    insert_sql = f'INSERT OR REPLACE INTO "{table}" ({cols_str}) VALUES ({placeholders});'

                    with sqlite_conn:
                        for row in rows:
                            values = tuple(
                                serialize_value_for_sqlite(row[col]) for col in columns
                            )
                            sqlite_conn.execute(insert_sql, values)

                    print(f"  • {table:<22} {len(rows):>4} filas respaldadas")

        # Save JSON snapshot
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(full_dump, f, ensure_ascii=False, indent=2)

        print("--------------------------------------------------")
        print(f"✅ Base de datos local actualizada: {sqlite_path.name}")
        print(f"✅ Instantánea JSON generada:        backups/{json_path.name}")
        print("==================================================")

    finally:
        sqlite_conn.close()


if __name__ == "__main__":
    run_backup()
