import { expect, test, type Page } from "@playwright/test";

import {
  API_URL,
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
  SEED,
  TABLET_VIEWPORT,
  loginAndWait,
  shot,
} from "./support.js";

/**
 * Lab 4 — Issue 8: Requester, IT Staff, and Administrator dashboards E2E.
 *
 * Covers:
 * - Requester metric cards (open / in progress / waiting / resolved), their
 *   drill-down into the pre-filtered My Tickets view, and review screenshots.
 * - IT Staff operational metrics, status/priority breakdowns, queue drill-down
 *   filters, and the absence of Administrator-only account statistics.
 * - Administrator account statistics.
 * - RBAC: a Requester is blocked from `/staff/dashboard` (UI and API).
 * - Review screenshots at Desktop (1280x800), Tablet (768x1024), and Mobile
 *   (375x667) for the Requester, IT Staff, and Administrator dashboards.
 */

async function setViewport(
  page: Page,
  viewport: { width: number; height: number }
): Promise<void> {
  await page.setViewportSize(viewport);
  // Allow the responsive grid to reflow before capturing.
  await page.waitForTimeout(200);
}

test.describe("Lab 4 — Dashboards", () => {
  test("Requester dashboard shows metrics, drills down, and captures all viewports", async ({
    page,
  }) => {
    await setViewport(page, DESKTOP_VIEWPORT);
    await loginAndWait(page, SEED.requester, "/my-tickets");
    await page.goto("/requester/dashboard");

    await expect(page.getByTestId("requester-dashboard")).toBeVisible();
    await expect(page.getByText("My Open Tickets")).toBeVisible();
    await expect(page.getByText("Waiting for My Reply")).toBeVisible();
    await expect(page.getByText("Resolved", { exact: true }).first()).toBeVisible();

    for (const key of [
      "totalOpenTickets",
      "inProgressCount",
      "waitingForRequesterCount",
      "recentlyResolvedCount",
    ]) {
      await expect(page.getByTestId(`metric-value-${key}`)).toHaveText(/^\d+$/);
    }

    // [Desktop] Requester Dashboard.
    await shot(page, "requester-dashboard", "requester-dashboard-desktop");

    // [Tablet] Requester Dashboard.
    await setViewport(page, TABLET_VIEWPORT);
    await shot(page, "requester-dashboard", "requester-dashboard-tablet");

    // [Mobile] Requester Dashboard.
    await setViewport(page, MOBILE_VIEWPORT);
    await shot(page, "requester-dashboard", "requester-dashboard-mobile");

    // Drill-down: each metric card opens My Tickets with the matching filter.
    await setViewport(page, DESKTOP_VIEWPORT);
    const drillDowns = [
      { card: "metric-card-totalOpenTickets", status: "" },
      { card: "metric-card-inProgressCount", status: "IN_PROGRESS" },
      { card: "metric-card-waitingForRequesterCount", status: "WAITING_FOR_REQUESTER" },
      { card: "metric-card-recentlyResolvedCount", status: "RESOLVED" },
    ];

    for (const drillDown of drillDowns) {
      await page.goto("/requester/dashboard");
      await expect(page.getByTestId(drillDown.card)).toBeVisible();
      await page.getByTestId(drillDown.card).click();
      await page.waitForURL((url) => url.pathname === "/my-tickets");

      const statusFilter = page.locator("select").filter({ hasText: "All Statuses" });
      await expect(statusFilter).toHaveValue(drillDown.status);
    }
  });

  test("IT Staff dashboard shows operational metrics and drills into the queue", async ({
    page,
  }) => {
    await setViewport(page, DESKTOP_VIEWPORT);
    await loginAndWait(page, SEED.staff, "/staff/queue");
    await page.goto("/staff/dashboard");

    await expect(page.getByTestId("staff-dashboard")).toBeVisible();
    for (const key of [
      "unassignedCount",
      "assignedToMeCount",
      "inProgressCount",
      "waitingRequesterCount",
      "urgentPriorityCount",
    ]) {
      await expect(page.getByTestId(`metric-value-${key}`)).toHaveText(/^\d+$/);
    }
    await expect(page.getByTestId("status-breakdown")).toBeVisible();
    await expect(page.getByTestId("priority-breakdown")).toBeVisible();

    // Administrator-only statistics must be hidden for IT Staff.
    await expect(page.getByTestId("admin-user-stats")).toHaveCount(0);

    // [Desktop] IT Staff Dashboard.
    await shot(page, "staff-dashboard", "staff-dashboard-desktop");

    // [Tablet] IT Staff Dashboard.
    await setViewport(page, TABLET_VIEWPORT);
    await shot(page, "staff-dashboard", "staff-dashboard-tablet");

    // [Mobile] IT Staff Dashboard.
    await setViewport(page, MOBILE_VIEWPORT);
    await shot(page, "staff-dashboard", "staff-dashboard-mobile");

    // Drill-down: each metric card opens the queue with the matching filter.
    await setViewport(page, DESKTOP_VIEWPORT);
    const drillDowns = [
      { card: "metric-card-unassignedCount", filter: "#filter-owner", value: "unassigned" },
      { card: "metric-card-assignedToMeCount", filter: "#filter-owner", value: "me" },
      { card: "metric-card-inProgressCount", filter: "#filter-status", value: "IN_PROGRESS" },
      {
        card: "metric-card-waitingRequesterCount",
        filter: "#filter-status",
        value: "WAITING_FOR_REQUESTER",
      },
      {
        card: "metric-card-urgentPriorityCount",
        filter: "#filter-it-priority",
        value: "URGENT",
      },
    ];

    for (const drillDown of drillDowns) {
      await page.goto("/staff/dashboard");
      await expect(page.getByTestId(drillDown.card)).toBeVisible();
      await page.getByTestId(drillDown.card).click();
      await page.waitForURL((url) => url.pathname === "/staff/queue");
      await expect(page.locator(drillDown.filter)).toHaveValue(drillDown.value);
    }
  });

  test("Administrator dashboard shows user account statistics and captures all viewports", async ({
    page,
  }) => {
    await setViewport(page, DESKTOP_VIEWPORT);
    await loginAndWait(page, SEED.admin, "/admin/users");
    await page.goto("/staff/dashboard");

    await expect(page.getByTestId("staff-dashboard")).toBeVisible();
    await expect(page.getByTestId("admin-user-stats")).toBeVisible();

    for (const key of [
      "totalUsersCount",
      "activeUsersCount",
      "inactiveUsersCount",
      "requestersCount",
      "staffCount",
      "administratorsCount",
    ]) {
      await expect(page.getByTestId(`admin-metric-value-${key}`)).toHaveText(/^\d+$/);
    }

    // [Desktop] Administrator Dashboard.
    await shot(page, "staff-dashboard", "admin-dashboard-desktop");

    // [Tablet] Administrator Dashboard.
    await setViewport(page, TABLET_VIEWPORT);
    await shot(page, "staff-dashboard", "admin-dashboard-tablet");

    // [Mobile] Administrator Dashboard.
    await setViewport(page, MOBILE_VIEWPORT);
    await shot(page, "staff-dashboard", "admin-dashboard-mobile");
  });

  test("Requester is blocked from the Staff Dashboard (UI and API)", async ({ page }) => {
    await setViewport(page, DESKTOP_VIEWPORT);
    await loginAndWait(page, SEED.requester, "/my-tickets");
    await page.goto("/staff/dashboard");

    await expect(page.getByRole("heading", { name: "Access Denied" })).toBeVisible();
    await expect(page.getByTestId("staff-dashboard")).toHaveCount(0);

    // Defense in depth: the API itself also rejects the Requester role.
    const res = await page.request.get(`${API_URL}/api/dashboards/staff`);
    expect(res.status()).toBe(403);
  });
});
