import { test, expect, Route } from "@playwright/test";
import { SESSION_ID, buildSse, installMocks, type Fixture } from "./fixtures";

/**
 * Incremental transcript: the newest page loads via the events API, the
 * SSE stream tails from where it ended, and "load earlier" pages older
 * history in through the backward cursor.
 */

function evt(seq: number, role: string, content: string) {
  return {
    id: `evt_${String(seq).padStart(2, "0")}`,
    session_id: SESSION_ID,
    seq,
    kind: "message",
    data: { role, content },
    created_at: new Date(Date.now() - (100 - seq) * 1000).toISOString(),
  };
}

test("loads the newest page, tails live events, and pages earlier history in", async ({
  page,
}) => {
  const fx: Fixture = {
    sessions: [],
    events: [],
    sse: buildSse([{ event: "event", data: evt(13, "assistant", "live tail message") }]),
  };
  await installMocks(page, fx);

  let firstPageQuery: URLSearchParams | null = null;
  await page.route(
    `**/api/aios/v1/sessions/${SESSION_ID}/events*`,
    (route: Route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("cursor") === "cur_older") {
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            data: [evt(2, "assistant", "second oldest message"), evt(1, "user", "oldest message")],
            has_more: false,
            next_cursor: null,
          }),
        });
      }
      firstPageQuery = url.searchParams;
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          data: [evt(12, "assistant", "newest message"), evt(11, "user", "recent question")],
          has_more: true,
          next_cursor: "cur_older",
        }),
      });
    },
  );

  const streamReq = page.waitForRequest((r) =>
    r.url().includes(`/api/aios/sessions/${SESSION_ID}/stream`),
  );
  await page.goto(`/sessions/${SESSION_ID}`);

  // Newest window renders without the full log. (Scoped to the chat pane —
  // the inspector echoes message text in its event-row summaries.)
  const chat = page.getByTestId("chat-messages");
  await expect(chat.getByText("newest message")).toBeVisible();
  await expect(chat.getByText("recent question")).toBeVisible();
  await expect(chat.getByText("oldest message", { exact: true })).toHaveCount(0);

  // First page asked for the newest tail.
  expect(firstPageQuery!.get("dir")).toBe("backward");
  expect(firstPageQuery!.get("limit")).toBe("100");

  // The SSE tail starts after the loaded window — no double replay.
  const req = await streamReq;
  expect(new URL(req.url()).searchParams.get("after_seq")).toBe("12");
  // …and live events still append.
  await expect(chat.getByText("live tail message")).toBeVisible();

  // Page older history in.
  const earlier = page.getByTestId("load-earlier");
  await expect(earlier).toBeVisible();
  await earlier.click();
  await expect(chat.getByText("oldest message", { exact: true })).toBeVisible();
  await expect(chat.getByText("second oldest message")).toBeVisible();
  // History exhausted — the affordance goes away.
  await expect(page.getByTestId("load-earlier")).toHaveCount(0);

  // Transcript order is by seq, oldest first.
  const seqs = await page
    .locator("[data-testid=message-user], [data-testid=message-assistant]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-seq")));
  expect(seqs).toEqual(["1", "2", "11", "12", "13"]);
});
