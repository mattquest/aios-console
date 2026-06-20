import { Page, Route } from "@playwright/test";

/**
 * Shared mock plumbing for the e2e specs. The aios backend is mocked at
 * the proxy boundary so tests run without a live Postgres or worker —
 * the contract under test is "given these bytes from aios, the UI
 * renders correctly."
 */

export const AGENT_ID = "agent_01TEST";
export const ENV_ID = "env_01TEST";
export const SESSION_ID = "sess_01ABCDEF";

export type Fixture = {
  sessions: unknown[];
  events: unknown[];
  sse: string;
  /**
   * Override for ``GET /v1/sessions/:id``. Read at fulfill time, so a test
   * can mutate it mid-flight (e.g. clear ``awaiting`` after an approval
   * POST) and the next poll sees the new state.
   */
  session?: Record<string, unknown>;
};

export function buildSse(events: Array<{ event: string; data: unknown }>): string {
  // Build a static SSE body. The proxy route handler pipes body-to-body,
  // so when Playwright fulfills with this string, the browser's
  // EventSource parses each frame as if aios had streamed it.
  return events
    .map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join("");
}

export function defaultSession(): Record<string, unknown> {
  return {
    id: SESSION_ID,
    agent_id: AGENT_ID,
    agent_version: 1,
    status: "idle",
    title: "smoke session",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function installMocks(page: Page, fx: Fixture) {
  // Default healthy readiness payload for the TopNav status strip. Tests
  // that exercise degraded states register their own route AFTER this one —
  // Playwright matches the most recently registered route first.
  await page.route("**/api/aios/v1/health/ready", (route: Route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        status: "ready",
        db: true,
        worker: { alive: true, last_heartbeat: new Date().toISOString() },
        connections: [],
      }),
    }),
  );

  await page.route(`**/api/aios/v1/agents/${AGENT_ID}`, (route: Route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: AGENT_ID,
        version: 1,
        name: "test-agent",
        model: "anthropic/claude-sonnet-4-6",
        system: "",
        description: null,
      }),
    }),
  );

  await page.route("**/api/aios/v1/agents*", (route: Route) => {
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: AGENT_ID,
            version: 1,
            name: "test-agent",
            model: "anthropic/claude-sonnet-4-6",
            system: "",
            description: null,
          },
        ],
        has_more: false,
        next_cursor: null,
      }),
    });
  });

  await page.route("**/api/aios/v1/environments*", (route: Route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [{ id: ENV_ID, name: "default" }],
        has_more: false,
        next_cursor: null,
      }),
    }),
  );

  await page.route("**/api/aios/v1/sessions?*", (route: Route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: fx.sessions,
        has_more: false,
        next_cursor: null,
      }),
    }),
  );

  await page.route("**/api/aios/v1/sessions", (route: Route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const created = {
      id: SESSION_ID,
      agent_id: AGENT_ID,
      agent_version: null,
      status: "running",
      title: "smoke session",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    fx.sessions.push(created);
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(created),
    });
  });

  await page.route(`**/api/aios/v1/sessions/${SESSION_ID}`, (route: Route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(fx.session ?? defaultSession()),
    }),
  );

  await page.route(
    `**/api/aios/v1/sessions/${SESSION_ID}/events*`,
    (route: Route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: fx.events,
          has_more: false,
          next_cursor: null,
        }),
      }),
  );

  await page.route(
    `**/api/aios/sessions/${SESSION_ID}/stream*`,
    (route: Route) =>
      route.fulfill({
        contentType: "text/event-stream",
        headers: { "cache-control": "no-cache" },
        body: fx.sse,
      }),
  );

  await page.route(
    `**/api/aios/v1/sessions/${SESSION_ID}/messages`,
    (route: Route) => route.fulfill({ status: 200, body: "{}" }),
  );
}
