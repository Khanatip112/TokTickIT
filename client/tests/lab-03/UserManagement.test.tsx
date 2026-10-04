import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { UserManagement } from "../../src/pages/UserManagement";
import { AuthProvider } from "../../src/context/AuthContext";
import * as api from "../../src/api";

const adminUser: api.AdminUser = {
  id: "a-1",
  name: "System Administrator",
  email: "admin@toktickit.com",
  role: "ADMINISTRATOR",
  department: "IT Administration",
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
  createdAt: "2026-05-01T08:00:00.000Z",
};

const staffUser: api.AdminUser = {
  id: "s-1",
  name: "Michael Brown",
  email: "michael.brown@toktickit.com",
  role: "IT_STAFF",
  department: "IT Support",
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
  createdAt: "2026-05-01T08:00:00.000Z",
};

const requesterUser: api.AdminUser = {
  id: "r-1",
  name: "Jennifer Anderson",
  email: "jennifer.anderson@toktickit.com",
  role: "REQUESTER",
  department: "Marketing",
  isActive: true,
  requiresPasswordChange: false,
  mustChangePassword: false,
  createdAt: "2026-05-01T08:00:00.000Z",
};

const inactiveUser: api.AdminUser = {
  id: "s-2",
  name: "Kevin Patel",
  email: "kevin.patel@toktickit.com",
  role: "IT_STAFF",
  department: "IT Support",
  isActive: false,
  requiresPasswordChange: true,
  mustChangePassword: true,
  createdAt: "2026-05-02T08:00:00.000Z",
};

const directory = [adminUser, staffUser, requesterUser, inactiveUser];

function renderPage() {
  return render(
    <AuthProvider>
      <UserManagement />
    </AuthProvider>
  );
}

function rowFor(name: string): HTMLElement {
  const row = screen.getAllByTestId("user-row").find((r) => within(r).queryByText(name));
  if (!row) throw new Error(`No row found for ${name}`);
  return row;
}

