import { test, expect, type Page } from "@playwright/test";

/**
 * Lab 2 requester journey, migrated for Lab 3 (Issue 4 removed the legacy
 * "Development Identity Context" switcher). Identity is now chosen through the
 * real `/login` screen, and "switching requester" means signing out and back in
 * as the other seeded Requester.
 *
 * Preserved coverage & artifacts:
 * - Create a ticket (category, priority, summary, description, attachment).
 * - Soft-remove the attachment from the ticket detail view.
 * - Data isolation: Requester B (David Lee) never sees Requester A's ticket.
 * - Desktop (1280x800), Tablet (834x1112), and Mobile (375x812) screenshots in
 *   `artifacts/lab-02/screenshots/`.
 */

const PASSWORD = "Password123!";
const JENNIFER = "jennifer.anderson@kmutt.ac.th";
const DAVID = "david.lee@kmutt.ac.th";
const TICKET_SUMMARY = "E2E Test - Laptop Screen Flickering Issue";

/** Signs in through the real login screen and waits for the requester landing. */
async function login(page: Page, email: string): Promise<void> {
  await page.goto("http://localhost:5173/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL((url) => url.pathname === "/my-tickets", { timeout: 20_000 });
}

/** Opens the profile menu and signs out, landing back on /login. */
async function signOut(page: Page): Promise<void> {
  await page.locator("#user-menu-btn").click();
  await page.getByRole("menuitem", { name: /Sign Out/ }).click();
  await page.waitForURL((url) => url.pathname === "/login", { timeout: 20_000 });
}

test.describe("Lab 2 Requester E2E Ticket Flow & Screenshots", () => {
  test("Full Requester Journey: Create Ticket, Soft Removal, Data Isolation & Viewport Screenshots", async ({
    page,
  }) => {
    // -----------------------------------------------------------------------
    // 1. DESKTOP VIEWPORT (1280 x 800)
    // -----------------------------------------------------------------------
    await page.setViewportSize({ width: 1280, height: 800 });

    // Step 1: Sign in as Requester A (Jennifer Anderson).
    await login(page, JENNIFER);

    const navMyTickets = page.locator("#nav-tab-my-tickets").first();
    const navCreateTicket = page.locator("#nav-tab-create-ticket").first();

    // [Desktop - 1/4] Capture My Tickets List
    if (await navMyTickets.isVisible()) {
      await navMyTickets.click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: "artifacts/lab-02/screenshots/desktop-my-tickets.png" });
    await page.screenshot({ path: "artifacts/lab-02/screenshots/my-tickets/desktop.png" });

    // Step 2: Navigate to Create Ticket Form
    if (await navCreateTicket.isVisible()) {
      await navCreateTicket.click();
      await page.waitForTimeout(300);
    }

    // [Desktop - 2/4] Capture Create Ticket Form
    await page.screenshot({ path: "artifacts/lab-02/screenshots/desktop-create-ticket.png" });
    await page.screenshot({ path: "artifacts/lab-02/screenshots/create-ticket/desktop.png" });

    // Step 3: Fill Create Ticket Form
    const categorySelect = page.locator("#categoryId").first();
    if (await categorySelect.isVisible()) {
      await categorySelect.selectOption({ index: 0 });
    }

    const prioritySelect = page.locator("#requestedPriority").first();
    if (await prioritySelect.isVisible()) {
      await prioritySelect.selectOption("HIGH");
    }

    await page.fill("#summary", TICKET_SUMMARY);
    await page.fill(
      "#description",
      "Detailed E2E test problem description. Laptop screen flickers constantly on battery power."
    );

    // Upload attachment via Playwright Buffer
    const filePicker = page.locator("#filePicker").first();
    if (await filePicker.isVisible()) {
      await filePicker.setInputFiles({
        name: "e2e-sample-log.pdf",
        mimeType: "application/pdf",
        buffer: new TextEncoder().encode("%PDF-1.4 sample diagnostic report for E2E test"),
      });
      await page.waitForTimeout(300);
    }

    // Submit Support Ticket
    const submitBtn = page.locator("button[type='submit']").first();
    await submitBtn.click();

    // Verify submission success
    await expect(page.locator("text=Ticket Submitted Successfully").first()).toBeVisible({ timeout: 15000 });

    // Click "View My Tickets"
    const viewMyTicketsBtn = page.locator("button:has-text('View My Tickets')").first();
    if (await viewMyTicketsBtn.isVisible()) {
      await viewMyTicketsBtn.click();
      await page.waitForTimeout(500);
    }

    // Verify ticket appears in list
    const ticketRow = page.locator(`tr:has-text('${TICKET_SUMMARY}')`).first();
    await expect(ticketRow).toBeVisible({ timeout: 10000 });

    // Step 4: Open Ticket Detail View
    await ticketRow.click();
    await page.waitForTimeout(500);

    // [Desktop - 3/4] Capture Ticket Detail View
    await page.screenshot({ path: "artifacts/lab-02/screenshots/desktop-ticket-detail.png" });
    await page.screenshot({ path: "artifacts/lab-02/screenshots/ticket-detail/desktop.png" });

    // Step 5: Soft Remove Attachment
    const softRemoveBtn = page.locator("button:has-text('Soft Remove')").first();
    if (await softRemoveBtn.isVisible()) {
      await softRemoveBtn.click();
      await page.waitForTimeout(300);
      const reasonInput = page.locator("#removalReasonInput").first();
      if (await reasonInput.isVisible()) {
        await reasonInput.fill("Uploaded wrong diagnostic file during E2E test");
        const confirmRemoveBtn = page.locator("button:has-text('Soft Remove Attachment')").first();
        await confirmRemoveBtn.click();
        await expect(page.locator("text=Soft Removed").first()).toBeVisible({ timeout: 5000 });
      }
    }

    // Step 6: Data Isolation Check — sign out and back in as Requester B (David Lee)
    await signOut(page);
    await login(page, DAVID);

    const navMyTicketsB = page.locator("#nav-tab-my-tickets").first();
    if (await navMyTicketsB.isVisible()) {
      await navMyTicketsB.click();
      await page.waitForTimeout(500);
    }

    // Verify Requester A's ticket is HIDDEN from Requester B
    await expect(page.locator(`text=${TICKET_SUMMARY}`)).not.toBeVisible();

    // Switch back to Requester A (Jennifer Anderson) for Tablet & Mobile capturing
    await signOut(page);
    await login(page, JENNIFER);

    // -----------------------------------------------------------------------
    // 2. TABLET VIEWPORT (834 x 1112)
    // -----------------------------------------------------------------------
    await page.setViewportSize({ width: 834, height: 1112 });

    // [Tablet - 1/4] Capture My Tickets List
    if (await navMyTickets.isVisible()) await navMyTickets.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "artifacts/lab-02/screenshots/tablet-my-tickets.png" });
    await page.screenshot({ path: "artifacts/lab-02/screenshots/my-tickets/tablet.png" });

    // [Tablet - 2/4] Capture Create Ticket
    if (await navCreateTicket.isVisible()) await navCreateTicket.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "artifacts/lab-02/screenshots/tablet-create-ticket.png" });
    await page.screenshot({ path: "artifacts/lab-02/screenshots/create-ticket/tablet.png" });

    // [Tablet - 3/4] Capture Ticket Detail
    if (await navMyTickets.isVisible()) await navMyTickets.click();
    await page.waitForTimeout(500);
    const tabletTicketRow = page.locator(`tr:has-text('${TICKET_SUMMARY}')`).first();
    if (await tabletTicketRow.isVisible()) {
      await tabletTicketRow.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: "artifacts/lab-02/screenshots/tablet-ticket-detail.png" });
      await page.screenshot({ path: "artifacts/lab-02/screenshots/ticket-detail/tablet.png" });
    }

    // -----------------------------------------------------------------------
    // 3. MOBILE VIEWPORT (375 x 812)
    // -----------------------------------------------------------------------
    await page.setViewportSize({ width: 375, height: 812 });

    // [Mobile - 1/4] Capture My Tickets List
    if (await navMyTickets.isVisible()) await navMyTickets.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "artifacts/lab-02/screenshots/mobile-my-tickets.png" });
    await page.screenshot({ path: "artifacts/lab-02/screenshots/my-tickets/mobile.png" });

    // [Mobile - 2/4] Capture Create Ticket
    if (await navCreateTicket.isVisible()) await navCreateTicket.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "artifacts/lab-02/screenshots/mobile-create-ticket.png" });
    await page.screenshot({ path: "artifacts/lab-02/screenshots/create-ticket/mobile.png" });

    // [Mobile - 3/4] Capture Ticket Detail
    // On mobile the My Tickets table is hidden and replaced by a stacked card
    // list, so we must click the card button rather than a table row.
    if (await navMyTickets.isVisible()) await navMyTickets.click();
    await page.waitForTimeout(500);
    const mobileTicketCard = page.locator(`button:has-text('${TICKET_SUMMARY}')`).first();
    if (await mobileTicketCard.isVisible()) {
      await mobileTicketCard.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: "artifacts/lab-02/screenshots/mobile-ticket-detail.png" });
      await page.screenshot({ path: "artifacts/lab-02/screenshots/ticket-detail/mobile.png" });
    }
  });
});
