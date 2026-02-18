import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema, jsonResult } from "openclaw/plugin-sdk";

const ATLAS_BASE = (process.env.ATLAS_MEMORY_BASE_URL || "http://127.0.0.1:6420").replace(/\/$/, "");

type AtlasSearchItem = {
  id: string;
  title?: string;
  content?: string;
  score?: number;
  updated_at?: string;
};

async function atlasSearch(query: string, limit: number): Promise<AtlasSearchItem[]> {
  const res = await fetch(`${ATLAS_BASE}/memories/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit }),
  });
  if (!res.ok) throw new Error(`Atlas search failed: ${res.status}`);
  const data = (await res.json()) as { results?: AtlasSearchItem[] };
  return Array.isArray(data?.results) ? data.results : [];
}

async function atlasGet(id: string): Promise<{ id: string; title?: string; content?: string }> {
  const res = await fetch(`${ATLAS_BASE}/memories/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Atlas get failed: ${res.status}`);
  return (await res.json()) as { id: string; title?: string; content?: string };
}

function extractAtlasId(path: string): string | null {
  if (!path) return null;
  if (path.startsWith("atlas:")) return path.slice("atlas:".length).trim() || null;

  // support memory/atlas/Foo_<uuid>.md style paths
  const m = path.match(/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i);
  return m?.[1] ?? null;
}

function toLinesSlice(text: string, from?: number, lines?: number): string {
  if (!Number.isFinite(from) || !Number.isFinite(lines) || (from ?? 0) <= 0 || (lines ?? 0) <= 0) {
    return text;
  }
  const arr = text.split(/\r?\n/);
  const start = Math.max(0, Math.floor((from as number) - 1));
  const end = Math.min(arr.length, start + Math.floor(lines as number));
  return arr.slice(start, end).join("\n");
}

export default {
  id: "atlas-memory-opencalw-plugin",
  name: "Atlas Memory OpenCalw Plugin",
  description: "Atlas-backed memory_search/memory_get with OpenClaw-compatible result shape",
  kind: "memory",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerTool(
      {
        label: "Memory Search",
        name: "memory_search",
        description:
          "Atlas-backed recall: search prior work, decisions, dates, people, preferences, and todos.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string" },
            maxResults: { type: "number" },
            minScore: { type: "number" },
          },
          required: ["query"],
          additionalProperties: false,
        },
        execute: async (_toolCallId: string, params: any) => {
          try {
            const query = String(params?.query ?? "").trim();
            const maxResults = Math.max(1, Math.min(20, Number(params?.maxResults ?? 8) || 8));
            const minScore = Number.isFinite(Number(params?.minScore)) ? Number(params?.minScore) : undefined;

            if (!query) {
              return jsonResult({ results: [], provider: "atlas", mode: "atlas-direct" });
            }

            const rows = await atlasSearch(query, maxResults);
            const filtered = minScore == null ? rows : rows.filter((r) => (Number(r.score ?? 0) >= minScore));

            const results = filtered.map((r) => {
              const full = String(r.content ?? "");
              const snippet = full.length > 1200 ? `${full.slice(0, 1200)}...` : full;
              return {
                // OpenClaw memory tool convention
                path: `atlas:${r.id}`,
                text: snippet,
                score: Number(r.score ?? 0),

                // extra fields for compatibility/UX
                title: r.title,
                relPath: `atlas:${r.id}`,
                lineStart: 1,
                lineEnd: Math.max(1, snippet.split(/\r?\n/).length),
                snippet,
              };
            });

            return jsonResult({
              results,
              provider: "atlas",
              model: "atlas-memory",
              fallback: "none",
              mode: "atlas-direct",
            });
          } catch (err) {
            return jsonResult({
              results: [],
              disabled: true,
              error: err instanceof Error ? err.message : String(err),
              provider: "atlas",
              mode: "atlas-direct",
            });
          }
        },
      } as any,
      { names: ["memory_search"] },
    );

    api.registerTool(
      {
        label: "Memory Get",
        name: "memory_get",
        description: "Read Atlas memory content by path atlas:<id>.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string" },
            from: { type: "number" },
            lines: { type: "number" },
          },
          required: ["path"],
          additionalProperties: false,
        },
        execute: async (_toolCallId: string, params: any) => {
          const path = String(params?.path ?? "").trim();
          try {
            const id = extractAtlasId(path);
            if (!id) {
              return jsonResult({
                path,
                text: "",
                disabled: true,
                error: "Path must be atlas:<id> (or include an Atlas UUID).",
              });
            }
            const mem = await atlasGet(id);
            const full = String(mem?.content ?? "");
            const text = toLinesSlice(full, Number(params?.from), Number(params?.lines));
            return jsonResult({
              path: `atlas:${id}`,
              text,
              title: mem?.title,
            });
          } catch (err) {
            return jsonResult({
              path,
              text: "",
              disabled: true,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        },
      } as any,
      { names: ["memory_get"] },
    );
  },
};
