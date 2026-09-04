import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
import { RequesterProvider } from "../../src/context/RequesterContext.js";
import React from "react";

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

/** Render App wrapped in the RequesterProvider (mirrors main.tsx setup) */
function renderApp() {
  return render(
    <RequesterProvider>
      <App />
    </RequesterProvider>
  );
}

describe("Dev Requester Identity Context & Selector", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    // Prevent real API calls from MyTicketsList component
    vi.spyOn(api, "getMyTickets").mockResolvedValue([]);
  });

  it("hydrates first active requester when localStorage is empty", async () => {
    vi.spyOn(api, "getDevRequesters").mockResolvedValueOnce(mockRequesters);

    renderApp();

    const elements = await screen.findAllByText(/Jennifer Anderson/i);
    expect(elements.length).toBeGreaterThan(0);
    expect(localStorage.getItem("toktickit_requester_id")).toBe("req-1");
  });

  it("hydrates saved requester from localStorage", async () => {
    localStorage.setItem("toktickit_requester_id", "req-2");
    vi.spyOn(api, "getDevRequesters").mockResolvedValueOnce(mockRequesters);

    renderApp();

    const elements = await screen.findAllByText(/David Lee/i);
    expect(elements.length).toBeGreaterThan(0);
  });

  it("opens modal and switches requester context when clicking dev identity switcher", async () => {
    vi.spyOn(api, "getDevRequesters").mockResolvedValue(mockRequesters);

    renderApp();

    const elements = await screen.findAllByText(/Jennifer Anderson/i);
    expect(elements.length).toBeGreaterThan(0);

    // Click the identity switcher button in the header (using its unique ID)
    const changeBtn = document.getElementById("dev-identity-switcher-btn")!;
    fireEvent.click(changeBtn);

    // Modal should open
    await waitFor(() => {
      const modalTitle = document.getElementById("devSelectorModalTitle");
      expect(modalTitle).not.toBeNull();
    });

    // Click David Lee in the modal
    const davidOption = screen.getByText("David Lee");
    fireEvent.click(davidOption);

    await waitFor(() => {
      expect(localStorage.getItem("toktickit_requester_id")).toBe("req-2");
    });
  });
});
