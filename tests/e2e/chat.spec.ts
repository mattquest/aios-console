import { test, expect, Route } from "@playwright/test";
import {
  SESSION_ID,
  buildSse,
  defaultSession,
  installMocks,
  type Fixture,
} from "./fixtures";

/**
 * Chat-surface honesty: connector sends read as assistant speech,
 * monologue stays private-by-default, multimodal content renders instead
 * of crashing, approvals are actionable inline, and the composer never
 * locks while the session runs.
 */

// 1x1 transparent PNG — realistic stand-in for an image_url data URI.
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function messageFrame(seq: number, data: Record<string, unknown>) {
  return {
    event: "event",
    data: {
      id: `evt_${String(seq).padStart(2, "0")}`,
      session_id: SESSION_ID,
      seq,
      kind: "message",
      data,
      created_at: new Date().toISOString(),
    },
  };
}

test("connector send renders as a first-class assistant bubble", async ({
  page,
}) => {
  const sse = buildSse([
    messageFrame(1, { role: "user", content: "ping the user" }),
    messageFrame(2, {
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: "call_send_01",
          type: "function",
          function: {
            name: "signal_send",
            arguments: JSON.stringify({
              text: "on my way — see you at **seven**",
            }),
          },
        },
      ],
    }),
  ]);
  await installMocks(page, { sessions: [], events: [], sse });
  await page.goto(`/sessions/${SESSION_ID}`);

  const bubble = page.getByTestId("connector-send");
  await expect(bubble).toBeVisible();
  await expect(bubble).toContainText("on my way");
  // Markdown renders (no raw asterisks).
  await expect(bubble.locator("strong")).toHaveText("seven");
  await expect(bubble).toContainText("sent via signal_send");
  // It must NOT also render as a collapsed invoke card.
  await expect(page.getByText("invoke")).toHaveCount(0);
  // Persisted messages carry a timestamp in the gutter.
  await expect(page.getByTestId("message-time").first()).toBeVisible();
});

test("internal monologue is collapsed by default and expandable", async ({
  page,
}) => {
  const sse = buildSse([
    messageFrame(1, {
      role: "assistant",
      content:
        "INTERNAL_MONOLOGUE_NOT_SEEN_BY_USER: the user has not replied yet, I will wait",
    }),
  ]);
  await installMocks(page, { sessions: [], events: [], sse });
  await page.goto(`/sessions/${SESSION_ID}`);

  const mono = page.getByTestId("monologue");
  await expect(mono).toBeVisible();
  await expect(mono).toContainText("thinking");
  // Body hidden until disclosed; the raw prefix never shows.
  await expect(mono).not.toContainText("the user has not replied yet");
  await page.getByTestId("monologue-toggle").click();
  await expect(mono).toContainText("the user has not replied yet");
  await expect(mono).not.toContainText("INTERNAL_MONOLOGUE_NOT_SEEN_BY_USER");
});

test("multimodal message renders text and image without crashing", async ({
  page,
}) => {
  const sse = buildSse([
    messageFrame(1, {
      role: "user",
      content: [
        { type: "text", text: "what is in this picture?" },
        { type: "image_url", image_url: { url: TINY_PNG } },
      ],
    }),
  ]);
  await installMocks(page, { sessions: [], events: [], sse });
  await page.goto(`/sessions/${SESSION_ID}`);

  await expect(page.getByTestId("message-user")).toContainText(
    "what is in this picture?",
  );
  const img = page.getByTestId("message-image");
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute("src", TINY_PNG);
  // Full size opens in a new tab via the wrapping anchor.
  const link = page.getByTestId("message-image-link");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("href", TINY_PNG);
  // No error boundary fired.
  await expect(page.getByTestId("error-card")).toHaveCount(0);
});

test("approval card surfaces the pending tool and allow POSTs the decision", async ({
  page,
}) => {
  const fx: Fixture = {
    sessions: [],
    events: [],
    sse: buildSse([
      messageFrame(1, { role: "user", content: "clean up the tmp dir" }),
      messageFrame(2, {
        role: "assistant",
        content: "",
        tool_calls: [
          {
            id: "tc_99",
            type: "function",
            function: {
              name: "bash",
              arguments: JSON.stringify({ command: "rm -rf /tmp/scratch" }),
            },
          },
        ],
      }),
    ]),
    session: {
      ...defaultSession(),
      status: "active",
      awaiting: [{ tool_call_id: "tc_99", name: "bash", kind: "builtin" }],
    },
  };
  await installMocks(page, fx);

  let confirmationBody: Record<string, unknown> | null = null;
  await page.route(
    `**/api/aios/v1/sessions/${SESSION_ID}/tool-confirmations`,
    (route: Route) => {
      confirmationBody = route.request().postDataJSON();
      // The backend records the confirmation; the next session poll no
      // longer reports the call as awaiting.
      fx.session = { ...defaultSession(), status: "active" };
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "evt_90",
          session_id: SESSION_ID,
          seq: 3,
          kind: "lifecycle",
          data: { event: "tool_confirmation", result: "allow" },
          created_at: new Date().toISOString(),
        }),
      });
    },
  );

  await page.goto(`/sessions/${SESSION_ID}`);

  const card = page.getByTestId("approval-card-bash");
  await expect(card).toBeVisible();
  await expect(card).toContainText("test-agent wants to run");
  await expect(card).toContainText("bash");
  // Args summary comes from the pending tool_call in the log.
  await expect(card).toContainText("command: rm -rf /tmp/scratch");

  await page.getByTestId("approve-bash").click();
  await expect(card).toHaveCount(0);
  expect(confirmationBody).toEqual({ tool_call_id: "tc_99", result: "allow" });
});

test("composer stays enabled while the session is running", async ({
  page,
}) => {
  const fx: Fixture = {
    sessions: [],
    events: [],
    sse: buildSse([messageFrame(1, { role: "user", content: "long task" })]),
    session: { ...defaultSession(), status: "active" },
  };
  await installMocks(page, fx);
  await page.goto(`/sessions/${SESSION_ID}`);

  const input = page.getByTestId("composer-input");
  await expect(input).toBeVisible();
  await expect(input).toBeEnabled();
  // The in-flight affordance shows ALONGSIDE the input, not instead of it.
  await expect(page.getByTestId("interrupt-button")).toBeVisible();

  await input.fill("also do this please");
  await expect(page.getByTestId("composer-send")).toBeEnabled();
  const posted = page.waitForRequest(
    (r) =>
      r.url().includes(`/api/aios/v1/sessions/${SESSION_ID}/messages`) &&
      r.method() === "POST",
  );
  await page.getByTestId("composer-send").click();
  const req = await posted;
  expect(req.postDataJSON()).toEqual({ content: "also do this please" });
  await expect(input).toHaveValue("");
});
