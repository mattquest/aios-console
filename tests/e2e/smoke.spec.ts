import { test, expect, Route } from "@playwright/test";
import { AGENT_ID, SESSION_ID, buildSse, installMocks } from "./fixtures";

/**
 * End-to-end smoke: create a session, post a message, watch the SSE
 * stream land events, and confirm the inspector surfaces the event log
 * and spans. Mock plumbing lives in ./fixtures.ts.
 */

test("home renders session list and new-session dialog", async ({ page }) => {
  await installMocks(page, { sessions: [], events: [], sse: "" });
  await page.goto("/");

  await expect(page.getByTestId("session-list")).toBeVisible();
  await expect(page.getByText(/no sessions/i)).toBeVisible();

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
        data: { event: "stayed_silent", reason: "no new messages" },
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
    // A non-model span pair: every *_end carries a back-pointer named
    // after its kind (step_start_id here). These used to render stuck
    // at "in flight…" because only model_request_start_id was resolved.
    {
      event: "event",
      data: {
        id: "evt_06",
        session_id: SESSION_ID,
        seq: 6,
        kind: "span",
        data: { event: "step_start" },
        created_at: new Date(Date.now() - 180).toISOString(),
      },
    },
    {
      event: "event",
      data: {
        id: "evt_07",
        session_id: SESSION_ID,
        seq: 7,
        kind: "span",
        data: { event: "step_end", step_start_id: "evt_06" },
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

  // Spans tab shows the measured model call, and the completed step
  // span resolves to a duration instead of sticking at "in flight…".
  await page.getByRole("tab", { name: /spans/i }).click();
  // Exact match: the events tab's row summaries (model_request_start/_end)
  // can transiently share the DOM while the tab panels swap.
  await expect(page.getByText("model_request", { exact: true })).toBeVisible();
  await expect(page.getByText(/input_tokens/)).toBeVisible();
  await expect(page.getByText("step", { exact: true })).toBeVisible();
  await expect(page.getByText(/in flight/)).toHaveCount(0);
});

test("a missing session renders not-found, not an empty chat", async ({
  page,
}) => {
  await installMocks(page, { sessions: [], events: [], sse: "" });

  const GONE_ID = "sess_01DELETED";
  await page.route(`**/api/aios/v1/sessions/${GONE_ID}*`, (route: Route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ detail: "session not found" }),
    }),
  );
  await page.route(`**/api/aios/sessions/${GONE_ID}/stream`, (route: Route) =>
    route.fulfill({ status: 404, body: "" }),
  );

  await page.goto(`/sessions/${GONE_ID}`);

  await expect(page.getByTestId("session-not-found")).toBeVisible();
  await expect(page.getByTestId("session-not-found")).toContainText(GONE_ID);
  // No composer — a stale link must not invite typing into the void.
  await expect(page.getByTestId("composer-input")).toHaveCount(0);
});

test("health strip surfaces a dead worker and a live connector", async ({
  page,
}) => {
  await installMocks(page, { sessions: [], events: [], sse: "" });

  // Worker heartbeat stopped 4 minutes ago — the strip must hold that as
  // "down since" and render a duration, not just a binary red dot.
  const heartbeat = new Date(Date.now() - 4 * 60_000).toISOString();
  await page.route("**/api/aios/v1/health/ready", (route: Route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        status: "degraded",
        db: true,
        worker: { alive: false, last_heartbeat: heartbeat },
        connections: [
          {
            id: "conn_01SIGNAL",
            connector: "signal",
            external_account_id: "+15555550100",
            alive: true,
            last_heartbeat_at: new Date().toISOString(),
          },
        ],
      }),
    }),
  );

  await page.goto("/");

  await expect(page.getByTestId("aios-health")).toHaveAttribute(
    "data-state",
    "degraded",
  );
  // 503 still carried a body, so the api itself reads as up.
  await expect(page.getByTestId("health-cell-api")).toHaveAttribute(
    "data-state",
    "up",
  );
  const wrk = page.getByTestId("health-cell-wrk");
  await expect(wrk).toHaveAttribute("data-state", "down");
  await expect(wrk).toContainText("wrk/down 4m");
  await expect(wrk).toHaveAttribute("title", heartbeat);
  const sig = page.getByTestId("health-cell-signal");
  await expect(sig).toHaveAttribute("data-state", "up");
  await expect(sig).toContainText("signal/online");
});

