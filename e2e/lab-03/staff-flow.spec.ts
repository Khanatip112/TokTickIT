import { test, expect } from "@playwright/test";

import {
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
  SEED,
  createTicketViaApi,
  login,
  runStamp,
  shot,
} from "./support.js";

/**
 * Issue 9 — E2E IT Staff ticketing flow (`e2e/lab-03/staff-flow.spec.ts`).
 *
 * Covers the full operational journey against the real API + database:
 * - IT Staff landing on `/staff/queue` (desktop table) + review screenshot.
 * - Server-side search + status filter + Clear Filters reset.
 * - Ticket detail: claim (Assign to Me), owner reassignment, IT Priority update,
 *   status workflow (OPEN → IN_PROGRESS via the BR-15 select).
 * - Public comment posting (Issue 8) and the confidential Internal Notes tab:
 *   amber warning banner, 🔒 badge, posting a note, and NO edit/delete
 *   controls anywhere in the append-only streams.
 * - Mobile (<768px) queue renders the card list instead of the table.
 */
test.describe("Lab 3 — IT Staff queue, operations, comments & internal notes", () => {
  let ticketSummary: string;

  test.beforeAll(async ({ browser }) => {
    // Create a fresh, uniquely-named ticket as Jennifer (Requester) via the
    // API so this run never collides with seed data or previous runs.
    const stamp = runStamp();
    ticketSummary = `E2E Staff Flow Ticket ${stamp}`;
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, SEED.requester);
    await page.waitForURL((url) => url.pathname === "/my-tickets", { timeout: 20_000 });
    await createTicketViaApi(
      page.request,
      ticketSummary,
      "E2E staff-flow fixture: created via the API with a requester session."
    );
    await context.close();
  });

  test("staff queue, search/filters, claim, priority, status, comments, internal notes", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);

    // 1. Login as IT Staff → role landing /staff/queue.
    await login(page, SEED.staff);
    await page.waitForURL((url) => url.pathname === "/staff/queue", { timeout: 20_000 });
    const table = page.getByTestId("queue-table");
    await expect(table).toBeVisible();
    await expect(page.getByTestId("results-counter")).toContainText(/Showing \d+ to \d+ of \d+ tickets/);

    // [03] Review screenshot — desktop staff queue.
    await shot(page, "03-staff-queue-desktop");

    // 2. Server-side search finds the freshly created ticket.
    await page.locator("#queue-search").fill(ticketSummary);
    const row = page.getByTestId("queue-row").filter({ hasText: ticketSummary });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("results-counter")).toContainText("of 1 tickets");
    await shot(page, "11-staff-queue-search-result");

    // 3. Status filter narrows further; Clear Filters restores the full queue.
    await page.locator("#filter-status").selectOption("NEW");
    await expect(row).toBeVisible();
    await page.getByRole("button", { name: "Clear Filters" }).click();
    await expect(page.locator("#queue-search")).toHaveValue("");
    await expect(page.locator("#filter-status")).toHaveValue("");

    // 4. Open the ticket detail via the queue row link.
    await row.getByRole("button", { name: /TKT-/ }).click();
    await page.waitForURL(/\/staff\/tickets\//, { timeout: 20_000 });
    await expect(page.getByTestId("staff-ticket-detail")).toBeVisible();
    await expect(page.getByTestId("requested-priority-badge")).toContainText("Medium");

    // 5. Claim the unassigned ticket (NEW → OPEN, owner = Michael Brown).
    const claimButton = page.getByTestId("claim-button");
    if (await claimButton.isVisible().catch(() => false)) {
      await claimButton.click();
      await expect(page.getByTestId("staff-action-success")).toBeVisible({ timeout: 15_000 });
    }
    await expect(page.getByTestId("current-status-badge")).toContainText("Open");

    // 5b. Reassign the owner to another IT Staff member via the owner select.
    await page.getByTestId("owner-select").selectOption({ label: "Lisa Martinez" });
    await expect(page.getByTestId("staff-action-success")).toContainText(
      "owner updated",
      { timeout: 15_000 }
    );

    // 6. Independent IT Priority update (requested priority stays untouched).
    await page.getByTestId("it-priority-select").selectOption("URGENT");
    await expect(page.getByTestId("staff-action-success")).toBeVisible({ timeout: 15_000 });

    // 7. Status workflow: OPEN → IN_PROGRESS via the BR-15 select.
    await page.getByTestId("status-select").selectOption("IN_PROGRESS");
    await page.getByTestId("apply-status").click();
    await expect(page.getByTestId("staff-action-success")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("current-status-badge")).toContainText("In Progress");

    // [12] Review screenshot — operational panel after claim/priority/status.
    await shot(page, "12-staff-ticket-operations");

    // 8. Public Comments tab: post a comment and see it in the stream.
    await page.getByTestId("public-comments-tab").click();
    await page.getByTestId("staff-comment-input").fill("E2E public comment from IT Staff.");
    await page.getByTestId("post-comment").click();
    const publicList = page.getByTestId("public-comments-list");
    await expect(publicList).toBeVisible();
    await expect(
      publicList.getByTestId("public-comment-item").filter({ hasText: "E2E public comment from IT Staff." })
    ).toBeVisible();
    // Append-only: comment items must never expose edit/delete affordances.
    expect(await publicList.getByRole("button").count()).toBe(0);

    // [13] Review screenshot — public comment posted.
    await shot(page, "13-public-comment-posted");

    // 9. Internal Notes tab: amber confidentiality banner + 🔒 badge + posting.
    const notesTab = page.getByTestId("internal-notes-tab");
    await expect(notesTab).toContainText("🔒");
    await notesTab.click();

    const warning = page.getByTestId("internal-notes-warning");
    await expect(warning).toBeVisible();
    await expect(warning).toContainText("Visible strictly to IT Staff and Administrators");

    await page.getByTestId("staff-note-input").fill("E2E confidential diagnostic note.");
    await page.getByTestId("post-internal-note").click();
    const notesList = page.getByTestId("internal-notes-list");
    await expect(notesList).toBeVisible();
    const noteItem = notesList
      .getByTestId("internal-note-item")
      .filter({ hasText: "E2E confidential diagnostic note." });
    await expect(noteItem).toBeVisible();
    await expect(noteItem.getByTestId("internal-note-badge")).toContainText("Internal");
    // Pale-amber card styling distinguishes notes from public comments.
    await expect(noteItem).toHaveCSS("background-color", "rgb(255, 251, 235)");
    expect(await notesList.getByRole("button").count()).toBe(0);

    // [05] Review screenshot — internal notes with amber warning styling.
    await shot(page, "05-internal-notes-amber");

    // 10. Mobile (<768px): queue switches from table to card list.
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/staff/queue");
    await expect(page.getByTestId("queue-cards")).toBeVisible();
    await expect(page.getByTestId("queue-table")).toBeHidden();
    const card = page.getByTestId("queue-card").filter({ hasText: ticketSummary });
    await expect(card).toBeVisible();

    // [04] Review screenshot — mobile staff queue with card list.
    await shot(page, "04-staff-queue-mobile");
  });

  test("Requesters never see the internal notes authored on the same ticket", async ({ page }) => {
    // The staff test above posted "E2E confidential diagnostic note." on the
    // fixture ticket. The Requester who owns that ticket must never see it —
    // neither the note body nor an Internal Notes tab (AC-07).
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await login(page, SEED.requester);
    await page.waitForURL((url) => url.pathname === "/my-tickets", { timeout: 20_000 });

    const row = page.locator(`tr:has-text("${ticketSummary}")`).first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();

    // Requester view confirms it is the same ticket and exposes public comments…
    await expect(page.getByTestId("requester-public-comments")).toBeVisible({ timeout: 15_000 });
    // …but never the staff-only internal note stream.
    await expect(page.getByTestId("internal-notes-tab")).toHaveCount(0);
    await expect(page.getByText("E2E confidential diagnostic note.")).toHaveCount(0);
  });
});
