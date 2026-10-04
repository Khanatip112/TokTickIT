import { test, expect } from "@playwright/test";

import {
  E2E_TEMP_PASSWORD,
  MOBILE_VIEWPORT,
  SEED,
  SEED_PASSWORD,
  API_URL,
  login,
  shot,
} from "./support.js";

/**
 * Issue 9 — E2E authentication flows (`e2e/lab-03/auth.spec.ts`).
 *
 * Covers:
 * - Valid login for every role landing route (requester here; staff/admin
 *   landings are asserted in their own flow specs).
 * - Invalid credentials → uniform "Invalid email or password." banner
 *   (no email enumeration, api-spec §2).
 * - Inactive (deactivated) account → same uniform banner.
 * - Forced first-login password change (seed user Emily Davis has
 *   `mustChangePassword = true`), including the security checklist UI, and
 *   restoring the original password afterwards via the API so the seed stays
 *   reproducible across runs.
 * - Mobile (<768px) login rendering + screenshots for review.
 */
test.describe("Lab 3 — Authentication E2E flows", () => {
  test("login page renders and a valid requester signs in to /my-tickets", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();

    // [01] Review screenshot — desktop login screen.
    await shot(page, "01-login-screen", false);

    await login(page, SEED.requester);
    await page.waitForURL((url) => url.pathname === "/my-tickets", { timeout: 20_000 });

    // Session hydration worked: the requester landing view is rendered.
    await expect(
      page.getByRole("heading", { name: "My Tickets" })
    ).toBeVisible();

    // [10] Review screenshot — authenticated requester landing.
    await shot(page, "10-requester-my-tickets");
  });

  test("invalid credentials show the uniform error banner (no enumeration)", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#login-email").fill("nonexistent.user@toktickit.com");
    await page.locator("#login-password").fill("WrongPassword!123");
    await page.getByRole("button", { name: "Sign In" }).click();

    const alert = page.getByRole("alert");
    await expect(alert).toContainText("Invalid email or password. Please try again.");
    // The password field is cleared on failure; the email value is retained.
    await expect(page.locator("#login-password")).toHaveValue("");
    await expect(page.locator("#login-email")).toHaveValue(
      "nonexistent.user@toktickit.com"
    );
    await expect(page).toHaveURL(/\/login$/);

    await shot(page, "07-login-invalid-credentials", false);
  });

  test("inactive (deactivated) account is blocked with the same uniform banner", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#login-email").fill(SEED.inactiveRequester);
    await page.locator("#login-password").fill(SEED_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.getByRole("alert")).toContainText("Invalid email or password.");
    // Must never reach the app shell.
    await expect(page).toHaveURL(/\/login$/);

    await shot(page, "08-login-inactive-blocked", false);
  });

  test("forced first-login password change flow completes and redirects", async ({ page }) => {
    // Emily Davis is seeded with mustChangePassword = true.
    // NOTE: the forced-change flag is consumed + password mutated by this flow,
    // so re-force the account state through the Administrator reset API before
    // asserting the password wall (the flow itself restores the password).
    await page.request.post(`${API_URL}/api/auth/login`, {
      data: { email: SEED.admin, password: SEED_PASSWORD },
    });
    const directory = await page.request.get(
      `${API_URL}/api/admin/users?search=${encodeURIComponent(SEED.requesterForced)}`
    );
    const [forcedUser] = (await directory.json()) as Array<{ id: string; email: string }>;
    expect(forcedUser?.email).toBe(SEED.requesterForced);
    const reset = await page.request.post(
      `${API_URL}/api/admin/users/${forcedUser.id}/reset-password`,
      { data: { initialPassword: SEED_PASSWORD } }
    );
    expect(reset.status()).toBe(200);
    await page.request.post(`${API_URL}/api/auth/logout`);
    await page.goto("/login");
    await page.waitForTimeout(300);

    await login(page, SEED.requesterForced);

    // The password wall intercepts the requester landing page.
    await page.waitForURL((url) => url.pathname === "/change-password", { timeout: 20_000 });
    await expect(
      page.getByText("You must change your password to continue.")
    ).toBeVisible();
    await expect(page.getByText("Current Password")).toBeVisible();

    // [02] Review screenshot — mandatory password change screen.
    await shot(page, "02-forced-password-change");

    // Target the inputs by id: each field also has a "Show password" toggle
    // whose aria-label makes getByLabel ambiguous under strict mode.
    await page.locator("#change-current-password").fill(SEED_PASSWORD);
    await page.locator("#change-new-password").fill(E2E_TEMP_PASSWORD);
    await page.locator("#change-confirm-password").fill(E2E_TEMP_PASSWORD);

    // Live checklist should be fully satisfied for a policy-compliant value.
    await expect(page.getByTestId("password-rule-length")).toHaveAttribute("data-met", "true");
    await expect(page.getByTestId("password-rule-case")).toHaveAttribute("data-met", "true");
    await expect(page.getByTestId("password-rule-symbol")).toHaveAttribute("data-met", "true");

    await page.getByRole("button", { name: "Continue" }).click();

    await page.waitForURL((url) => url.pathname === "/my-tickets", { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();

    // Restore the seed password via the authenticated session so the
    // idempotent seed fixtures stay valid for future runs.
    const restore = await page.request.post(`${API_URL}/api/auth/change-password`, {
      data: {
        currentPassword: E2E_TEMP_PASSWORD,
        newPassword: SEED_PASSWORD,
        confirmPassword: SEED_PASSWORD,
      },
    });
    expect(restore.status()).toBe(200);
  });

  test("mobile login screen renders correctly below 768px", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();

    // [09] Review screenshot — mobile login.
    await shot(page, "09-login-mobile", false);

    await login(page, SEED.requester);
    await page.waitForURL((url) => url.pathname === "/my-tickets", { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "My Tickets" })).toBeVisible();
  });
});
