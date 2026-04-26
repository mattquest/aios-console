import { test, expect, Page, Route } from "@playwright/test";

/**
 * End-to-end smoke: create a session, post a message, watch the SSE
 * stream land events, and confirm the inspector surfaces triage +
 * spans. The aios backend is mocked at the proxy boundary so this runs
 * without a live Postgres or worker — the contract we're testing is
 * "given these bytes from aios, the UI renders correctly."
 */

const AGENT_ID = "agent_01TEST";
const SESSION_ID = "sess_01ABCDEF";

type Fixture = {
  sessions: unknown[];
  events: unknown[];
  sse: string;
};

function buildSse(events: Array<{ event: string; data: unknown }>): string {
  // Build a static SSE body. The proxy route handler pipes body-to-body,
  // so when Playwright fulfills with this string, the browser's
  // EventSource parses each frame as if aios had streamed it.
  return events
    .map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join("");
}

async function installMocks(page: Page, fx: Fixture) {
  await page.route("**/api/aios/v1/agents*", (route: Route) =>
    route.fulfill({
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
            triage: null,
          },
        ],
        has_more: false,
        next_after: null,
      }),
    }),
  );

  await page.route("**/api/aios/v1/sessions?*", (route: Route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: fx.sessions,
        has_more: false,
        next_after: null,
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
      body: JSON.stringify({
        id: SESSION_ID,
        agent_id: AGENT_ID,
        agent_version: 1,
        status: "idle",
        title: "smoke session",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
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
          next_after: null,
        }),
      }),
  );

  await page.route(
    `**/api/aios/sessions/${SESSION_ID}/stream`,
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

test("home renders session list and new-session dialog", async ({ page }) => {
  await installMocks(page, { sessions: [], events: [], sse: "" });
  await page.goto("/");

  await expect(page.getByTestId("session-list")).toBeVisible();
  await expect(page.getByText("no sessions yet")).toBeVisible();

  // New-session dialog opens with the fixture agent pre-selected.
  // The Select trigger reflects the chosen agent once the agent list loads.
  await page.getByTestId("new-session-button").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByTestId("create-session-submit")).toBeEnabled();
});

test("creating a session navigates to its page and streams events", async ({
  page,
}) => {
  const sse = buildSse([
    {
      event: "event",
      data: {
        id: "evt_01",
        session_id: SESSION_ID,
        seq: 1,
        kind: "message",
        data: { role: "user", content: "hello from smoke test" },
        created_at: new Date().toISOString(),
      },
    },
    { event: "delta", data: { delta: "hi " } },
    { event: "delta", data: { delta: "there" } },
    {
      event: "event",
      data: {
        id: "evt_02",
        session_id: SESSION_ID,
        seq: 2,
        kind: "message",
        data: { role: "assistant", content: "hi there" },
        created_at: new Date().toISOString(),
      },
    },
    {
      event: "event",
      data: {
        id: "evt_03",
        session_id: SESSION_ID,
        seq: 3,
        kind: "lifecycle",
        data: { event: "triage_decision", decision: "respond", reason: "addressed", reacting_to: 1 },
        created_at: new Date().toISOString(),
      },
    },
    {
      event: "event",
      data: {
        id: "evt_04",
        session_id: SESSION_ID,
        seq: 4,
        kind: "span",
        data: { event: "model_request_start" },
        created_at: new Date(Date.now() - 250).toISOString(),
      },
    },
    {
      event: "event",
      data: {
        id: "evt_05",
        session_id: SESSION_ID,
        seq: 5,
        kind: "span",
        data: {
          event: "model_request_end",
          model_request_start_id: "evt_04",
          is_error: false,
          model_usage: { input_tokens: 42, output_tokens: 11 },
        },
        created_at: new Date().toISOString(),
      },
    },
  ]);

  await installMocks(page, { sessions: [], events: [], sse });
  await page.goto("/");

  await page.getByTestId("new-session-button").click();
  await page.getByTestId("create-session-submit").click();

  await expect(page).toHaveURL(new RegExp(`/sessions/${SESSION_ID}$`));

  // Persisted messages render in the chat.
  await expect(page.getByTestId("message-user")).toContainText(
    "hello from smoke test",
  );
  await expect(page.getByTestId("message-assistant")).toContainText("hi there");

  // Event log surfaces the full log including non-message events.
  await expect(page.getByTestId("event-row-3")).toBeVisible();
  await expect(page.getByTestId("event-row-3")).toHaveAttribute(
    "data-kind",
    "lifecycle",
  );

  // Triage tab shows the respond verdict.
  await page.getByRole("tab", { name: /triage/i }).click();
  await expect(page.getByTestId(`triage-3`)).toContainText("respond");
  await expect(page.getByTestId(`triage-3`)).toContainText("addressed");

  // Spans tab shows the measured model call.
  await page.getByRole("tab", { name: /spans/i }).click();
  await expect(page.getByText("model_request")).toBeVisible();
  await expect(page.getByText(/input_tokens/)).toBeVisible();
});
