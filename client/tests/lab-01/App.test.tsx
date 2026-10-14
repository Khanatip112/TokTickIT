import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

describe("App Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/");
    // No active session → the app must show the Login screen.
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(null);
  });

  it("renders the TokTickIT login screen when unauthenticated", async () => {
    render(<App />);
    expect((await screen.findAllByText(/TokTickIT/i)).length).toBeGreaterThan(0);
    expect(await screen.findByRole("heading", { name: /Sign in to your account/i })).toBeInTheDocument();
  });
});