describe("UserManagement Screen (/admin/users)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/admin/users");
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: "ADMINISTRATOR",
      department: adminUser.department,
      isActive: true,
      requiresPasswordChange: false,
    });
    vi.spyOn(api, "listUsers").mockResolvedValue(directory);
  });

  it("renders the user directory with roles, statuses, and actions", async () => {
    renderPage();

    expect(await screen.findByText("System Administrator")).toBeInTheDocument();
    expect(screen.getByText("michael.brown@toktickit.com")).toBeInTheDocument();
    expect(screen.getByText("jennifer.anderson@toktickit.com")).toBeInTheDocument();

    // Role + status badges
    expect(within(rowFor("Michael Brown")).getByText("IT Staff")).toBeInTheDocument();
    expect(within(rowFor("Kevin Patel")).getByText("Inactive")).toBeInTheDocument();
    expect(within(rowFor("System Administrator")).getByText("Administrator")).toBeInTheDocument();

    // Action buttons
    expect(within(rowFor("Michael Brown")).getByRole("button", { name: /Edit/i })).toBeInTheDocument();
    expect(within(rowFor("Michael Brown")).getByRole("button", { name: /Reset Password/i })).toBeInTheDocument();
  });

  it("filters the directory by search term (name or email)", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("System Administrator");

    await user.type(screen.getByLabelText("Search users"), "michael");

    expect(screen.getAllByTestId("user-row")).toHaveLength(1);
    expect(screen.getByText("Michael Brown")).toBeInTheDocument();
    expect(screen.queryByText("Jennifer Anderson")).not.toBeInTheDocument();
  });

  it("filters the directory by role", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("System Administrator");

    await user.selectOptions(screen.getByLabelText("Filter by role"), "REQUESTER");

    expect(screen.getAllByTestId("user-row")).toHaveLength(1);
    expect(screen.getByText("Jennifer Anderson")).toBeInTheDocument();
  });

  it("filters the directory by account status", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("System Administrator");

    await user.selectOptions(screen.getByLabelText("Filter by status"), "INACTIVE");

    expect(screen.getAllByTestId("user-row")).toHaveLength(1);
    expect(screen.getByText("Kevin Patel")).toBeInTheDocument();
  });

  it("opens the Create User modal and blocks invalid input with validation errors", async () => {
    const user = userEvent.setup();
    const createSpy = vi.spyOn(api, "createUser").mockResolvedValue(requesterUser);
    renderPage();
    await screen.findByText("System Administrator");

    await user.click(screen.getByRole("button", { name: /Create User/i }));
    const dialog = await screen.findByRole("dialog", { name: /Create New User/i });

    await user.clear(within(dialog).getByLabelText(/Full Name/i));
    await user.clear(within(dialog).getByLabelText(/Email Address/i));
    await user.click(within(dialog).getByRole("button", { name: /Save User/i }));

    expect(await within(dialog).findByText(/Full name must be between/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/A valid email address is required/i)).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("creates a new user through the Create User modal", async () => {
    const user = userEvent.setup();
    const createSpy = vi
      .spyOn(api, "createUser")
      .mockResolvedValue({ ...staffUser, id: "new-1", name: "New Person", email: "new.person@toktickit.com" });
    renderPage();
    await screen.findByText("System Administrator");

    await user.click(screen.getByRole("button", { name: /Create User/i }));
    const dialog = await screen.findByRole("dialog", { name: /Create New User/i });

    await user.clear(within(dialog).getByLabelText(/Full Name/i));
    await user.type(within(dialog).getByLabelText(/Full Name/i), "New Person");
    await user.clear(within(dialog).getByLabelText(/Email Address/i));
    await user.type(within(dialog).getByLabelText(/Email Address/i), "new.person@toktickit.com");
    await user.selectOptions(within(dialog).getByLabelText(/Role/i), "IT_STAFF");
    await user.click(within(dialog).getByRole("button", { name: /Save User/i }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy.mock.calls[0][0]).toMatchObject({
      name: "New Person",
      email: "new.person@toktickit.com",
      role: "IT_STAFF",
    });
    expect(await screen.findByText(/created/i)).toBeInTheDocument();
  });

  it("disables self-deactivation controls for the administrator's own account (BR-22)", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("System Administrator");

    await user.click(within(rowFor("System Administrator")).getByRole("button", { name: /Edit/i }));
    const dialog = await screen.findByRole("dialog", { name: /Edit User/i });

    expect(within(dialog).getByRole("switch", { name: /Active/i })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: /Deactivate User/i })).toBeDisabled();
  });

  it("allows deactivating a different user account", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Michael Brown");

    await user.click(within(rowFor("Michael Brown")).getByRole("button", { name: /Edit/i }));
    const dialog = await screen.findByRole("dialog", { name: /Edit User/i });

    expect(within(dialog).getByRole("switch", { name: /Active/i })).not.toBeDisabled();
    expect(within(dialog).getByRole("button", { name: /Deactivate User/i })).not.toBeDisabled();
  });

  it("resets a user's password via the Reset Password dialog", async () => {
    const user = userEvent.setup();
    const resetSpy = vi.spyOn(api, "resetUserPassword").mockResolvedValue({
      message: "Initial password set successfully. User will be required to change password on next login.",
      userId: "s-1",
    });
    renderPage();
    await screen.findByText("Michael Brown");

    await user.click(within(rowFor("Michael Brown")).getByRole("button", { name: /Reset Password/i }));
    const dialog = await screen.findByRole("dialog", { name: /Reset Password/i });

    await user.click(within(dialog).getByRole("button", { name: /Reset Password/i }));

    await waitFor(() => expect(resetSpy).toHaveBeenCalledWith("s-1", expect.any(String)));
    expect(await within(dialog).findByText(/Initial password set successfully/i)).toBeInTheDocument();
  });
});
