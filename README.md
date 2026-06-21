# aios-console

Dev console for [aios](https://github.com/eumemic/aios) — a chat UI that exposes the session event log, span timings, and context payloads as first-class inspector panels.

## Quick start

Point the console at a running aios backend and go.

```bash
cp .env.example .env.local
# edit .env.local — set AIOS_URL and AIOS_API_KEY
pnpm install
pnpm dev
```

Open <http://localhost:3000>. The top nav shows **aios connected** (green dot) when it can reach the backend; if you see **aios unreachable** (red, pulsing), check that aios is running at `AIOS_URL` and the bearer token matches.

## Ops dashboard (`/ops`)

When `AIOS_RUNTIME_PATH` points at the live deployment repo (default `~/Code/aios-runtime`), the console exposes:

- **`/ops`** — open watchdog incidents, session link, maintainer log tail
- **Sidebar strip** — compact alert for open incidents on the sessions view
- **`/api/ops/status`** — JSON probe used by the UI

Set `AIOS_RUNTIME_PATH` in `.env.local` if the runtime repo lives elsewhere.

## Session chat: channel provenance

Inbound connector messages (Signal DMs, groups) show **colored provenance banners** so they are easy to distinguish from console/API traffic. Outbound `signal_send` replies are labeled separately. Metadata comes from `metadata.channel` on user events in the aios event log.

## Configuration

Everything that changes per-deployment is an env var — no code edits required.

| var | required | what it is |
|---|---|---|
| `AIOS_URL` | yes | Base URL of the aios API, e.g. `http://localhost:8090`. No trailing slash needed. |
| `AIOS_API_KEY` | yes | Bearer token that matches `AIOS_API_KEY` in the aios backend's `.env`. |
| `AIOS_RUNTIME_PATH` | no | Path to `aios-runtime` for `/ops` (default `~/Code/aios-runtime`). |
| `CONSOLE_PASSWORD` | no | Operator login gate; required for non-loopback deploys. |

**Model provider keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, etc.) do not belong here.** They belong in the aios backend's `.env` — that's the process that actually calls LiteLLM. The console never handles them.

Local OpenAI-compatible servers (Ollama, vLLM/MLX, LM Studio, llama.cpp) also configure on the backend side: set `OPENAI_API_BASE=http://127.0.0.1:8080/v1` and `OPENAI_API_KEY=none` in aios's `.env`, then create an agent with model string `openai/<model-id>`.

## First-time setup in the UI

1. **Agents** → **+ new agent**. Give it a name (`chat`), a LiteLLM model URL (`openai/mlx-community/Qwen3.6-35B-A3B-4bit-DWQ`, `anthropic/claude-sonnet-4-6`, `openrouter/…`), a system prompt, and tick the tools you want. `search_events` always works; `bash`/`read`/`write`/`edit`/`glob`/`grep` need Docker on the aios host; `web_fetch`/`web_search` need `AIOS_TAVILY_API_KEY` on the backend.
2. **Environments** → **+ new environment**. One named `default` is enough for most setups.
3. **Sessions** → **+ new**. Pick the agent + environment you just created, optionally seed with a first message.

Once you've got an agent and an environment, the session view streams token deltas from the model in real time and exposes the full event log / span timings / reconstructed payload in the right-hand inspector.

## What's in the inspector

- **events** — every append to the session's event log, filterable by kind (message / lifecycle / span / interrupt) and a jsonb substring.
- **spans** — model call pairs with duration and per-request token usage.
- **payload** — reconstructed chat-completions message list for the most recent model call. Approximates what aios sent LiteLLM; the authoritative dump is `AIOS_DUMP_CONTEXT` on the worker.

## Running the tests

```bash
pnpm exec playwright install chromium
pnpm exec playwright test
```

The smoke suite mocks aios at the proxy boundary so it runs without a live backend.

## Deploying

Built-ins:

```bash
pnpm build        # production bundle
pnpm start        # production server
```

`pnpm start` binds **127.0.0.1 only** — the console wields the full-privilege `AIOS_API_KEY` on every proxied request, so it must never sit on an open interface unauthenticated. To use it from other machines, set `CONSOLE_PASSWORD` in the env (all pages and `/api/aios/*` then require login at `/login`) and run `pnpm start:exposed` behind TLS (reverse proxy) or a VPN like Tailscale.

On Vercel the proxy routes stream SSE correctly on Fluid Compute (Node runtime). Set `AIOS_URL`, `AIOS_API_KEY`, and `CONSOLE_PASSWORD` in the Vercel env, and put network-level protection in front of `AIOS_URL` itself.

For the backend's trust boundaries, defaults, and operator hardening checklist, see [aios SECURITY.md](https://github.com/eumemic/aios/blob/master/SECURITY.md) and [DATA-HANDLING.md](https://github.com/eumemic/aios/blob/master/docs/DATA-HANDLING.md).

## Architecture

```
browser ──► Next.js route handlers ──► aios API
           (inject AIOS_API_KEY)       (http://localhost:8090 or wherever)
```

All aios calls go through `/api/aios/[...path]` (or `/api/aios/sessions/[id]/stream` for SSE). The bearer token only exists in Next's server-side env — it never reaches the browser.
