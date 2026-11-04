#!/usr/bin/env python3
"""Restore or push local SQLite database to cloud database (Neon PostgreSQL).

Usage:
    uv run python scripts/restore_local_to_cloud.py
"""

from __future__ import annotations

import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import psycopg

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

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

BOOLEAN_COLUMNS = {"is_verified", "reminder_enabled"}


def load_cloud_database_url() -> str:
    """Read DATABASE_URL from environment or .env file."""
    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]

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


def convert_value_for_postgres(col_name: str, val: Any) -> Any:
    if val is None:
        return None
    if col_name in BOOLEAN_COLUMNS:
        return bool(val)
    if isinstance(val, str) and ("_at" in col_name or "_time" in col_name):
        try:
            return datetime.fromisoformat(val)
        except Exception:
            return val
    return val


def run_restore() -> None:
    cloud_url = load_cloud_database_url()
    backend_dir = Path(__file__).resolve().parent.parent
    sqlite_path = backend_dir / "app.db"

    if not sqlite_path.exists():
        raise FileNotFoundError(
            f"No se encontró la base de datos local en {sqlite_path}"
        )

    print("==================================================")
    print(" 🚀 MIGRACIÓN / RESTAURACIÓN LOCAL ➔ NUBE (Neon)")
    print("==================================================")
    print(
        f"📡 Conectando a Neon: {cloud_url.split('@')[-1] if '@' in cloud_url else 'URL'}"
    )

    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row

    try:
        # Pre-check valid user categories to handle orphans gracefully
        valid_user_cats: set[tuple[str, str]] = set()
        user_default_cat: dict[str, str] = {}
        for cat in sqlite_conn.execute(
            "SELECT id, user_id, kind, name FROM categories"
        ).fetchall():
            valid_user_cats.add((str(cat["user_id"]), str(cat["id"])))
            if cat["user_id"] not in user_default_cat or cat["name"] == "Notas":
                user_default_cat[str(cat["user_id"])] = str(cat["id"])

        with psycopg.connect(cloud_url) as pg_conn:
            with pg_conn.cursor() as pg_cur:
                for table in TABLES:
                    rows = sqlite_conn.execute(f"SELECT * FROM {table}").fetchall()
                    if not rows:
                        print(f"  • {table:<22} 0 filas (omitida)")
                        continue

                    columns = list(rows[0].keys())
                    cols_str = ", ".join(f'"{c}"' for c in columns)
                    placeholders = ", ".join("%s" for _ in columns)

                    if table == "entry_tags":
                        conflict_clause = "ON CONFLICT (id) DO NOTHING"
                    elif table == "push_subscriptions":
                        conflict_clause = "ON CONFLICT (id) DO NOTHING"
                    elif "id" in columns:
                        conflict_clause = "ON CONFLICT (id) DO NOTHING"
                    else:
                        conflict_clause = ""

                    insert_sql = f"INSERT INTO {table} ({cols_str}) VALUES ({placeholders}) {conflict_clause};"

                    count = 0
                    for r in rows:
                        r_dict = dict(r)
                        if table == "entries":
                            u_id = str(r_dict["user_id"])
                            c_id = str(r_dict["category_id"])
                            if (u_id, c_id) not in valid_user_cats:
                                r_dict["category_id"] = user_default_cat.get(u_id, c_id)

                        data = tuple(
                            convert_value_for_postgres(c, r_dict[c]) for c in columns
                        )
                        pg_cur.execute(insert_sql, data)
                        count += 1

                    print(f"  • {table:<22} {count:>4} filas migradas/verificadas")

                pg_conn.commit()
                print("--------------------------------------------------")
                print("✅ Restauración en la nube completada con éxito.")
                print("==================================================")
    finally:
        sqlite_conn.close()


if __name__ == "__main__":
    run_restore()
