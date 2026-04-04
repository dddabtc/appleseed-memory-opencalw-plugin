# atlas-memory-opencalw-plugin

Atlas-backed replacement for OpenClaw `memory_search`, `memory_get`, and `memory_save`.

## Purpose

Provide a stable, rollback-friendly way to route memory recall directly to Atlas Memory,
without hot-editing OpenClaw stock plugin files.

Updated for the OpenClaw 2026.4.x plugin SDK:
- uses `definePluginEntry(...)`
- uses typed `before_prompt_build(event, ctx)` hooks
- uses SDK `jsonResult(...)`
- registers typed tools without `as any`

## Plugin ID

`atlas-memory-opencalw-plugin`

## Features

- `memory_search`
- `memory_get`
- `memory_save`
- `memory_write` alias for save/update flows
- automatic Atlas memory recall injection before prompt build

## Install / Enable

```bash
openclaw plugins install /home/ubuntu/.openclaw/plugins/atlas-memory-opencalw-plugin --link
openclaw gateway restart
```

Then verify:

```bash
openclaw status
openclaw plugins list | grep -E "atlas-memory-opencalw-plugin|memory-core|memory-lancedb"
```

## Config

This plugin reads config from the existing OpenClaw plugin entry:

```json
{
  "plugins": {
    "entries": {
      "atlas-memory-opencalw-plugin": {
        "enabled": true,
        "config": {
          "baseUrl": "http://100.119.6.34:6420",
          "timeoutMs": 5000,
          "autoInject": true,
          "autoInjectLimit": 5,
          "autoInjectMinScore": 0.04
        }
      }
    }
  }
}
```

It also respects these fallbacks, in order:
1. `agents.defaults.memorySearch.remote.baseUrl`
2. plugin `config.baseUrls`
3. plugin `config.baseUrl`
4. `ATLAS_MEMORY_BASE_URL`
5. `ATLAS_BASE_URL`

## API Contract (Atlas)

- Search: `POST /memories/search` with `{ query, limit }`
- Get: `GET /memories/{id}`
- Create: `POST /memories`
- Update: `PATCH /memories/{id}`

## Notes

- Keeps compatibility with Atlas API endpoints already in use.
- Keeps existing OpenClaw config shape; no `openclaw.json` migration required.
- `memory_get` accepts either:
  - `atlas:<uuid>`
  - any path containing an Atlas UUID

## Rollback

```bash
openclaw plugins disable atlas-memory-opencalw-plugin
openclaw plugins enable memory-core
openclaw gateway restart
```
