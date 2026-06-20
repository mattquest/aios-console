import { test, expect, Route } from "@playwright/test";
import {
  AGENT_ID,
  ENV_ID,
  SESSION_ID,
  installMocks,
  type Fixture,
} from "./fixtures";

/**
 * First-run experience + plain-language error banners. The wizard only
 * appears when the backend reports zero agents; completing it lands the
 * user inside a live session.
 */

test("empty backend shows the wizard and the happy path reaches a session", async ({
  page,
}) => {
  const fx: Fixture = { sessions: [], events: [], sse: "" };
  await installMocks(page, fx);

  // Stateful agent/environment stores override the fixture defaults —
  // most-recently-registered route wins in Playwright.
  const agents: Record<string, unknown>[] = [];
  const envs: Record<string, unknown>[] = [];
  let agentCreateBody: Record<string, unknown> | null = null;

  await page.route("**/api/aios/v1/agents*", (route: Route) => {
    if (route.request().method() === "POST") {
      agentCreateBody = route.request().postDataJSON();
      const created = {
        id: AGENT_ID,
        version: 1,
        name: agentCreateBody?.name,
        model: agentCreateBody?.model,
        system: agentCreateBody?.system,
        description: null,
      };
      agents.push(created);
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(created),
      });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: agents, has_more: false, next_cursor: null }),
    });
  });

  await page.route("**/api/aios/v1/environments*", (route: Route) => {
    if (route.request().method() === "POST") {
      const created = { id: ENV_ID, name: "default" };
      envs.push(created);
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(created),
      });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: envs, has_more: false, next_cursor: null }),
    });
  });

  await page.goto("/");

  const wizard = page.getByTestId("first-run-wizard");
  await expect(wizard).toBeVisible();

  // Step 1 — agent: sensible defaults, preset fills the model string.
  await expect(page.getByTestId("wizard-agent-name")).toHaveValue("assistant");
  await expect(page.getByTestId("wizard-agent-system")).toHaveValue(
    "You are a helpful assistant.",
  );
  // Model is required — the button holds until one is chosen.
  await expect(page.getByTestId("wizard-create-agent")).toBeDisabled();
  await page.getByTestId("wizard-preset-anthropic").click();
  await expect(page.getByTestId("wizard-agent-model")).toHaveValue(
    "anthropic/claude-sonnet-4-6",
  );
  await page.getByTestId("wizard-create-agent").click();
  await expect(page.getByTestId("wizard-step-1")).toHaveAttribute(
    "data-state",
    "done",
  );
  expect(agentCreateBody).toMatchObject({
    name: "assistant",
    model: "anthropic/claude-sonnet-4-6",
  });

  // Step 2 — environment: one click.
  await page.getByTestId("wizard-create-environment").click();
  await expect(page.getByTestId("wizard-step-2")).toHaveAttribute(
    "data-state",
    "done",
  );

  // Step 3 — straight into the session.
  await page.getByTestId("wizard-start-session").click();
  await expect(page).toHaveURL(new RegExp(`/sessions/${SESSION_ID}$`));
  await expect(page.getByTestId("composer-input")).toBeVisible();
});

test("wizard reuses an existing environment instead of duplicating it", async ({
  page,
}) => {
  await installMocks(page, { sessions: [], events: [], sse: "" });
  // Zero agents, but an environment already exists (fixture default).
  await page.route("**/api/aios/v1/agents*", (route: Route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          id: AGENT_ID,
          version: 1,
          name: "assistant",
          model: "openai/gpt-5",
          system: "",
          description: null,
        }),
      });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ data: [], has_more: false, next_cursor: null }),
    });
  });

  await page.goto("/");
  await page.getByTestId("wizard-preset-openai").click();
  await page.getByTestId("wizard-create-agent").click();

  const envButton = page.getByTestId("wizard-create-environment");
  await expect(envButton).toContainText("use default");
  let envPosted = false;
  page.on("request", (r) => {
    if (
      r.method() === "POST" &&
      r.url().includes("/api/aios/v1/environments")
    ) {
      envPosted = true;
    }
  });
  await envButton.click();
  await expect(page.getByTestId("wizard-step-2")).toHaveAttribute(
    "data-state",
    "done",
  );
  expect(envPosted).toBe(false);
});

test("a 500 from aios renders as a plain-language banner with detail", async ({
  page,
}) => {
  await installMocks(page, { sessions: [], events: [], sse: "" });
  await page.route("**/api/aios/v1/agents*", (route: Route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ detail: "database exploded" }),
    }),
  );

  await page.goto("/agents");

  const banner = page.getByTestId("agents-error");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(
    "aios hit an internal error (HTTP 500)",
  );
  await expect(banner).toContainText("database exploded");
  // No raw status-line gibberish as the headline.
  await expect(banner).not.toContainText("Internal Server Error:");
});

test("a 401 names the API key as the likely fix", async ({ page }) => {
  await installMocks(page, { sessions: [], events: [], sse: "" });
  await page.route("**/api/aios/v1/agents*", (route: Route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "invalid bearer token" }),
    }),
  );

  await page.goto("/");

  const banner = page.getByTestId("home-error");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(
    "check AIOS_API_KEY in .env.local",
  );
});
