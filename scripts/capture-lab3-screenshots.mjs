import fs from "fs";
import path from "path";
import { chromium } from "@playwright/test";
import { PrismaClient } from "../server/node_modules/@prisma/client/index.js";

const BASE_URL = "http://localhost:5173";
const API_URL = "http://localhost:3000";
const SCREENSHOT_BASE = "artifacts/lab-03/screenshots";

const DIRS = {
  auth: path.join(SCREENSHOT_BASE, "authentication"),
  queue: path.join(SCREENSHOT_BASE, "staff-queue"),
  detail: path.join(SCREENSHOT_BASE, "staff-ticket-detail"),
  admin: path.join(SCREENSHOT_BASE, "user-management"),
};

// Ensure directories exist
for (const dir of Object.values(DIRS)) {
  fs.mkdirSync(dir, { recursive: true });
}

const SEED_PASSWORD = "Password123!";
const ACCOUNTS = {
  admin: { email: "admin@toktickit.com", password: SEED_PASSWORD },
  staff: { email: "michael.brown@toktickit.com", password: SEED_PASSWORD },
  staffForced: { email: "james.wilson@toktickit.com", password: SEED_PASSWORD },
  requester: { email: "jennifer.anderson@kmutt.ac.th", password: SEED_PASSWORD },
  inactiveRequester: { email: "inactive.test@kmutt.ac.th", password: SEED_PASSWORD },
};

/**
 * Capture helper with the mandatory diagnosis & fix rules:
 * 1. Enforce networkidle + 1-second timeout before any screenshot.
 * 2. Optional CSS override for static navbar.
 */
async function captureShot(page, filePath, options = {}) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  if (options.injectStaticHeader) {
    await page.addStyleTag({
      content: "header, nav { position: static !important; }",
    });
    await page.waitForTimeout(200);
  }

  await page.screenshot({
    path: filePath,
    fullPage: options.fullPage ?? false,
  });

  console.log(`[CAPTURED] -> ${filePath}`);
}

async function loginViaUI(page, email, password) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector("#login-email", { state: "visible" });
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
}

async function clearSession(page) {
  const context = page.context();
  await context.clearCookies();
  try {
    await page.evaluate(() => localStorage.clear());
  } catch {}
}

