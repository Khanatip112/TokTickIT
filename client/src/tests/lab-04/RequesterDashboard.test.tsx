// @vitest-environment jsdom
/**
 * RequesterDashboard.test.tsx — Lab 4 Issue 6 UI tests.
 *
 * Covers metric card values from the mock API response, drill-down navigation
 * URLs, quick actions, recent-ticket rendering, and loading/error states.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";

import { RequesterDashboard } from "../../pages/requester/RequesterDashboard.js";
import type { RequesterDashboardData } from "../../services/dashboardApi.js";

const mockDashboard: RequesterDashboardData = {
  totalOpenTickets: 4,
  inProgressCount: 2,
  waitingForRequesterCount: 1,
  recentlyResolvedCount: 3,
  closedTicketsCount: 5,
  recentlyUpdatedCount: 6,
  ticketsWaitingForRequester: 1,
  recentlyResolvedTickets: 3,
  recentlyUpdatedTickets: 6,
  recentTickets: [
    {
      id: "tkt-001",
      ticketNumber: "TKT-0001",
      summary: "Laptop battery drains rapidly after BIOS update",
      currentStatus: "IN_PROGRESS",
      requestedPriority: "HIGH",
      itPriority: "URGENT",
      category: { id: "cat-hardware", name: "Hardware" },
      assignedTo: { id: "usr-staff-1", fullName: "Michael Brown" },
      updatedAt: "2026-10-15T10:30:00.000Z",
      createdAt: "2026-10-14T08:00:00.000Z",
    },
    {
      id: "tkt-002",
      ticketNumber: "TKT-0002",
      summary: "VPN client fails to connect from home network",
      currentStatus: "WAITING_FOR_REQUESTER",
      requestedPriority: "MEDIUM",
      itPriority: "MEDIUM",
      category: { id: "cat-network", name: "Network" },
      assignedTo: null,
      updatedAt: "2026-10-13T09:15:00.000Z",
      createdAt: "2026-10-12T07:45:00.000Z",
    },
  ],
};

const renderDashboard = (
  overrides: Partial<ComponentProps<typeof RequesterDashboard>> = {}
) => {
  const onNavigate = overrides.onNavigate ?? vi.fn();
  const onViewTicket = overrides.onViewTicket ?? vi.fn();
  const fetchDashboard =
    overrides.fetchDashboard ?? vi.fn().mockResolvedValue(mockDashboard);

  render(
    <RequesterDashboard
      userName="Jane Requester"
      onNavigate={onNavigate}
      onViewTicket={onViewTicket}
      fetchDashboard={fetchDashboard}
      {...overrides}
    />
  );

  return { onNavigate, onViewTicket, fetchDashboard };
};

describe("RequesterDashboard — metric cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the welcome header and all four KPI values from the API response", async () => {
    renderDashboard();

    expect(screen.getByTestId("requester-dashboard")).toBeInTheDocument();
    expect(screen.getByText(/Welcome, Jane Requester!/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("metric-value-totalOpenTickets")).toHaveTextContent("4");
    });

    expect(screen.getByTestId("metric-value-inProgressCount")).toHaveTextContent("2");
    expect(screen.getByTestId("metric-value-waitingForRequesterCount")).toHaveTextContent("1");
    expect(screen.getByTestId("metric-value-recentlyResolvedCount")).toHaveTextContent("3");

    expect(screen.getByText("My Open Tickets")).toBeInTheDocument();
    expect(screen.getByText("Waiting for My Reply")).toBeInTheDocument();
  });

  it("renders the recent tickets widget with status and priority badges", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId("recent-tickets-list")).toBeInTheDocument();
    });

    expect(screen.getByTestId("recent-ticket-tkt-001")).toBeInTheDocument();
    expect(screen.getByTestId("recent-ticket-tkt-002")).toBeInTheDocument();
    expect(screen.getByText("Laptop battery drains rapidly after BIOS update")).toBeInTheDocument();

    const recentList = within(screen.getByTestId("recent-tickets-list"));
    expect(recentList.getByText("In Progress")).toBeInTheDocument();
    expect(recentList.getByText("Waiting for Requester")).toBeInTheDocument();
    expect(recentList.getByText("High")).toBeInTheDocument();
    expect(recentList.getByText("Medium")).toBeInTheDocument();
  });
});

describe("RequesterDashboard — drill-down and quick actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navigates to the correctly filtered My Tickets URL for each metric card", async () => {
    const { onNavigate } = renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId("metric-card-totalOpenTickets")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("metric-card-totalOpenTickets"));
    expect(onNavigate).toHaveBeenLastCalledWith("/my-tickets");

    fireEvent.click(screen.getByTestId("metric-card-inProgressCount"));
    expect(onNavigate).toHaveBeenLastCalledWith("/my-tickets?status=IN_PROGRESS");

    fireEvent.click(screen.getByTestId("metric-card-waitingForRequesterCount"));
    expect(onNavigate).toHaveBeenLastCalledWith(
      "/my-tickets?status=WAITING_FOR_REQUESTER"
    );

    fireEvent.click(screen.getByTestId("metric-card-recentlyResolvedCount"));
    expect(onNavigate).toHaveBeenLastCalledWith("/my-tickets?status=RESOLVED");
  });

  it("wires the Quick Action buttons to Create Ticket and My Tickets", async () => {
    const { onNavigate } = renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId("quick-create-ticket")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("quick-create-ticket"));
    expect(onNavigate).toHaveBeenLastCalledWith("/create-ticket");

    fireEvent.click(screen.getByTestId("quick-view-all-tickets"));
    expect(onNavigate).toHaveBeenLastCalledWith("/my-tickets");
  });

  it("opens a recent ticket through the view-ticket drill-down", async () => {
    const { onViewTicket } = renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId("view-ticket-tkt-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("view-ticket-tkt-001"));
    expect(onViewTicket).toHaveBeenCalledWith("tkt-001");
  });
});

describe("RequesterDashboard — loading and error states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading skeleton while the dashboard request is in flight", () => {
    const pending = new Promise<RequesterDashboardData>(() => {
      /* intentionally never resolves */
    });

    renderDashboard({ fetchDashboard: vi.fn().mockReturnValue(pending) });

    expect(screen.getByTestId("requester-dashboard-loading")).toBeInTheDocument();
  });

  it("shows an error state and retries the request", async () => {
    const fetchDashboard = vi
      .fn()
      .mockRejectedValueOnce(new Error("Dashboard service unavailable."))
      .mockResolvedValueOnce(mockDashboard);

    renderDashboard({ fetchDashboard });

    await waitFor(() => {
      expect(screen.getByTestId("requester-dashboard-error")).toBeInTheDocument();
    });
    expect(screen.getByText("Dashboard service unavailable.")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("requester-dashboard-retry"));

    await waitFor(() => {
      expect(screen.getByTestId("metric-value-totalOpenTickets")).toHaveTextContent("4");
    });
    expect(fetchDashboard).toHaveBeenCalledTimes(2);
  });
});
