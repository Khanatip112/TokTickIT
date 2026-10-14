import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MyTicketsList } from "../../src/components/MyTicketsList";
import * as api from "../../src/api";
import { AuthProvider } from "../../src/context/AuthContext";
import React from "react";

const mockUser: api.AuthUser = {
  id: "req-1",
  name: "Jennifer Anderson",
  email: "jennifer.anderson@kmutt.ac.th",
  role: "REQUESTER",
  department: "Computer Engineering",
  isActive: true,
  requiresPasswordChange: false,
};

const mockTickets: api.Ticket[] = [
  {
    id: "tkt-1",
    ticketNumber: "TKT-2026-000001",
    requesterId: "req-1",
    categoryId: "1",
    relatedSystemId: "1",
    requestedPriority: "HIGH",
    currentStatus: "NEW",
    summary: "Laptop battery drains quickly",
    description: "Laptop battery draining fast.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    category: { id: "1", name: "Hardware" },
    attachments: [],
  },
];

const mockPagination: api.Pagination = {
  totalCount: 1,
  page: 1,
  pageSize: 8,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

const emptyPagination: api.Pagination = {
  totalCount: 0,
  page: 1,
  pageSize: 8,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

function renderList(props: { onViewTicket?: (id: string) => void; onCreateTicket?: () => void } = {}) {
  return render(
    <AuthProvider>
      <MyTicketsList
        onViewTicket={props.onViewTicket ?? vi.fn()}
        onCreateTicket={props.onCreateTicket ?? vi.fn()}
      />
    </AuthProvider>
  );
}

describe("MyTicketsList Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getCurrentUser").mockResolvedValue(mockUser);
    vi.spyOn(api, "getCategories").mockResolvedValue([]);
  });

  it("renders list of tickets owned by requester", async () => {
    vi.spyOn(api, "getMyTickets").mockResolvedValue({ data: mockTickets, pagination: mockPagination });
    renderList();

    expect((await screen.findAllByText("TKT-2026-000001")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Laptop battery drains quickly").length).toBeGreaterThan(0);
  });

  it("shows empty state when requester has no tickets", async () => {
    vi.spyOn(api, "getMyTickets").mockResolvedValue({ data: [], pagination: emptyPagination });
    renderList();

    await waitFor(() => {
      expect(screen.getByText(/No tickets/i)).toBeInTheDocument();
    });
  });

  it("calls onViewTicket callback when a row is clicked", async () => {
    vi.spyOn(api, "getMyTickets").mockResolvedValue({ data: mockTickets, pagination: mockPagination });
    const onViewTicketMock = vi.fn();

    renderList({ onViewTicket: onViewTicketMock });

    const ticketNoCells = await screen.findAllByText("TKT-2026-000001");
    fireEvent.click(ticketNoCells[0]);

    expect(onViewTicketMock).toHaveBeenCalledWith("tkt-1");
  });
});
