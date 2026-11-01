import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Shared helpers for the Lab 4 (Issue 8) E2E suite.
 *
 * - Credentials come from the idempotent seed (`server/prisma/seed.ts`), whose
 *   accounts all use the standard password `Password123!`.
 * - `shot()` writes the review screenshots required by Issue 8 into
 *   `artifacts/lab-04/screenshots/<folder>/` with descriptive filenames.
 * - Viewports match the handout: Desktop 1280x800, Tablet 768x1024, and
 *   Mobile 375x667.
 */

export const API_URL = "http://localhost:3000";

export const SEED_PASSWORD = "Password123!";

/** Seed credentials used by the Lab 4 specs. */
export const SEED = {
  requester: "jennifer.anderson@kmutt.ac.th",
  staff: "michael.brown@toktickit.com",
  admin: "admin@toktickit.com",
} as const;

export const DESKTOP_VIEWPORT = { width: 1280, height: 800 } as const;
export const TABLET_VIEWPORT = { width: 768, height: 1024 } as const;
export const MOBILE_VIEWPORT = { width: 375, height: 667 } as const;

export type ScreenshotFolder =
  | "staff-dashboard"
  | "requester-dashboard"
  | "actions-taken";

const SCREENSHOT_ROOT = "artifacts/lab-04/screenshots";

/**
 * Saves a full-page screenshot into
 * `artifacts/lab-04/screenshots/<folder>/<name>.png`.
 */
export async function shot(
  page: Page,
  folder: ScreenshotFolder,
  name: string,
  fullPage = true
): Promise<void> {
  const path = `${SCREENSHOT_ROOT}/${folder}/${name}.png`;
  mkdirSync(dirname(path), { recursive: true });
  // Keep sticky headers at the top of full-page captures, even when an
  // interaction (e.g. Edit) has scrolled the viewport.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(50);
  await page.screenshot({ path, fullPage, animations: "disabled", caret: "hide" });
}

/** Signs in through the real `/login` screen. */
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

/** Signs in and waits for the role landing route. */
export async function loginAndWait(
  page: Page,
  email: string,
  expectedPath: string
): Promise<void> {
  await login(page, email);
  await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 20_000 });
}

export interface CreatedTicket {
  id: string;
  ticketNumber: string;
}

/**
 * Creates a fresh ticket through the API using the authenticated requester
 * session held by the browser context (`page.request` shares its cookies).
 */
export async function createTicketViaApi(
  request: APIRequestContext,
  summary: string,
  description: string
): Promise<CreatedTicket> {
  const categoriesRes = await request.get(`${API_URL}/api/categories`);
  expect(categoriesRes.ok()).toBeTruthy();
  const categories = await categoriesRes.json();

  const systemsRes = await request.get(`${API_URL}/api/related-systems`);
  expect(systemsRes.ok()).toBeTruthy();
  const systems = await systemsRes.json();

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
  return { id: ticket.id, ticketNumber: ticket.ticketNumber };
}

export interface ActionTakenPayload {
  description: string;
  result: "SUCCESS" | "PARTIAL" | "PENDING" | "FAILED";
  followUpRequired: boolean;
  followUpNote?: string;
  attachmentNotes?: string;
}

/** Creates an Action Taken through the API (IT Staff / Administrator only). */
export async function createActionTakenViaApi(
  request: APIRequestContext,
  ticketId: string,
  payload: ActionTakenPayload
): Promise<unknown> {
  const res = await request.post(`${API_URL}/api/tickets/${ticketId}/actions-taken`, {
    data: payload,
  });
  expect(res.status()).toBe(201);
  return res.json();
}

/** Reads the staff-facing ticket detail (includes permittedTransitions). */
export async function getStaffTicketViaApi(
  request: APIRequestContext,
  ticketId: string
): Promise<{ currentStatus: string; permittedTransitions: string[] }> {
  const res = await request.get(`${API_URL}/api/staff/tickets/${ticketId}`);
  expect(res.ok()).toBeTruthy();
  return res.json();
}
