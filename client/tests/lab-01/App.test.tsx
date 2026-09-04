import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

describe("App", () => {
  it("renders the TokTickIT heading", () => {
    render(<App />);
    expect(screen.getAllByText(/TokTickIT/i).length).toBeGreaterThan(0);
  });

  it("shows Online and the seeded categories in a table on success", async () => {
    vi.spyOn(api, "checkSystem").mockResolvedValueOnce({
      online: true,
      categories: [
        { id: "cat-1", name: "Account and Access" },
        { id: "cat-2", name: "Hardware" },
        { id: "cat-3", name: "Software" },
        { id: "cat-4", name: "Network" },
      ],
    });

    render(<App />);
    const button = screen.getByRole("button", { name: /Check System/i });
    fireEvent.click(button);

    expect(await screen.findByText(/Online/i)).toBeInTheDocument();
    expect(screen.getByText(/System Status:/i)).toBeInTheDocument();

    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();

    expect(within(table).getByText("Category ID")).toBeInTheDocument();
    expect(within(table).getByText("Category Name")).toBeInTheDocument();

    expect(within(table).getByText("Account and Access")).toBeInTheDocument();
    expect(within(table).getByText("Hardware")).toBeInTheDocument();
    expect(within(table).getByText("Software")).toBeInTheDocument();
    expect(within(table).getByText("Network")).toBeInTheDocument();
  });

  it("shows an Offline error message when the API is unavailable", async () => {
    vi.spyOn(api, "checkSystem").mockRejectedValueOnce(
      new Error("Unable to connect to TokTickIT API")
    );

    render(<App />);
    const button = screen.getByRole("button", { name: /Check System/i });
    fireEvent.click(button);

    expect(await screen.findByText(/Offline/i)).toBeInTheDocument();
    expect(screen.getByText(/System Status:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Unable to connect to TokTickIT API/i)
    ).toBeInTheDocument();
  });
});
