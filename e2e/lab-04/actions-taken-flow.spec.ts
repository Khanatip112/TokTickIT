import { expect, test } from "@playwright/test";

import {
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
  SEED,
  TABLET_VIEWPORT,
  createActionTakenViaApi,
  createTicketViaApi,
  loginAndWait,
  shot,
  type CreatedTicket,
} from "./support.js";

/**
 * Lab 4 — Issue 8: Actions Taken E2E flow.
 *
 * Covers:
 * - IT Staff creating a new Action Taken with description, result, follow-up
 *   status, follow-up note, and attachment notes.
 * - Editing an existing Action Taken and seeing the updated values in the list.
 * - Requester read-only rendering: list visible, create form and edit controls
 *   hidden, and the "Read-Only" badge shown.
 * - Review screenshots at Desktop (1280x800), Tablet (768x1024), and Mobile
 *   (375x667) for the list, create form, edit form, and requester read-only view.
 */

const stamp = Date.now();
const ticketSummary = `E2E Lab4 Actions Taken ${stamp}`;
const seedActionDescription = `E2E seeded action ${stamp}`;
const createdActionDescription = `E2E UI action ${stamp}`;
const editedActionDescription = `E2E UI action edited ${stamp}`;

let ticket: CreatedTicket;

test.describe("Lab 4 — Actions Taken flow", () => {
  test.beforeAll(async ({ browser }) => {
    // 1. Create a fresh ticket as the Requester through the real API.
    const requesterContext = await browser.newContext();
    const requesterPage = await requesterContext.newPage();
    await loginAndWait(requesterPage, SEED.requester, "/my-tickets");
    ticket = await createTicketViaApi(
      requesterPage.request,
      ticketSummary,
      "E2E fixture: a ticket used to exercise the Lab 4 Actions Taken flow."
    );
    await requesterContext.close();

    // 2. Seed one Action Taken as IT Staff so the read-only test always has
    //    content to render, even when run in isolation.
    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    await loginAndWait(staffPage, SEED.staff, "/staff/queue");
    await createActionTakenViaApi(staffPage.request, ticket.id, {
      description: seedActionDescription,
      result: "SUCCESS",
      followUpRequired: false,
      attachmentNotes: "seed-evidence.log",
    });
    await staffContext.close();
  });

  test("IT Staff can create and edit an Action Taken", async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await loginAndWait(page, SEED.staff, "/staff/queue");
    await page.goto(`/staff/tickets/${ticket.id}`);
    await expect(page.getByTestId("staff-ticket-detail")).toBeVisible();

    // Open the Actions Taken tab.
    await page.getByTestId("actions-taken-tab").click();
    await expect(page.getByTestId("action-taken-form")).toBeVisible();
    await expect(page.getByText("Log New Action Taken")).toBeVisible();

    // [Desktop] Create form.
    await shot(page, "actions-taken", "actions-taken-form-create-desktop");

    // Create a new Action Taken with every optional field populated.
    await page.getByTestId("action-description").fill(createdActionDescription);
    await page.getByTestId("action-result").selectOption("SUCCESS");
    await page.getByTestId("action-follow-up-required").check();
    await page
      .getByTestId("action-follow-up-note")
      .fill("Follow up with the requester after 24 hours.");
    await page.getByTestId("action-attachment-notes").fill("diagnostic-screenshot.png");
    await page.getByTestId("action-form-submit").click();

    await expect(page.getByTestId("action-save-success")).toContainText(
      "Action logged successfully"
    );
    const createdCard = page
      .locator('[data-testid^="action-item-"]')
      .filter({ hasText: createdActionDescription });
    await expect(createdCard).toBeVisible();
    await expect(createdCard).toContainText("Follow-Up Required");
    await expect(createdCard).toContainText("diagnostic-screenshot.png");

    // Edit the newly created Action Taken.
    await createdCard.locator('[data-testid^="edit-action-"]').click();
    await expect(page.getByText("Edit Action Taken")).toBeVisible();
    await expect(page.getByTestId("action-description")).toHaveValue(
      createdActionDescription
    );

    // [Desktop] Edit form (pre-populated).
    await shot(page, "actions-taken", "actions-taken-form-edit-desktop");

    await page.getByTestId("action-description").fill(editedActionDescription);
    await page.getByTestId("action-result").selectOption("PARTIAL");
    // Leave the optional date/time blank so the server preserves the original
    // action timestamp instead of re-interpreting the prefilled local value.
    await page.getByTestId("action-datetime").fill("");
    await page.getByTestId("action-form-submit").click();

    await expect(page.getByTestId("action-save-success")).toContainText(
      "Action updated successfully"
    );
    const editedCard = page
      .locator('[data-testid^="action-item-"]')
      .filter({ hasText: editedActionDescription });
    await expect(editedCard).toBeVisible();
    await expect(editedCard).toContainText("PARTIAL");

    // [Desktop] List with the updated action.
    await shot(page, "actions-taken", "actions-taken-list-desktop");

    // [Tablet] List, edit form, and create form.
    await page.setViewportSize(TABLET_VIEWPORT);
    await page.waitForTimeout(200);
    await shot(page, "actions-taken", "actions-taken-list-tablet");

    await editedCard.locator('[data-testid^="edit-action-"]').click();
    await expect(page.getByText("Edit Action Taken")).toBeVisible();
    await shot(page, "actions-taken", "actions-taken-form-edit-tablet");
    await page.getByTestId("action-form-cancel").click();
    await expect(page.getByText("Log New Action Taken")).toBeVisible();
    await shot(page, "actions-taken", "actions-taken-form-create-tablet");

    // [Mobile] List, edit form, and create form.
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.waitForTimeout(200);
    await shot(page, "actions-taken", "actions-taken-list-mobile");

    await editedCard.locator('[data-testid^="edit-action-"]').click();
    await expect(page.getByText("Edit Action Taken")).toBeVisible();
    await shot(page, "actions-taken", "actions-taken-form-edit-mobile");
    await page.getByTestId("action-form-cancel").click();
    await expect(page.getByText("Log New Action Taken")).toBeVisible();
    await shot(page, "actions-taken", "actions-taken-form-create-mobile");
  });

  test("Requester sees Actions Taken in read-only mode", async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await loginAndWait(page, SEED.requester, "/my-tickets");
    await page.goto(`/requester/tickets/${ticket.id}`);

    // The list renders for the owning Requester…
    await expect(page.getByTestId("actions-taken-section")).toBeVisible();
    await expect(page.getByTestId("actions-taken-list")).toBeVisible();
    await expect(page.getByText(seedActionDescription)).toBeVisible();
    await expect(page.getByText(editedActionDescription)).toBeVisible();

    // …with the read-only badge, but no create form and no edit controls.
    await expect(page.getByText("Read-Only", { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("action-taken-form")).toHaveCount(0);
    await expect(page.locator('[data-testid^="edit-action-"]')).toHaveCount(0);

    // [Desktop] Requester read-only view.
    await shot(page, "actions-taken", "actions-taken-readonly-requester-desktop");

    // [Tablet] Requester read-only view.
    await page.setViewportSize(TABLET_VIEWPORT);
    await page.waitForTimeout(200);
    await shot(page, "actions-taken", "actions-taken-readonly-requester-tablet");

    // [Mobile] Requester read-only view.
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.waitForTimeout(200);
    await shot(page, "actions-taken", "actions-taken-readonly-requester-mobile");
  });
});
