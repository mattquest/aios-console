import { test, expect } from "@playwright/test";
import { AGENT_ID, SESSION_ID, buildSse, installMocks } from "./fixtures";

/**
 * Targeted accessibility contract: the SSE chat announces assistant
 * replies via a polite live region, color-only status dots carry an
 * accessible name, icon-only controls are labelled, and essential
 * microtext (ids) exposes its full value via title.
 */

const FULL_CALL_ID = "call_01HXAMPLE7Q4R9W2T6Y8U0I3O5";

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

test("chat exposes a polite live region announcing assistant replies", async ({
  page,
}) => {
  const sse = buildSse([
    messageFrame(1, { role: "user", content: "ping" }),
    messageFrame(2, { role: "assistant", content: "pong — all systems go" }),
  ]);
  await installMocks(page, { sessions: [], events: [], sse });
  await page.goto(`/sessions/${SESSION_ID}`);

  const region = page.getByTestId("chat-live-region");
  await expect(region).toHaveAttribute("aria-live", "polite");
  // role="status" makes it queryable the way AT users consume it.
  await expect(page.getByRole("status")).toContainText(
    "pong — all systems go",
  );
});

test("session status dots carry an accessible name, not just a color", async ({
  page,
}) => {
  const now = new Date().toISOString();
  await installMocks(page, {
    sessions: [
      {
        id: SESSION_ID,
        agent_id: AGENT_ID,
        agent_version: 1,
        status: "idle",
        title: "calm session",
        created_at: now,
        updated_at: now,
      },
    ],
    events: [],
    sse: "",
  });
  await page.goto("/");

  // The rail row's only status carrier is the dot — it must be named.
  await expect(
    page.getByTestId("session-list").getByRole("img", { name: "idle" }),
  ).toBeVisible();
});

test("icon-only inspector trigger is labelled at narrow widths", async ({
  page,
}) => {
  await installMocks(page, { sessions: [], events: [], sse: "" });
  // Below lg the desktop rail is gone and the sheet trigger appears;
  // below sm its "inspect" word is hidden, leaving only the icon.
  await page.setViewportSize({ width: 600, height: 900 });
  await page.goto(`/sessions/${SESSION_ID}`);

  await expect(
    page.getByRole("button", { name: "open inspector" }),
  ).toBeVisible();
});

test("truncated tool-call ids expose the full id via title", async ({
  page,
}) => {
  const sse = buildSse([
    messageFrame(1, {
      role: "tool",
      tool_call_id: FULL_CALL_ID,
      name: "bash",
      content: "ok",
    }),
  ]);
  await installMocks(page, { sessions: [], events: [], sse });
  await page.goto(`/sessions/${SESSION_ID}`);

  const idTag = page.getByTestId("message-tool").locator(`[title="${FULL_CALL_ID}"]`);
  await expect(idTag).toBeVisible();
  // The visible text stays truncated; the title carries the whole id.
  await expect(idTag).toHaveText(FULL_CALL_ID.slice(0, 12));
});
