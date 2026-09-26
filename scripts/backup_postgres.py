from __future__ import annotations

import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def load_database_url() -> str:
    configured = os.environ.get("DATABASE_URL")
    if configured:
        return configured
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("DATABASE_URL="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("DATABASE_URL is required")


def main() -> None:
    backup_dir = ROOT / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    destination = backup_dir / f"civis-{timestamp}.dump"
    environment = {
        **os.environ,
        "DATABASE_URL": load_database_url(),
        "BACKUP_FILE": destination.name,
    }
    subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "-e",
            "DATABASE_URL",
            "-e",
            "BACKUP_FILE",
            "-v",
            f"{backup_dir}:/backups",
            "postgres:17-alpine",
            "sh",
            "-c",
            'pg_dump --format=custom --no-owner --file "/backups/$BACKUP_FILE" "$DATABASE_URL"',
        ],
        check=True,
        env=environment,
    )
    print(destination)


if __name__ == "__main__":
    main()
