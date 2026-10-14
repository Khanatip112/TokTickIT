import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Shared E2E helpers for the Lab 3 suite (Issue 9).
 *
 * - Credentials come from the idempotent seed (`server/prisma/seed.ts`), whose
 *   accounts all use the standard password `Password123!`.
 * - `shot()` writes the review screenshots required by Issue 9 to
 *   `artifacts/lab-03/screenshots/` with descriptive, ordered filenames.
 * - Viewports: Desktop >= 1280px and Mobile < 768px, matching the queue's
 *   Bootstrap breakpoints (table >= 768px, card list below).
 */

export const API_URL = "http://localhost:3000";
const SCREENSHOT_DIR = "artifacts/lab-03/screenshots";

export const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
export const MOBILE_VIEWPORT = { width: 375, height: 812 };

/** Seed credentials (server/prisma/seed.ts) — password is uniform on purpose. */
export const SEED_PASSWORD = "Password123!";
export const SEED = {
  requester: "jennifer.anderson@kmutt.ac.th",
  requesterForced: "emily.davis@toktickit.com",
  inactiveRequester: "inactive.test@kmutt.ac.th",
  staff: "michael.brown@toktickit.com",
  staffForced: "james.wilson@toktickit.com",
  admin: "admin@toktickit.com",
  adminTwo: "john.smith@toktickit.com",
};

/** Temporary password used to complete (and later undo) the forced change. */
export const E2E_TEMP_PASSWORD = "E2ETemp!2026x";

/** Unique-per-run marker so repeated E2E runs never collide on unique fields. */
export const runStamp = (): string => String(Date.now());

/**
 * Saves a full-page screenshot into `artifacts/lab-03/screenshots/`.
 * `name` should be the descriptive, ordered filename without extension,
 * e.g. `shot(page, "01-login-page")` → `01-login-page.png`.
 */
export async function shot(page: Page, name: string, fullPage = true): Promise<void> {
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage });
}

/**
 * Logs in through the real `/login` screen and waits for the role landing
 * page. Requester → `/my-tickets`, IT Staff → `/staff/queue`, Admin →
 * `/admin/users` (AuthContext.landingPathFor).
 */
export async function login(
  page: Page,
  email: string,
  password: string = SEED_PASSWORD
): Promise<void> {
  await page.goto("/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
}

/**
 * Logs in via the real login form and asserts the session landed on
 * `expectedPath` — the E2E equivalent of the AuthContext redirect contract.
 */
export async function loginAndExpectLanding(
  page: Page,
  email: string,
  expectedPath: string,
  waitForTestId?: string
): Promise<void> {
  await login(page, email);
  await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 20_000 });
  if (waitForTestId) {
    await expect(page.getByTestId(waitForTestId).first()).toBeVisible();
  }
}

/**
 * Creates a fresh ticket through the API using an authenticated requester
 * session. The browser context's `request` shares the session cookie, so this
 * works after `login()` has run in the same test. Returns the ticket number.
 */
export async function createTicketViaApi(
  request: Page["request"],
  summary: string,
  description: string
): Promise<string> {
  const categories = await (await request.get(`${API_URL}/api/categories`)).json();
  const systems = await (await request.get(`${API_URL}/api/related-systems`)).json();

  const res = await request.post(`${API_URL}/api/tickets`, {
    data: {
      categoryId: categories[0].id,
      relatedSystemId: systems[0].id,
      requestedPriority: "MEDIUM",
      summary,
      description,
    },
  });
  expect(res.status()).toBe(201);
  const ticket = await res.json();
  return ticket.ticketNumber as string;
}
