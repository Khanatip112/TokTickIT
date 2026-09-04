import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

describe("App", () => {
  it("renders the TokTickIT heading", () => {
    render(<App />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  it("shows Online and the seeded categories in a table on success", async () => {
    vi.spyOn(api, "checkSystem").mockResolvedValueOnce({
      online: true,
      categories: [
        { id: 1, name: "Account and Access" },
        { id: 2, name: "Hardware and Equipment" },
        { id: 3, name: "Software and Applications" },
        { id: 4, name: "Network and Internet" },
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
    expect(within(table).getByText("Hardware and Equipment")).toBeInTheDocument();
    expect(within(table).getByText("Software and Applications")).toBeInTheDocument();
    expect(within(table).getByText("Network and Internet")).toBeInTheDocument();
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

