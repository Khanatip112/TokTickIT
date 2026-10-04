import { test, expect } from "@playwright/test";

import {
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
  SEED,
  login,
  runStamp,
  shot,
} from "./support.js";

/**
 * Issue 9 — E2E Administrator flow (`e2e/lab-03/admin-flow.spec.ts`).
 *
 * Covers the `/admin/users` console against the real API:
 * - Directory table renders seed users with role + status badges.
 * - User creation through the drawer (unique email per run) + success notice.
 * - Client-side search and role filter.
 * - Self-deactivation block (BR-22): the Active switch and the "Deactivate
 *   User" button are disabled for the logged-in Administrator's own row.
 * - Last-admin safety rule (BR-23): after deactivating John Smith, the only
 *   remaining active Administrator attempts a role demotion and the server
 *   rejects it with 422 ("Cannot deactivate or demote the last active
 *   Administrator"). John Smith is reactivated afterwards so the seed stays
 *   reproducible.
 */
test.describe("Lab 3 — Administrator user management console", () => {
  const stamp = runStamp();
  // Include the per-run stamp in the name too: E2E runs accumulate accounts in
  // the dev database, so a fixed name would make name-search count ambiguous.
  const createdName = `E2E QA User ${stamp}`;
  const createdEmail = `e2e-qa-${stamp}@toktickit.test`;
  const createdPassword = "E2EInitial!2026x";

  test("directory, creation, search/filter, safety rules, and mobile view", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);

    // 1. Login as Administrator → role landing /admin/users.
    await login(page, SEED.admin);
    await page.waitForURL((url) => url.pathname === "/admin/users", { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await expect(page.getByTestId("user-row").first()).toBeVisible();

    // [06] Review screenshot — admin user management table (unfiltered).
    await shot(page, "06-admin-user-management");

    // Seed accounts are reachable regardless of pagination: the search box
    // filters the whole directory client-side (E2E runs accumulate accounts).
    await page.locator("#user-search").fill(SEED.admin);
    await expect(page.getByTestId("user-row")).toHaveCount(1);
    await expect(page.getByTestId("user-row")).toContainText("System Administrator");
    await page.locator("#user-search").fill(SEED.staff);
    await expect(page.getByTestId("user-row")).toHaveCount(1);
    await expect(page.getByTestId("user-row")).toContainText("Michael Brown");
    await page.locator("#user-search").fill("");

    // 2. Create a new user through the drawer.
    await page.locator("#create-user-btn").click();
    await expect(page.getByRole("heading", { name: "Create New User" })).toBeVisible();
    await page.locator("#user-name").fill(createdName);
    await page.locator("#user-email").fill(createdEmail);
    await page.locator("#user-role").selectOption("IT_STAFF");
    await page.locator("#user-department").fill("E2E QA");
    await page.locator("#user-initial-password").fill(createdPassword);
    await page.getByRole("button", { name: "Save User" }).click();

    await expect(page.getByRole("status").last()).toContainText(
      `User "${createdName}" created.`
    );
    await expect(
      page.getByTestId("user-row").filter({ hasText: createdEmail })
    ).toBeVisible();

    // [14] Review screenshot — directory right after user creation.
    await shot(page, "14-admin-create-user");

    // 3. Client-side search isolates rows by name and email.
    await page.locator("#user-search").fill(createdName);
    await expect(page.getByTestId("user-row")).toHaveCount(1);
    await page.locator("#user-search").fill(createdEmail);
    await expect(page.getByTestId("user-row")).toHaveCount(1);
    await expect(page.getByTestId("user-row")).toContainText(createdEmail);
    await page.locator("#user-search").fill("jennifer.anderson");
    await expect(page.getByTestId("user-row")).toHaveCount(1);
    await expect(page.getByTestId("user-row")).toContainText("Jennifer Anderson");
    await page.locator("#user-search").fill("");

    // 4. Role filter shows only IT Staff accounts.
    await page.locator("#role-filter").selectOption("IT_STAFF");
    const staffRows = page.getByTestId("user-row");
    await expect(staffRows.filter({ hasText: createdEmail })).toBeVisible();
    const roleBadges = staffRows.getByTestId("role-badge");
    const badgeCount = await roleBadges.count();
    expect(badgeCount).toBeGreaterThan(0);
    for (let i = 0; i < badgeCount; i += 1) {
      await expect(roleBadges.nth(i)).toHaveText("IT Staff");
    }
    await page.locator("#role-filter").selectOption("ALL");

    // 5. BR-22 self-deactivation block: own row cannot be deactivated.
    await page.locator("#user-search").fill(SEED.admin);
    const selfRow = page.getByTestId("user-row").filter({ hasText: "System Administrator" });
    await selfRow.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: "Edit User" })).toBeVisible();
    await expect(page.locator("#user-active")).toBeDisabled();
    await expect(page.getByText("cannot deactivate your own account")).toBeVisible();
    await expect(page.getByRole("button", { name: "Deactivate User" })).toBeDisabled();

    // [16] Review screenshot — self-deactivation guard in the edit drawer.
    await shot(page, "16-admin-self-deactivation-block");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Edit User" })).toBeHidden();

    // 6. Deactivating another Administrator is allowed while two are active.
    await page.locator("#user-search").fill(SEED.adminTwo);
    const johnRow = page.getByTestId("user-row").filter({ hasText: "John Smith" });
    await johnRow.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("button", { name: "Deactivate User" })).toBeEnabled();
    await page.getByRole("button", { name: "Deactivate User" }).click();
    await expect(page.getByRole("status").last()).toContainText(
      'User "John Smith" deactivated.'
    );
    await expect(johnRow).toContainText("Inactive");

    // 7. BR-23 last-admin guard: demoting the only remaining active
    //    Administrator is rejected by the server with 422.
    await page.locator("#user-search").fill(SEED.admin);
    await selfRow.getByRole("button", { name: "Edit" }).click();
    await expect(page.locator("#user-role")).toHaveValue("ADMINISTRATOR");
    await page.locator("#user-role").selectOption("REQUESTER");
    await page.getByRole("button", { name: "Save User" }).click();

    const drawerError = page.locator(".modal .alert-danger");
    await expect(drawerError).toContainText(/last active Administrator/i);

    // [17] Review screenshot — last-admin safety rule enforcement.
    await shot(page, "17-admin-last-admin-guard");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Edit User" })).toBeHidden();

    // 8. Restore seed state: reactivate John Smith.
    await page.locator("#user-search").fill(SEED.adminTwo);
    await johnRow.getByRole("button", { name: "Edit" }).click();
    const activeSwitch = page.locator("#user-active");
    if (!(await activeSwitch.isChecked())) {
      await activeSwitch.check();
    }
    await page.getByRole("button", { name: "Save User" }).click();
    await expect(page.getByRole("status").last()).toContainText(
      'User "John Smith" updated successfully.'
    );
    await expect(johnRow).toContainText("Active");

    // 9. Mobile (<768px): the console stays usable with horizontal scrolling.
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

    // [15] Review screenshot — mobile admin console.
    await shot(page, "15-admin-users-mobile");
  });
});
