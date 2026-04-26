# aios-console

Dev console for [aios](https://github.com/eumemic/aios) — a chat UI that exposes the session event log, span timings, triage decisions, and context payloads as first-class inspector panels.

## Quick start

Point the console at a running aios backend and go.

```bash
cp .env.example .env.local
# edit .env.local — set AIOS_URL and AIOS_API_KEY
pnpm install
pnpm dev
```

Open <http://localhost:3000>. The top nav shows **aios connected** (green dot) when it can reach the backend; if you see **aios unreachable** (red, pulsing), check that aios is running at `AIOS_URL` and the bearer token matches.

## Configuration

Everything that changes per-deployment is an env var — no code edits required.

| var | required | what it is |
|---|---|---|
| `AIOS_URL` | yes | Base URL of the aios API, e.g. `http://localhost:8090`. No trailing slash needed. |
| `AIOS_API_KEY` | yes | Bearer token that matches `AIOS_API_KEY` in the aios backend's `.env`. |

**Model provider keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, etc.) do not belong here.** They belong in the aios backend's `.env` — that's the process that actually calls LiteLLM. The console never handles them.

Local OpenAI-compatible servers (Ollama, vLLM/MLX, LM Studio, llama.cpp) also configure on the backend side: set `OPENAI_API_BASE=http://127.0.0.1:8080/v1` and `OPENAI_API_KEY=none` in aios's `.env`, then create an agent with model string `openai/<model-id>`.

## First-time setup in the UI

1. **Agents** → **+ new agent**. Give it a name (`chat`), a LiteLLM model URL (`openai/mlx-community/Qwen3.6-35B-A3B-4bit-DWQ`, `anthropic/claude-sonnet-4-6`, `openrouter/…`), a system prompt, and tick the tools you want. `search_events` always works; `bash`/`read`/`write`/`edit`/`glob`/`grep` need Docker on the aios host; `web_fetch`/`web_search` need `AIOS_TAVILY_API_KEY` on the backend.
2. **Environments** → **+ new environment**. One named `default` is enough for most setups.
3. **Sessions** → **+ new**. Pick the agent + environment you just created, optionally seed with a first message.

Once you've got an agent and an environment, the session view streams token deltas from the model in real time and exposes the full event log / span timings / triage decisions / reconstructed payload in the right-hand inspector.

## What's in the inspector

- **events** — every append to the session's event log, filterable by kind (message / lifecycle / span / interrupt) and a jsonb substring.
- **spans** — model call pairs with duration and per-request token usage.
- **triage** — `triage_decision` lifecycle events (empty unless the agent has a `triage` block configured on the backend).
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

On Vercel the proxy routes stream SSE correctly on Fluid Compute (Node runtime). Set `AIOS_URL` and `AIOS_API_KEY` in the Vercel env. For production, put a network-level protection in front of `AIOS_URL` — the console proxy doesn't add auth beyond the bearer key itself.

## Architecture

```
browser ──► Next.js route handlers ──► aios API
           (inject AIOS_API_KEY)       (http://localhost:8090 or wherever)
```

All aios calls go through `/api/aios/[...path]` (or `/api/aios/sessions/[id]/stream` for SSE). The bearer token only exists in Next's server-side env — it never reaches the browser.
