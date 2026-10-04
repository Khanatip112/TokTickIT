import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Login } from "../../src/pages/Login";
import { AuthProvider } from "../../src/context/AuthContext";
import { RouterProvider } from "../../src/router";
import App from "../../src/App";
import * as api from "../../src/api";

const requesterUser: api.AuthUser = {
  id: "u-1",
  name: "Jennifer Anderson",
  email: "jennifer.anderson@toktickit.com",
  role: "REQUESTER",
  department: "Marketing",
  isActive: true,
  requiresPasswordChange: false,
};

const mustChangeUser: api.AuthUser = {
  ...requesterUser,
  id: "u-2",
  name: "Emily Davis",
  requiresPasswordChange: true,
};

function renderLogin() {
  return render(
    <AuthProvider>
      <RouterProvider>
        <Login />
      </RouterProvider>
    </AuthProvider>
  );
}

describe("Login Screen (/login)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/login");
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(null);
  });

  it("renders email and password fields, the Sign In button, and the brand", async () => {
    renderLogin();

    expect(await screen.findByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.getAllByText(/TokTickIT/i).length).toBeGreaterThan(0);
  });

  it("shows client-side validation errors when submitting an empty form", async () => {
    const user = userEvent.setup();
    const loginSpy = vi.spyOn(api, "login").mockResolvedValue(requesterUser);
    renderLogin();

    await screen.findByLabelText("Email address");
    await user.click(screen.getByRole("button", { name: /Sign In/i }));

    expect(await screen.findByText(/Email address is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Password is required/i)).toBeInTheDocument();
    expect(loginSpy).not.toHaveBeenCalled();
  });

  it("displays an error banner for invalid credentials", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "login").mockRejectedValue(
      new api.ApiError("Invalid email or password. Please try again.", 401, "UNAUTHORIZED")
    );
    renderLogin();

    await user.type(await screen.findByLabelText("Email address"), "jennifer.anderson@toktickit.com");
    await user.type(screen.getByLabelText("Password"), "WrongPassword1!");
    await user.click(screen.getByRole("button", { name: /Sign In/i }));

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent(/Invalid email or password/i);
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    renderLogin();

    const passwordInput = await screen.findByLabelText("Password");
    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /Show password/i }));
    expect(passwordInput).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: /Hide password/i }));
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("submits valid credentials through the login action", async () => {
    const user = userEvent.setup();
    const loginSpy = vi.spyOn(api, "login").mockResolvedValue(requesterUser);
    renderLogin();

    await user.type(await screen.findByLabelText("Email address"), "jennifer.anderson@toktickit.com");
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.click(screen.getByRole("button", { name: /Sign In/i }));

    await waitFor(() =>
      expect(loginSpy).toHaveBeenCalledWith("jennifer.anderson@toktickit.com", "Password123!")
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("forces users flagged mustChangePassword to the Change Password screen", async () => {
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(mustChangeUser);

    render(<App />);

    expect(await screen.findByRole("heading", { name: /Change Your Password/i })).toBeInTheDocument();
    expect(screen.getByText(/You must change your password to continue/i)).toBeInTheDocument();
    expect(screen.queryByText(/Sign in to your account/i)).not.toBeInTheDocument();
  });
});
