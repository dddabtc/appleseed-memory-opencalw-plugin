# atlas-memory-sync

File watcher that syncs Markdown notes into [Atlas Memory](https://github.com/dddabtc/atlas-memory) as memories.

## What it does

- Watches `/home/ubuntu/clawd/memory/*.md` (daily notes) and `/root/.openclaw/workspace/MEMORY.md` (long-term memory)
- On any create / modify / move, POSTs (or PATCHes if already synced) the file content to `http://localhost:6420/memories`
- Tracks mtime → atlas_id mapping in `~/.openclaw/atlas-memory-sync/state.json` so files are only re-uploaded when changed
- Periodic 5-minute rescan guards against missed inotify events

## Install

```bash
sudo bash install.sh
```

This copies `sync.py` to `/root/.openclaw/atlas-memory-sync/` and installs the systemd unit. The service is started immediately and enabled on boot.

## Configuration

Paths are currently hard-coded at the top of `sync.py`. Edit `WATCH_DIRS` / `WATCH_FILES` / `ATLAS_URL` before install if you need different locations.

## Verify

```bash
systemctl status atlas-memory-sync
journalctl -u atlas-memory-sync -f
```

You should see lines like `created 2026-04-13.md -> <uuid>` when new files appear in the watched directories.
