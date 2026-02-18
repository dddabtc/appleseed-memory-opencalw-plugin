# atlas-memory-opencalw-plugin

Atlas-backed replacement for OpenClaw `memory_search` / `memory_get`.

## Purpose

Provide a **stable, rollback-friendly** way to route memory recall directly to Atlas Memory,
without hot-editing OpenClaw stock plugin files.

## Plugin ID

`atlas-memory-opencalw-plugin`

## Install / Enable

```bash
# install from local path
openclaw plugins install /home/ubuntu/clawd/plugins/atlas-memory-opencalw-plugin --link

# restart to load
openclaw gateway restart
```

After install, OpenClaw will switch the `memory` slot to this plugin.
You can verify with:

```bash
openclaw plugins list | grep -E "atlas-memory-opencalw-plugin|memory-core|memory-lancedb"
```

## Rollback

```bash
# disable atlas plugin
openclaw plugins disable atlas-memory-opencalw-plugin

# enable stock memory-core
openclaw plugins enable memory-core

# restart
openclaw gateway restart
```

## Env

- `ATLAS_MEMORY_BASE_URL` (optional)
  - default: `http://127.0.0.1:6420`

## API Contract (Atlas)

- Search: `POST /memories/search` with `{ query, limit }`
- Get: `GET /memories/{id}`

## Notes

- This plugin returns `jsonResult(...)` with OpenClaw-compatible fields to avoid tool runtime shape errors.
- Supports `memory_get` path as either:
  - `atlas:<uuid>`
  - any path containing Atlas UUID (e.g. `memory/atlas/Foo_<uuid>.md`)
