import { test, expect } from "@playwright/test";

test.describe("Lab 2 Requester E2E Ticket Flow & Screenshots", () => {
  test("Full Requester Journey: Create Ticket, Soft Removal, Data Isolation & Viewport Screenshots", async ({
    page,
  }) => {
    // -----------------------------------------------------------------------
    // DESKTOP VIEWPORT (>= 992px)
    // -----------------------------------------------------------------------
    await page.setViewportSize({ width: 1280, height: 800 });

    // Step 1: Open Application Shell
    await page.goto("http://localhost:5173/");
    await page.waitForLoadState("networkidle");

    const devIdentityBtn = page.locator("#dev-identity-switcher-btn").first();
    await expect(devIdentityBtn).toBeVisible({ timeout: 10000 });

    // Select Jennifer Anderson (Requester A)
    await devIdentityBtn.click();
    await page.waitForTimeout(300);
    const jenniferBtn = page.locator("button:has-text('Jennifer Anderson')").first();
    if (await jenniferBtn.isVisible()) {
      await jenniferBtn.click();
      await page.waitForTimeout(500);
    }

    const navMyTickets = page.locator("#nav-tab-my-tickets").first();
    const navCreateTicket = page.locator("#nav-tab-create-ticket").first();

    // 1. Capture Desktop - My Tickets
    if (await navMyTickets.isVisible()) {
      await navMyTickets.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: "artifacts/lab-02/screenshots/desktop-my-tickets.png" });
    await page.screenshot({ path: "artifacts/lab-02/screenshots/my-tickets/desktop.png" });

    // Step 2: Navigate to Create Ticket Form
    if (await navCreateTicket.isVisible()) {
      await navCreateTicket.click();
      await page.waitForTimeout(500);
    }

    // 2. Capture Desktop - Create Ticket Form
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

    await page.fill("#summary", "E2E Test - Laptop Screen Flickering Issue");
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
    await expect(page.locator("text=E2E Test - Laptop Screen Flickering Issue").first()).toBeVisible({ timeout: 10000 });

    // Step 4: Open Ticket Detail View
    const viewTicketBtn = page.locator("button:has-text('View')").first();
    await viewTicketBtn.click();
    await page.waitForTimeout(500);

    // 3. Capture Desktop - Ticket Detail View
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

    // Step 6: Data Isolation Check (Switch to Requester B: "David Lee")
    if (await devIdentityBtn.isVisible()) {
      await devIdentityBtn.click();
      await page.waitForTimeout(300);
      const davidOption = page.locator("button:has-text('David Lee')").first();
      if (await davidOption.isVisible()) {
        await davidOption.click();
        await page.waitForTimeout(500);
      }
    }

    if (await navMyTickets.isVisible()) {
      await navMyTickets.click();
      await page.waitForTimeout(500);
    }

    // Verify Requester A's ticket is HIDDEN from Requester B
    await expect(page.locator("text=E2E Test - Laptop Screen Flickering Issue")).not.toBeVisible();

    // Switch back to Requester A (Jennifer Anderson) for Tablet & Mobile capturing
    if (await devIdentityBtn.isVisible()) {
      await devIdentityBtn.click();
      await page.waitForTimeout(300);
      const jenniferOption = page.locator("button:has-text('Jennifer Anderson')").first();
      if (await jenniferOption.isVisible()) await jenniferOption.click();
      await page.waitForTimeout(500);
    }

    // -----------------------------------------------------------------------
    // TABLET VIEWPORT (768px - 991px)
    // -----------------------------------------------------------------------
    await page.setViewportSize({ width: 834, height: 1112 });

    if (await navMyTickets.isVisible()) await navMyTickets.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "artifacts/lab-02/screenshots/tablet-my-tickets.png" });
    await page.screenshot({ path: "artifacts/lab-02/screenshots/my-tickets/tablet.png" });

    if (await navCreateTicket.isVisible()) await navCreateTicket.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "artifacts/lab-02/screenshots/tablet-create-ticket.png" });
    await page.screenshot({ path: "artifacts/lab-02/screenshots/create-ticket/tablet.png" });

    if (await navMyTickets.isVisible()) await navMyTickets.click();
    await page.waitForTimeout(500);
    if (await viewTicketBtn.isVisible()) {
      await viewTicketBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: "artifacts/lab-02/screenshots/tablet-ticket-detail.png" });
      await page.screenshot({ path: "artifacts/lab-02/screenshots/ticket-detail/tablet.png" });
    }

    // -----------------------------------------------------------------------
    // MOBILE VIEWPORT (< 768px)
    // -----------------------------------------------------------------------
    await page.setViewportSize({ width: 375, height: 812 });

    if (await navMyTickets.isVisible()) await navMyTickets.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "artifacts/lab-02/screenshots/mobile-my-tickets.png" });
    await page.screenshot({ path: "artifacts/lab-02/screenshots/my-tickets/mobile.png" });

    if (await navCreateTicket.isVisible()) await navCreateTicket.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "artifacts/lab-02/screenshots/mobile-create-ticket.png" });
    await page.screenshot({ path: "artifacts/lab-02/screenshots/create-ticket/mobile.png" });

    if (await navMyTickets.isVisible()) await navMyTickets.click();
    await page.waitForTimeout(500);
    if (await viewTicketBtn.isVisible()) {
      await viewTicketBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: "artifacts/lab-02/screenshots/mobile-ticket-detail.png" });
      await page.screenshot({ path: "artifacts/lab-02/screenshots/ticket-detail/mobile.png" });
    }
  });
});