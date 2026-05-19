from __future__ import annotations

import secrets
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any


class SystemConfigStore:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=30, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    @contextmanager
    def _connection(self):
        conn = self._connect()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS config (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL DEFAULT ''
                )
                """
            )

    def get_system_config(self, key: str, default: str = "") -> str:
        with self._connection() as conn:
            row = conn.execute("SELECT value FROM config WHERE key = ?", (key,)).fetchone()
        if row is None:
            return default
        return str(row["value"] or "")

    def set_system_config(self, key: str, value: str) -> None:
        with self._connection() as conn:
            conn.execute(
                """
                INSERT INTO config (key, value)
                VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """,
                (key, value),
            )

    def get_system_config_flag(self, key: str, default: bool = False) -> bool:
        return self.get_system_config(key, "1" if default else "0") == "1"

    def get_system_config_snapshot(self) -> dict[str, Any]:
        return {
            "public_statistics": self.get_system_config_flag("public_statistics", False),
            "title_enabled": self.get_system_config_flag("flag.title", False),
            "title": self.get_system_config("value.title", ""),
            "external_registration_enabled": self.get_system_config_flag(
                "flag.external_registration",
                False,
            ),
            "email_verification_enabled": self.get_system_config_flag(
                "flag.email_verification",
                False,
            ),
        }

    def update_system_config_snapshot(self, data: dict[str, Any]) -> None:
        self.set_system_config(
            "public_statistics",
            "1" if bool(data.get("public_statistics")) else "0",
        )
        self.set_system_config(
            "flag.title",
            "1" if bool(data.get("title_enabled")) else "0",
        )
        self.set_system_config("value.title", str(data.get("title", "")))
        self.set_system_config(
            "flag.external_registration",
            "1" if bool(data.get("external_registration_enabled")) else "0",
        )
        self.set_system_config(
            "flag.email_verification",
            "1" if bool(data.get("email_verification_enabled")) else "0",
        )

    def get_effective_title(self, fallback: str = "") -> str:
        if not self.get_system_config_flag("flag.title", False):
            return fallback
        value = self.get_system_config("value.title", "").strip()
        return value or fallback

    def get_or_create_session_secret(self, fallback_secret: str = "") -> str:
        if fallback_secret.strip() == "change-this-session-secret":
            fallback_secret = ""
        with self._connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute(
                "SELECT value FROM config WHERE key = ?",
                ("system.session_secret",),
            ).fetchone()
            if row is not None:
                current = str(row["value"] or "")
                if current:
                    return current

            value = fallback_secret or secrets.token_urlsafe(48)
            conn.execute(
                """
                INSERT INTO config (key, value)
                VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """,
                ("system.session_secret", value),
            )
            return value
