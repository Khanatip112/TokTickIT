import { expect, test, type Page } from "@playwright/test";

import {
  API_URL,
  SEED,
  createTicketViaApi,
  loginAndWait,
  type CreatedTicket,
} from "./support.js";

/**
 * Lab 4 — Issue 8: Resolution Gate and status transition matrix E2E.
 *
 * Covers:
 * - BR-15 matrix: a NEW ticket only exposes OPEN and CANCELLED, and direct
 *   jumps to IN_PROGRESS / RESOLVED / CLOSED are rejected with HTTP 422.
 * - BR-09 Resolution Gate: RESOLVED is rejected while the ticket has zero
 *   Actions Taken, and succeeds once at least one action is recorded.
 * - BR-17 resolution summary remains mandatory for RESOLVED / CLOSED.
 */

const stamp = Date.now();

let gateTicket: CreatedTicket;
let matrixTicket: CreatedTicket;

/** Reads the status <option> values rendered by the staff status select. */
async function statusOptionValues(page: Page): Promise<string[]> {
  return page
    .getByTestId("status-select")
    .locator("option")
    .evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value)
    );
}

test.describe("Lab 4 — Ticket resolution gate and status matrix", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAndWait(page, SEED.requester, "/my-tickets");

    gateTicket = await createTicketViaApi(
      page.request,
      `E2E Resolution Gate ${stamp}`,
      "E2E fixture: a NEW ticket with zero Actions Taken for the Resolution Gate test."
    );
    matrixTicket = await createTicketViaApi(
      page.request,
      `E2E Status Matrix ${stamp}`,
      "E2E fixture: a NEW ticket used to verify the BR-15 transition matrix."
    );

    await context.close();
  });

  test("status transition matrix blocks illegal jumps in the UI and API", async ({ page }) => {
    await loginAndWait(page, SEED.staff, "/staff/queue");
    await page.goto(`/staff/tickets/${matrixTicket.id}`);
    await expect(page.getByTestId("staff-ticket-detail")).toBeVisible();

    // UI: a NEW ticket may only move to OPEN or CANCELLED.
    expect(await statusOptionValues(page)).toEqual(["", "OPEN", "CANCELLED"]);
    await expect(
      page.getByTestId("status-select").locator('option[value="IN_PROGRESS"]')
    ).toHaveCount(0);
    await expect(
      page.getByTestId("status-select").locator('option[value="RESOLVED"]')
    ).toHaveCount(0);
    await expect(
      page.getByTestId("status-select").locator('option[value="CLOSED"]')
    ).toHaveCount(0);

    // API: direct jumps from NEW are rejected with 422 Unprocessable Entity.
    for (const target of ["IN_PROGRESS", "RESOLVED", "CLOSED"]) {
      const res = await page.request.patch(
        `${API_URL}/api/staff/tickets/${matrixTicket.id}/status`,
        { data: { currentStatus: target } }
      );
      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.error.message).toContain("not permitted");
    }

    // The rejected requests must not have changed the ticket.
    const detailRes = await page.request.get(
      `${API_URL}/api/staff/tickets/${matrixTicket.id}`
    );
    expect(detailRes.ok()).toBeTruthy();
    expect((await detailRes.json()).currentStatus).toBe("NEW");
  });

  test("Resolution Gate rejects RESOLVED with 0 Actions Taken, then succeeds after logging one", async ({
    page,
  }) => {
    await loginAndWait(page, SEED.staff, "/staff/queue");
    await page.goto(`/staff/tickets/${gateTicket.id}`);
    await expect(page.getByTestId("staff-ticket-detail")).toBeVisible();

    // NEW -> OPEN through the real claim action.
    await page.getByTestId("claim-button").click();
    await expect(page.getByTestId("staff-action-success")).toBeVisible();
    await expect(page.getByTestId("current-status-badge")).toContainText("Open");

    // OPEN may resolve directly (legacy edge) but must never jump to CLOSED.
    expect(await statusOptionValues(page)).toEqual([
      "",
      "IN_PROGRESS",
      "WAITING_FOR_REQUESTER",
      "CANCELLED",
      "RESOLVED",
    ]);
    const illegalClose = await page.request.patch(
      `${API_URL}/api/staff/tickets/${gateTicket.id}/status`,
      { data: { currentStatus: "CLOSED" } }
    );
    expect(illegalClose.status()).toBe(422);

    // Attempt to resolve with zero Actions Taken: the UI shows the gate notice
    // and the API rejects the transition with the BR-09 message.
    await page.getByTestId("status-select").selectOption("RESOLVED");
    await expect(page.getByTestId("resolution-gate-notice")).toBeVisible();
    await expect(page.getByTestId("resolution-gate-notice")).toContainText(
      "Resolution Gate"
    );

    await page
      .getByTestId("resolution-summary")
      .fill("Resolved during the Lab 4 E2E validation run.");
    await page.getByTestId("apply-status").click();

    await expect(page.getByTestId("staff-action-error")).toContainText(
      "Cannot resolve or close a ticket without at least one recorded Action Taken."
    );
    await expect(page.getByTestId("current-status-badge")).toContainText("Open");

    // Log the required Action Taken through the UI.
    await page.getByTestId("actions-taken-tab").click();
    await page
      .getByTestId("action-description")
      .fill(`E2E resolution action ${stamp}`);
    await page.getByTestId("action-result").selectOption("SUCCESS");
    await page.getByTestId("action-form-submit").click();
    await expect(page.getByTestId("action-save-success")).toContainText(
      "Action logged successfully"
    );

    // Reload so the detail panel receives the fresh actionsTakenCount (1).
    await page.reload();
    await expect(page.getByTestId("staff-ticket-detail")).toBeVisible();

    await page.getByTestId("status-select").selectOption("RESOLVED");
    await expect(page.getByTestId("resolution-gate-notice")).toHaveCount(0);
    await page
      .getByTestId("resolution-summary")
      .fill("Resolved during the Lab 4 E2E validation run.");
    await page.getByTestId("apply-status").click();

    await expect(page.getByTestId("staff-action-success")).toContainText(
      "Status changed to Resolved"
    );
    await expect(page.getByTestId("current-status-badge")).toContainText("Resolved");

    // The same gate now permits the final CLOSED transition as well.
    await page.getByTestId("status-select").selectOption("CLOSED");
    await page.getByTestId("apply-status").click();
    await expect(page.getByTestId("staff-action-success")).toContainText(
      "Status changed to Closed"
    );
    await expect(page.getByTestId("current-status-badge")).toContainText("Closed");
  });
});
