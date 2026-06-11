import { test, expect, Page, Route } from "@playwright/test";
import { SESSION_ID, installMocks } from "./fixtures";

/**
 * Usage page: three granularity tabs over GET /v1/usage, mocked at the
 * proxy boundary in the fixtures style. Pins the cost-honesty rendering:
 * token sums always shown; the unknown-cost footnote appears exactly when
 * the fixture reports requests without cost data.
 */

const SESSION_ID_2 = "sess_01UNTITLED";

const DAY_ROWS = [
  {
    key: "2026-06-08",
    session_title: null,
    input_tokens: 12000,
    output_tokens: 1500,
    cache_read_tokens: 9000,
    cache_creation_tokens: 400,
    requests: 4,
    cost_usd_known: 0.1012,
    cost_usd_estimated_null_requests: 0,
  },
  {
    key: "2026-06-09",
    session_title: null,
    input_tokens: 50000,
    output_tokens: 8000,
    cache_read_tokens: 31000,
    cache_creation_tokens: 1200,
    requests: 10,
    cost_usd_known: 0.42,
    cost_usd_estimated_null_requests: 3,
  },
];

const SESSION_ROWS = [
  {
    key: SESSION_ID,
    session_title: "smoke session",
    input_tokens: 40000,
    output_tokens: 7000,
    cache_read_tokens: 25000,
    cache_creation_tokens: 900,
    requests: 9,
    cost_usd_known: 0.38,
    cost_usd_estimated_null_requests: 3,
  },
  {
    key: SESSION_ID_2,
    session_title: null,
    input_tokens: 22000,
    output_tokens: 2500,
    cache_read_tokens: 15000,
    cache_creation_tokens: 700,
    requests: 5,
    cost_usd_known: 0.1412,
    cost_usd_estimated_null_requests: 0,
  },
];

const MODEL_ROWS = [
  {
    key: "anthropic/claude-sonnet-4-6",
    session_title: null,
    input_tokens: 62000,
    output_tokens: 9500,
    cache_read_tokens: 40000,
    cache_creation_tokens: 1600,
    requests: 14,
    cost_usd_known: 0.5212,
    cost_usd_estimated_null_requests: 0,
  },
];

async function installUsageMock(page: Page): Promise<string[]> {
  const requested: string[] = [];
  await page.route("**/api/aios/v1/usage*", (route: Route) => {
    const url = new URL(route.request().url());
    requested.push(url.search);
    const granularity = url.searchParams.get("granularity") ?? "day";
    const rows =
      granularity === "session"
        ? SESSION_ROWS
        : granularity === "model"
          ? MODEL_ROWS
          : DAY_ROWS;
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        granularity,
        since: url.searchParams.get("since"),
        until: null,
        rows,
      }),
    });
  });
  return requested;
}

test("nav exposes 04 usage and the day tab renders totals, bars, and the footnote", async ({
  page,
}) => {
  await installMocks(page, { sessions: [], events: [], sse: "" });
  await installUsageMock(page);
  await page.goto("/");

  // "04 usage" in the top-nav idiom: numbered link.
  const navLink = page.getByTestId("top-nav").getByRole("link", { name: /04\s*usage/ });
  await expect(navLink).toBeVisible();
  await navLink.click();
  await expect(page).toHaveURL(/\/usage$/);

  // Day granularity is the default; fixture numbers render.
  const table = page.getByTestId("usage-table");
  await expect(table).toContainText("50,000");
  await expect(table).toContainText("12,000");
  await expect(table).toContainText("8,000");
  await expect(table).toContainText("2026-06-09");
  await expect(table).toContainText("$0.42");

  // One bar per day, plain divs.
  await expect(page.getByTestId("usage-bar-2026-06-08")).toBeVisible();
  await expect(page.getByTestId("usage-bar-2026-06-09")).toBeVisible();

  // 3 requests on 06-09 carried no cost — the footnote says so, exactly.
  await expect(page.getByTestId("unknown-cost-footnote")).toContainText(
    "3 requests without cost data",
  );
});

test("session tab links rows to their session pages", async ({ page }) => {
  await installMocks(page, { sessions: [], events: [], sse: "" });
  await installUsageMock(page);
  await page.goto("/usage");
  await expect(page.getByTestId("usage-table")).toBeVisible();

  await page.getByTestId("usage-tab-session").click();

  // Titled session: title shown, id beneath, row links to /sessions/:id.
  const titled = page.getByTestId(`usage-session-link-${SESSION_ID}`);
  await expect(titled).toContainText("smoke session");
  await expect(titled).toHaveAttribute("href", `/sessions/${SESSION_ID}`);

  // Untitled session falls back to its id.
  const untitled = page.getByTestId(`usage-session-link-${SESSION_ID_2}`);
  await expect(untitled).toContainText(SESSION_ID_2);
  await expect(untitled).toHaveAttribute("href", `/sessions/${SESSION_ID_2}`);

  await expect(page.getByTestId("usage-table")).toContainText("40,000");
  await expect(page.getByTestId("unknown-cost-footnote")).toContainText(
    "3 requests without cost data",
  );
});

test("model tab renders fixture numbers and omits the footnote when every cost is known", async ({
  page,
}) => {
  await installMocks(page, { sessions: [], events: [], sse: "" });
  await installUsageMock(page);
  await page.goto("/usage");
  await expect(page.getByTestId("usage-table")).toBeVisible();

  await page.getByTestId("usage-tab-model").click();

  const table = page.getByTestId("usage-table");
  await expect(table).toContainText("anthropic/claude-sonnet-4-6");
  await expect(table).toContainText("62,000");
  await expect(table).toContainText("9,500");
  await expect(table).toContainText("$0.5212");

  // Every request in the fixture carried a cost — no footnote, no asterisk.
  await expect(page.getByTestId("unknown-cost-footnote")).toHaveCount(0);
});

test("range presets pass since to the endpoint; all clears it", async ({
  page,
}) => {
  await installMocks(page, { sessions: [], events: [], sse: "" });
  const requested = await installUsageMock(page);
  await page.goto("/usage");
  await expect(page.getByTestId("usage-table")).toBeVisible();

  // Default range is 30d: first request carries a since bound.
  expect(requested[0]).toContain("since=");

  const allRequest = page.waitForRequest(
    (r) => r.url().includes("/v1/usage") && !r.url().includes("since="),
  );
  await page.getByTestId("usage-range-all").click();
  await allRequest;
  await expect(page.getByTestId("usage-table")).toBeVisible();
});
