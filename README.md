# atlas-memory-opencalw-plugin

Atlas-backed replacement for OpenClaw `memory_search` / `memory_get`.

## Purpose

Provide a **stable, rollback-friendly** way to route memory recall directly to Atlas Memory,
without hot-editing OpenClaw stock plugin files.

## Plugin ID

`atlas-memory-opencalw-plugin`

## Load Strategy

1. Put plugin directory in `plugins.internal.load.extraDirs`
2. Enable this plugin entry
3. Disable stock `memory-core` entry
4. Restart gateway

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
