import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MyTicketsList } from "../../src/components/MyTicketsList";
import * as api from "../../src/api";
import { RequesterProvider } from "../../src/context/RequesterContext";
import React from "react";

const mockRequester: api.DevRequester = {
  id: "req-1",
  name: "Jennifer Anderson",
  email: "jennifer.anderson@kmutt.ac.th",
  department: "Computer Engineering",
};

const mockTickets: api.Ticket[] = [
  {
    id: "tkt-1",
    ticketNumber: "TKT-2026-000001",
    requesterId: "req-1",
    categoryId: "1",
    requestedPriority: "HIGH",
    currentStatus: "NEW",
    summary: "Laptop battery drains quickly",
    description: "Laptop battery draining fast.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    category: { id: 1, name: "Hardware" },
    attachments: [],
  },
];

describe("MyTicketsList Component", () => {
  beforeEach(() => {
    localStorage.setItem("toktickit_requester_id", "req-1");
    vi.restoreAllMocks();
    vi.spyOn(api, "getDevRequesters").mockResolvedValue([mockRequester]);
  });

  it("renders list of tickets owned by requester", async () => {
    vi.spyOn(api, "getMyTickets").mockResolvedValue(mockTickets);

    render(
      <RequesterProvider>
        <MyTicketsList onViewTicket={vi.fn()} onCreateTicket={vi.fn()} />
      </RequesterProvider>
    );

    expect(await screen.findByText("TKT-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("Laptop battery drains quickly")).toBeInTheDocument();
  });

  it("shows empty state when requester has no tickets", async () => {
    vi.spyOn(api, "getMyTickets").mockResolvedValue([]);

    render(
      <RequesterProvider>
        <MyTicketsList onViewTicket={vi.fn()} onCreateTicket={vi.fn()} />
      </RequesterProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/No tickets/i) || screen.getByText(/No tickets found/i)
      ).toBeInTheDocument();
    });
  });

  it("calls onViewTicket callback when view button clicked", async () => {
    vi.spyOn(api, "getMyTickets").mockResolvedValue(mockTickets);
    const onViewTicketMock = vi.fn();

    render(
      <RequesterProvider>
        <MyTicketsList onViewTicket={onViewTicketMock} onCreateTicket={vi.fn()} />
      </RequesterProvider>
    );

    expect(await screen.findByText("TKT-2026-000001")).toBeInTheDocument();
    const ticketNoCell = await screen.findByText("TKT-2026-000001");
    fireEvent.click(ticketNoCell);

    expect(onViewTicketMock).toHaveBeenCalledWith("tkt-1");
  });
});