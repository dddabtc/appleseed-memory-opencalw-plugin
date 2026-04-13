#!/usr/bin/env python3
"""File watcher that syncs workspace memory .md files to Atlas Memory.

Watches:
  1. /home/ubuntu/clawd/memory/  — daily notes
  2. /root/.openclaw/workspace/MEMORY.md — long-term memory
"""

import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Config
WATCH_DIRS = [
    Path("/home/ubuntu/clawd/memory"),
]
WATCH_FILES = [
    Path("/root/.openclaw/workspace/MEMORY.md"),
]
STATE_FILE = Path.home() / ".openclaw" / "atlas-memory-sync" / "state.json"
ATLAS_URL = "http://localhost:6420/memories"
HOSTNAME = "op225"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("atlas-sync")


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            log.warning("Corrupt state file, starting fresh")
    return {}


def save_state(state: dict):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2))


def make_source(filepath: Path) -> str:
    """Determine source tag based on file location."""
    s = str(filepath)
    if "MEMORY.md" in s:
        return "openclaw-longterm"
    return "openclaw-daily"


def sync_file(filepath: Path, state: dict) -> bool:
    """Sync a single .md file to Atlas. Returns True if synced."""
    if not filepath.is_file() or filepath.suffix != ".md":
        return False

    key = str(filepath)
    try:
        mtime = filepath.stat().st_mtime
    except OSError:
        return False

    # Skip if mtime unchanged
    if key in state and state[key].get("mtime") == mtime:
        return False

    try:
        content = filepath.read_text(encoding="utf-8")
    except OSError as e:
        log.error("Failed to read %s: %s", filepath, e)
        return False

    if not content.strip():
        return False

    source = make_source(filepath)
    existing_id = state.get(key, {}).get("atlas_id")

    payload = {
        "content": content,
        "title": filepath.stem,
        "source": source,
        "metadata": {
            "source_host": HOSTNAME,
            "file": filepath.name,
            "path": key,
            "synced_at": datetime.now(timezone.utc).isoformat(),
        },
    }

    try:
        if existing_id:
            # Update existing memory
            resp = requests.patch(f"{ATLAS_URL}/{existing_id}", json=payload, timeout=10)
            if resp.status_code == 404:
                # Memory was deleted, create new
                existing_id = None
                resp = requests.post(ATLAS_URL, json=payload, timeout=10)
        else:
            resp = requests.post(ATLAS_URL, json=payload, timeout=10)

        resp.raise_for_status()
        data = resp.json()
        atlas_id = data.get("id") or existing_id or "unknown"
        state[key] = {"mtime": mtime, "atlas_id": atlas_id}
        save_state(state)
        action = "updated" if existing_id else "created"
        log.info("%s %s -> %s", action, filepath.name, atlas_id)
        return True
    except Exception as e:
        log.error("Failed to sync %s: %s", filepath.name, e)
        return False


def initial_scan(state: dict):
    """Scan all .md files and sync any missing/changed ones."""
    count = 0
    for d in WATCH_DIRS:
        if not d.exists():
            log.warning("Watch dir does not exist: %s", d)
            continue
        for f in sorted(d.glob("*.md")):
            if sync_file(f, state):
                count += 1
    for f in WATCH_FILES:
        if sync_file(f, state):
            count += 1
    log.info("Initial scan complete: %d files synced", count)


class SyncHandler(FileSystemEventHandler):
    def __init__(self, state: dict):
        self.state = state

    def on_created(self, event):
        if not event.is_directory:
            self._handle(event.src_path)

    def on_modified(self, event):
        if not event.is_directory:
            self._handle(event.src_path)

    def on_moved(self, event):
        if not event.is_directory:
            self._handle(event.dest_path)

    def _handle(self, path):
        p = Path(path)
        if p.suffix == ".md":
            time.sleep(0.5)
            sync_file(p, self.state)


def main():
    log.info("Starting atlas-memory-sync")
    state = load_state()
    initial_scan(state)

    observer = Observer()
    handler = SyncHandler(state)

    for d in WATCH_DIRS:
        d.mkdir(parents=True, exist_ok=True)
        observer.schedule(handler, str(d), recursive=False)
        log.info("Watching directory: %s", d)

    for f in WATCH_FILES:
        if f.parent.exists():
            observer.schedule(handler, str(f.parent), recursive=False)
            log.info("Watching file: %s", f)

    observer.start()

    try:
        while True:
            # Periodic re-scan every 5 minutes to catch missed changes
            time.sleep(300)
            for f in WATCH_FILES:
                sync_file(f, state)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
    log.info("Stopped.")


if __name__ == "__main__":
    main()