async function main() {
  console.log("=== TokTickIT Lab 3 Screenshot Automation ===");
  const prisma = new PrismaClient();

  // Ensure james.wilson has mustChangePassword = true for forced password change capture
  try {
    await prisma.user.updateMany({
      where: { email: ACCOUNTS.staffForced.email },
      data: { mustChangePassword: true },
    });
    console.log("Prisma: ensured forced password change user state is set.");
  } catch (err) {
    console.warn("Prisma warning:", err.message);
  }

  // Get a valid ticket for detail views
  let sampleTicket = await prisma.ticket.findFirst({
    where: { currentStatus: { not: "CLOSED" } },
    select: { id: true, ticketNumber: true, summary: true },
  });

  if (!sampleTicket) {
    sampleTicket = await prisma.ticket.findFirst({
      select: { id: true, ticketNumber: true, summary: true },
    });
  }

  console.log("Using sample ticket for detail view:", sampleTicket);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // -------------------------------------------------------------------------
  // SECTION A: Authentication (6 Files)
  // -------------------------------------------------------------------------
  console.log("\n--- Section A: Authentication ---");

  // 1. 01-login-screen.png -> Desktop (1280x800)
  await clearSession(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector("#login-email", { state: "visible" });
  await captureShot(page, path.join(DIRS.auth, "01-login-screen.png"));

  // 2. 02-forced-password-change.png -> Desktop (1280x800)
  await loginViaUI(page, ACCOUNTS.staffForced.email, ACCOUNTS.staffForced.password);
  await page.waitForURL((url) => url.pathname === "/change-password", { timeout: 15000 });
  await page.waitForSelector("#change-current-password", { state: "visible" });
  await captureShot(page, path.join(DIRS.auth, "02-forced-password-change.png"));

  // 3. 07-login-invalid-credentials.png -> Desktop (1280x800)
  await clearSession(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector("#login-email", { state: "visible" });
  await page.locator("#login-email").fill("invalid.user@toktickit.com");
  await page.locator("#login-password").fill("WrongPassword!123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForSelector('.alert[role="alert"]', { state: "visible" });
  await captureShot(page, path.join(DIRS.auth, "07-login-invalid-credentials.png"));

  // 4. 08-login-inactive-blocked.png -> Desktop (1280x800)
  await clearSession(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector("#login-email", { state: "visible" });
  await page.locator("#login-email").fill(ACCOUNTS.inactiveRequester.email);
  await page.locator("#login-password").fill(ACCOUNTS.inactiveRequester.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForSelector('.alert[role="alert"]', { state: "visible" });
  await captureShot(page, path.join(DIRS.auth, "08-login-inactive-blocked.png"));

  // 5. 09-login-mobile.png -> Mobile (375x667)
  await clearSession(page);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector("#login-email", { state: "visible" });
  await captureShot(page, path.join(DIRS.auth, "09-login-mobile.png"));

  // 6. auth-tablet.png -> Tablet (768x1024)
  await clearSession(page);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector("#login-email", { state: "visible" });
  await captureShot(page, path.join(DIRS.auth, "auth-tablet.png"));

  // -------------------------------------------------------------------------
  // SECTION B: Staff Queue (5 Files)
  // -------------------------------------------------------------------------
  console.log("\n--- Section B: Staff Queue ---");

  // Log in as Staff
  await clearSession(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await loginViaUI(page, ACCOUNTS.staff.email, ACCOUNTS.staff.password);
  await page.waitForURL((url) => url.pathname === "/staff/queue", { timeout: 15000 });
  await page.waitForSelector('[data-testid="queue-table"]', { state: "visible" });

  // 7. 03-staff-queue-desktop.png -> Desktop (1280x800)
  await captureShot(page, path.join(DIRS.queue, "03-staff-queue-desktop.png"));

  // 8. 04-staff-queue-mobile.png -> Mobile (375x667)
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForSelector('[data-testid="queue-cards"]', { state: "visible" });
  await captureShot(page, path.join(DIRS.queue, "04-staff-queue-mobile.png"));

  // 9. staff-queue-tablet.png -> Tablet (768x1024)
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForSelector('[data-testid="queue-table"]', { state: "visible" });
  await captureShot(page, path.join(DIRS.queue, "staff-queue-tablet.png"));

  // 10. 11-staff-queue-search-result.png -> Desktop (1280x800)
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator("#queue-search").fill(sampleTicket.ticketNumber.slice(0, 10));
  await page.waitForTimeout(500); // Debounce
  await page.waitForSelector('[data-testid="queue-row"]', { state: "visible" });
  await captureShot(page, path.join(DIRS.queue, "11-staff-queue-search-result.png"));

  // 11. 10-requester-my-tickets.png -> Desktop (1280x800) (Logged in as Requester)
  await clearSession(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await loginViaUI(page, ACCOUNTS.requester.email, ACCOUNTS.requester.password);
  await page.waitForURL((url) => url.pathname === "/my-tickets", { timeout: 15000 });
  await page.waitForSelector('h2:has-text("My Tickets")', { state: "visible" });
  await captureShot(page, path.join(DIRS.queue, "10-requester-my-tickets.png"));

  // -------------------------------------------------------------------------
  // SECTION C: Staff Ticket Detail (5 Files)
  // -------------------------------------------------------------------------
  console.log("\n--- Section C: Staff Ticket Detail ---");

  // Log in as Staff
  await clearSession(page);
  await page.setViewportSize({ width: 1280, height: 1400 });
  await loginViaUI(page, ACCOUNTS.staff.email, ACCOUNTS.staff.password);
  await page.waitForURL((url) => url.pathname === "/staff/queue", { timeout: 15000 });

  // Navigate to ticket detail view
  await page.goto(`${BASE_URL}/staff/tickets/${sampleTicket.id}`);
  await page.waitForSelector('[data-testid="staff-ticket-detail"]', { state: "visible" });
  await page.evaluate(() => window.scrollTo(0, 0));

  // 13. 12-staff-ticket-operations.png -> Desktop (1280x1400), Operations view
  await captureShot(page, path.join(DIRS.detail, "12-staff-ticket-operations.png"), {
    injectStaticHeader: true,
  });

  // 12. 05-internal-notes-amber.png -> Desktop (1280x1400), click 'Internal Notes' tab
  await page.getByTestId("internal-notes-tab").click();
  await page.waitForSelector('[data-testid="internal-notes-warning"]', { state: "visible" });
  await captureShot(page, path.join(DIRS.detail, "05-internal-notes-amber.png"), {
    injectStaticHeader: true,
  });

  // 16. 13-public-comment-posted.png -> Desktop (1280x1400), after posting comment
  await page.getByTestId("public-comments-tab").click();
  await page.waitForSelector('[data-testid="staff-comment-input"]', { state: "visible" });
  const commentText = `QA review comment verification at ${new Date().toLocaleTimeString()}`;
  await page.getByTestId("staff-comment-input").fill(commentText);
  await page.getByTestId("post-comment").click();
  await page.waitForSelector(`[data-testid="public-comment-item"]:has-text("${commentText}")`, {
    state: "visible",
    timeout: 10000,
  });
  await captureShot(page, path.join(DIRS.detail, "13-public-comment-posted.png"), {
    injectStaticHeader: true,
  });

  // 14. ticket-detail-tablet.png -> Tablet (768x1024)
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await captureShot(page, path.join(DIRS.detail, "ticket-detail-tablet.png"), {
    injectStaticHeader: true,
  });

  // 15. ticket-detail-mobile.png -> Mobile (375x667)
  await page.setViewportSize({ width: 375, height: 667 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await captureShot(page, path.join(DIRS.detail, "ticket-detail-mobile.png"), {
    injectStaticHeader: true,
  });

  // -------------------------------------------------------------------------
  // SECTION D: User Management (5 Files)
  // -------------------------------------------------------------------------
  console.log("\n--- Section D: User Management ---");

  // Log in as Admin
  await clearSession(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await loginViaUI(page, ACCOUNTS.admin.email, ACCOUNTS.admin.password);
  await page.waitForURL((url) => url.pathname === "/admin/users", { timeout: 15000 });
  await page.waitForSelector('[data-testid="user-row"]', { state: "visible" });

  // 17. 06-admin-user-management.png -> Desktop (1280x800)
  await captureShot(page, path.join(DIRS.admin, "06-admin-user-management.png"));

  // 18. 14-admin-create-user.png -> Desktop (1280x800), Click '+ Create User'
  await page.locator("#create-user-btn").click();
  await page.waitForSelector("#userDrawerTitle", { state: "visible" });
  await captureShot(page, path.join(DIRS.admin, "14-admin-create-user.png"));
  await page.locator('.modal .btn-close, button:has-text("Cancel")').first().click();
  await page.waitForTimeout(400);

  // 21. 16-admin-self-deactivation-block.png -> Desktop (1280x800), Click Edit on admin
  await page.locator("#user-search").fill("admin@toktickit.com");
  await page.waitForTimeout(400);
  const selfRow = page.getByTestId("user-row").filter({ hasText: "admin@toktickit.com" });
  await selfRow.getByRole("button", { name: "Edit" }).click();
  await page.waitForSelector("#user-active:disabled", { state: "visible" });
  await captureShot(page, path.join(DIRS.admin, "16-admin-self-deactivation-block.png"));
  await page.locator('.modal .btn-close, button:has-text("Cancel")').first().click();
  await page.waitForTimeout(400);

  // 19. 15-admin-users-mobile.png -> Mobile (375x667)
  await page.locator("#user-search").fill("");
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForSelector('[data-testid="user-row"]', { state: "visible" });
  await captureShot(page, path.join(DIRS.admin, "15-admin-users-mobile.png"));

  // 20. user-management-tablet.png -> Tablet (768x1024)
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForSelector('[data-testid="user-row"]', { state: "visible" });
  await captureShot(page, path.join(DIRS.admin, "user-management-tablet.png"));

  await browser.close();
  await prisma.$disconnect();

  console.log("\nAll 21 screenshots have been captured successfully!");
}

main().catch((err) => {
  console.error("Fatal capture error:", err);
  process.exit(1);
});
