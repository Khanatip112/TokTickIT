import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ChangePassword } from "../../src/pages/ChangePassword";
import { AuthProvider } from "../../src/context/AuthContext";
import { RouterProvider } from "../../src/router";
import { passwordMeetsPolicy } from "../../src/components/PasswordChecklist";
import * as api from "../../src/api";

const mustChangeUser: api.AuthUser = {
  id: "u-2",
  name: "Emily Davis",
  email: "emily.davis@toktickit.com",
  role: "REQUESTER",
  department: "Sales & Marketing",
  isActive: true,
  requiresPasswordChange: true,
};

function renderChange() {
  return render(
    <AuthProvider>
      <RouterProvider>
        <ChangePassword />
      </RouterProvider>
    </AuthProvider>
  );
}

describe("ChangePassword Screen (/change-password)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/change-password");
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(mustChangeUser);
  });

  it("renders the mandatory prompt and all three password fields", async () => {
    renderChange();

    expect(await screen.findByRole("heading", { name: /Change Your Password/i })).toBeInTheDocument();
    expect(screen.getByText(/You must change your password to continue/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Current Password")).toBeInTheDocument();
    expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm New Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue/i })).toBeInTheDocument();
  });

  it("updates the live password-strength checklist as the user types", async () => {
    const user = userEvent.setup();
    renderChange();

    const newPassword = await screen.findByLabelText("New Password");
    expect(screen.getByTestId("password-rule-length")).toHaveAttribute("data-met", "false");
    expect(screen.getByTestId("password-rule-case")).toHaveAttribute("data-met", "false");
    expect(screen.getByTestId("password-rule-symbol")).toHaveAttribute("data-met", "false");

    await user.type(newPassword, "Str0ng!Pass");

    expect(screen.getByTestId("password-rule-length")).toHaveAttribute("data-met", "true");
    expect(screen.getByTestId("password-rule-case")).toHaveAttribute("data-met", "true");
    expect(screen.getByTestId("password-rule-symbol")).toHaveAttribute("data-met", "true");
    expect(passwordMeetsPolicy("Str0ng!Pass")).toBe(true);
    expect(passwordMeetsPolicy("weak")).toBe(false);
  });

  it("blocks submission when the new password fails complexity", async () => {
    const user = userEvent.setup();
    const changeSpy = vi
      .spyOn(api, "changePassword")
      .mockResolvedValue({ ...mustChangeUser, requiresPasswordChange: false });
    renderChange();

    await user.type(await screen.findByLabelText("Current Password"), "Password123!");
    await user.type(screen.getByLabelText("New Password"), "weak");
    await user.type(screen.getByLabelText("Confirm New Password"), "weak");
    await user.click(screen.getByRole("button", { name: /Continue/i }));

    expect(await screen.findByText(/does not meet all of the requirements/i)).toBeInTheDocument();
    expect(changeSpy).not.toHaveBeenCalled();
  });

  it("blocks submission when the confirmation does not match", async () => {
    const user = userEvent.setup();
    const changeSpy = vi
      .spyOn(api, "changePassword")
      .mockResolvedValue({ ...mustChangeUser, requiresPasswordChange: false });
    renderChange();

    await user.type(await screen.findByLabelText("Current Password"), "Password123!");
    await user.type(screen.getByLabelText("New Password"), "Str0ng!Pass");
    await user.type(screen.getByLabelText("Confirm New Password"), "Different!1");
    await user.click(screen.getByRole("button", { name: /Continue/i }));

    expect(await screen.findByText(/Passwords do not match/i)).toBeInTheDocument();
    expect(changeSpy).not.toHaveBeenCalled();
  });

  it("submits a valid password change and clears the requirement", async () => {
    const user = userEvent.setup();
    const changeSpy = vi
      .spyOn(api, "changePassword")
      .mockResolvedValue({ ...mustChangeUser, requiresPasswordChange: false });
    renderChange();

    await user.type(await screen.findByLabelText("Current Password"), "Password123!");
    await user.type(screen.getByLabelText("New Password"), "Str0ng!Pass");
    await user.type(screen.getByLabelText("Confirm New Password"), "Str0ng!Pass");
    await user.click(screen.getByRole("button", { name: /Continue/i }));

    await waitFor(() =>
      expect(changeSpy).toHaveBeenCalledWith("Password123!", "Str0ng!Pass", "Str0ng!Pass")
    );
    expect(await screen.findByText(/Password updated successfully/i)).toBeInTheDocument();
  });
});
