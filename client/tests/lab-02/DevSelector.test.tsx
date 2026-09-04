import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const mockRequesters: api.DevRequester[] = [
  {
    id: "req-1",
    name: "Jennifer Anderson",
    email: "jennifer.anderson@kmutt.ac.th",
    department: "Computer Engineering",
  },
  {
    id: "req-2",
    name: "David Lee",
    email: "david.lee@kmutt.ac.th",
    department: "Information Technology",
  },
];

describe("Dev Requester Identity Context & Selector", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("hydrates first active requester when localStorage is empty", async () => {
    vi.spyOn(api, "getDevRequesters").mockResolvedValueOnce(mockRequesters);

    render(<App />);

    const elements = await screen.findAllByText(/Jennifer Anderson/i);
    expect(elements.length).toBeGreaterThan(0);
    expect(localStorage.getItem("toktickit_requester_id")).toBe("req-1");
  });

  it("hydrates saved requester from localStorage", async () => {
    localStorage.setItem("toktickit_requester_id", "req-2");
    vi.spyOn(api, "getDevRequesters").mockResolvedValueOnce(mockRequesters);

    render(<App />);

    const elements = await screen.findAllByText(/David Lee/i);
    expect(elements.length).toBeGreaterThan(0);
  });

  it("opens modal and switches requester context when clicking Change Requester", async () => {
    vi.spyOn(api, "getDevRequesters").mockResolvedValue(mockRequesters);

    render(<App />);

    const elements = await screen.findAllByText(/Jennifer Anderson/i);
    expect(elements.length).toBeGreaterThan(0);

    const changeBtn = screen.getByRole("button", { name: /Change Requester/i });
    fireEvent.click(changeBtn);

    expect(screen.getByText(/Select Development Requester/i)).toBeInTheDocument();

    const davidOption = screen.getByText("David Lee");
    fireEvent.click(davidOption);

    await waitFor(() => {
      expect(localStorage.getItem("toktickit_requester_id")).toBe("req-2");
    });
  });
});
