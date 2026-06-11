import { test, expect, Page } from "@playwright/test";
import { AGENT_ID, SESSION_ID, installMocks } from "./fixtures";

/**
 * ⌘K command palette: the composer help row advertises it, so it must
 * exist — open/close, fuzzy filtering, keyboard navigation, session
 * jumping off the polled list, and the inspector toggle on session pages.
 */

/**
 * Hydration-safe open: the ⌘K listener attaches in a client effect, so a
 * chord fired straight after goto can land before React hydrates on a cold
 * server. Retry until the palette actually appears.
 */
async function openPalette(page: Page) {
  await expect(async () => {
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByTestId("command-palette")).toBeVisible({
      timeout: 1000,
    });
  }).toPass({ timeout: 10_000 });
}

const now = () => new Date().toISOString();

function titledSession() {
  return {
    id: SESSION_ID,
    agent_id: AGENT_ID,
    agent_version: 1,
    status: "idle",
    title: "deploy the staging stack",
    created_at: now(),
    updated_at: now(),
  };
}

test("⌘k opens the palette, esc closes it", async ({ page }) => {
  await installMocks(page, { sessions: [], events: [], sse: "" });
  await page.goto("/");

  await openPalette(page);
  const palette = page.getByTestId("command-palette");
  // Filter input is focused and the command list is exposed as a listbox.
  await expect(page.getByRole("listbox", { name: "commands" })).toBeVisible();
  await expect(page.getByTestId("command-palette-input")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
});

test("filtering + enter navigates to a nav target", async ({ page }) => {
  await installMocks(page, { sessions: [], events: [], sse: "" });
  await page.goto("/");

  await openPalette(page);
  await page.getByTestId("command-palette-input").fill("agents");
  await expect(
    page.getByRole("option", { name: /go to agents/i }),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/agents$/);
  await expect(page.getByTestId("command-palette")).toHaveCount(0);
});

test("arrow keys move the cursor before enter runs the command", async ({
  page,
}) => {
  await installMocks(page, { sessions: [], events: [], sse: "" });
  await page.goto("/");

  await openPalette(page);
  // First option starts selected; one step down lands on "go to agents".
  await expect(
    page.getByRole("option", { name: /go to sessions/i }),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("option", { name: /go to agents/i }),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/agents$/);
});

test("jumps to a session by title from the polled list", async ({ page }) => {
  await installMocks(page, {
    sessions: [titledSession()],
    events: [],
    sse: "",
  });
  await page.goto("/");
  // The session rail's poll feeds the palette — wait for it to land.
  await expect(page.getByText("deploy the staging stack")).toBeVisible();

  await openPalette(page);
  await page.getByTestId("command-palette-input").fill("staging");
  await expect(
    page.getByRole("option", { name: /deploy the staging stack/i }),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(new RegExp(`/sessions/${SESSION_ID}$`));
});

test("new session command opens the create dialog", async ({ page }) => {
  await installMocks(page, { sessions: [], events: [], sse: "" });
  await page.goto("/");

  await openPalette(page);
  await page.getByTestId("command-palette-input").fill("new session");
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("new session");
  await expect(page.getByTestId("create-session-submit")).toBeEnabled();
});

test("toggle inspector hides and restores the rail on session pages", async ({
  page,
}) => {
  await installMocks(page, { sessions: [], events: [], sse: "" });
  await page.goto(`/sessions/${SESSION_ID}`);
  await expect(page.getByTestId("inspector")).toBeVisible();

  const toggleViaPalette = async () => {
    await openPalette(page);
    await page.getByTestId("command-palette-input").fill("inspector");
    await page.keyboard.press("Enter");
  };

  await toggleViaPalette();
  await expect(page.getByTestId("inspector")).toHaveCount(0);
  await toggleViaPalette();
  await expect(page.getByTestId("inspector")).toBeVisible();
});

test("the inspector command is absent off session pages", async ({ page }) => {
  await installMocks(page, { sessions: [], events: [], sse: "" });
  await page.goto("/");

  await openPalette(page);
  await page.getByTestId("command-palette-input").fill("inspector");
  await expect(page.getByText(/no matching commands/i)).toBeVisible();
});
