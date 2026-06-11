import { test, expect } from "@playwright/test";
import {
  SESSION_ID,
  buildSse,
  defaultSession,
  installMocks,
  type Fixture,
} from "./fixtures";

/**
 * 390px (phone) layout: single column — session list behind a drawer,
 * inspector behind a toggle, composer always visible and usable.
 */

test.use({ viewport: { width: 390, height: 844 } });

test("session view at 390px keeps the composer usable and panels reachable", async ({
  page,
}) => {
  const fx: Fixture = {
    sessions: [defaultSession()],
    events: [],
    sse: buildSse([
      {
        event: "event",
        data: {
          id: "evt_01",
          session_id: SESSION_ID,
          seq: 1,
          kind: "message",
          data: { role: "user", content: "hello from a phone" },
          created_at: new Date().toISOString(),
        },
      },
    ]),
  };
  await installMocks(page, fx);
  await page.goto(`/sessions/${SESSION_ID}`);

  // Single column: both rails are off-canvas.
  await expect(page.getByTestId("session-list")).toBeHidden();
  await expect(page.getByTestId("inspector")).toBeHidden();

  // Composer is on screen and accepts input.
  const input = page.getByTestId("composer-input");
  await expect(input).toBeInViewport();
  await input.fill("typed on mobile");
  await expect(page.getByTestId("composer-send")).toBeEnabled();

  // Session list opens as a drawer and closes on navigation.
  await page.getByTestId("sessions-drawer-trigger").click();
  const drawer = page.getByTestId("sessions-drawer");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("smoke session")).toBeVisible();
  await drawer.getByText("smoke session").click();
  await expect(drawer).toBeHidden();

  // Inspector opens as a sheet with the event log inside.
  await page.getByTestId("inspector-toggle").click();
  const sheet = page.getByTestId("inspector-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId("event-row-1")).toBeVisible();
});

test("home at 390px offers the sessions drawer", async ({ page }) => {
  await installMocks(page, {
    sessions: [defaultSession()],
    events: [],
    sse: "",
  });
  await page.goto("/");

  await expect(page.getByTestId("session-list")).toBeHidden();
  await page.getByTestId("sessions-drawer-trigger").click();
  await expect(page.getByTestId("sessions-drawer")).toBeVisible();
  await expect(
    page.getByTestId("sessions-drawer").getByText("smoke session"),
  ).toBeVisible();
});