test("health strip degrades to api-only when /health/ready is absent", async ({
  page,
}) => {
  await installMocks(page, { sessions: [], events: [], sse: "" });

  // Deployed aios predates the endpoint: 404 means "api up, components
  // unknown" — the nav must render the api cell alone, not crash or go red.
  await page.route("**/api/aios/v1/health/ready", (route: Route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Not Found" }),
    }),
  );

  await page.goto("/");

  await expect(page.getByTestId("top-nav")).toBeVisible();
  await expect(page.getByTestId("aios-health")).toHaveAttribute(
    "data-state",
    "ok",
  );
  await expect(page.getByTestId("health-cell-api")).toContainText("api/online");
  await expect(page.getByTestId("health-cell-wrk")).toHaveCount(0);
  // Rest of the page still works.
  await expect(page.getByTestId("session-list")).toBeVisible();
});

test("needs-attention panel partitions errored and awaiting sessions", async ({
  page,
}) => {
  const now = new Date().toISOString();
  const sessions = [
    {
      id: "sess_01CALM",
      agent_id: AGENT_ID,
      agent_version: 1,
      status: "idle",
      title: "all quiet",
      created_at: now,
      updated_at: now,
    },
    {
      id: "sess_01ERR",
      agent_id: AGENT_ID,
      agent_version: 1,
      status: "idle",
      stop_reason: { type: "error", message: "boom" },
      title: "exploded run",
      created_at: now,
      updated_at: now,
    },
    {
      id: "sess_01WAIT",
      agent_id: AGENT_ID,
      agent_version: 1,
      status: "active",
      awaiting: [
        { tool_call_id: "tc_01", name: "send_message", kind: "builtin" },
      ],
      title: "approval pending",
      created_at: now,
      updated_at: now,
    },
  ];
  await installMocks(page, { sessions, events: [], sse: "" });
  await page.goto("/");

  await expect(page.getByTestId("needs-attention")).toBeVisible();

  const errored = page.getByTestId("attention-sess_01ERR");
  await expect(errored).toHaveAttribute("data-status", "errored");
  await expect(errored).toHaveAttribute("href", "/sessions/sess_01ERR");
  await expect(errored).toContainText("exploded run");
  await expect(errored.locator(".text-signal-alert")).toBeVisible();

  const waiting = page.getByTestId("attention-sess_01WAIT");
  await expect(waiting).toHaveAttribute("data-status", "needs you");
  await expect(waiting).toHaveAttribute("href", "/sessions/sess_01WAIT");
  // Pending tool names from session.awaiting surface in the row.
  await expect(waiting).toContainText("send_message");
  await expect(waiting.locator(".text-signal-warn").first()).toBeVisible();

  // Healthy sessions stay out of the triage panel.
  await expect(page.getByTestId("attention-sess_01CALM")).toHaveCount(0);
});

test("needs-attention panel is absent when every session is healthy", async ({
  page,
}) => {
  const now = new Date().toISOString();
  const sessions = [
    {
      id: "sess_01IDLE",
      agent_id: AGENT_ID,
      agent_version: 1,
      status: "idle",
      title: "calm session",
      created_at: now,
      updated_at: now,
    },
  ];
  await installMocks(page, { sessions, events: [], sse: "" });
  await page.goto("/");

  // Wait for the list to land before asserting absence of the panel.
  await expect(page.getByText("calm session")).toBeVisible();
  await expect(page.getByTestId("needs-attention")).toHaveCount(0);
});
