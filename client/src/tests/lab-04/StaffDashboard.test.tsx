// @vitest-environment jsdom
/**
 * StaffDashboard.test.tsx — Lab 4 Issue 7 UI tests.
 *
 * Covers metric card values from the mock API response, queue drill-down URLs,
 * Administrator-only account cards, quick actions, and loading/error states.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";

import { StaffDashboard } from "../../pages/staff/StaffDashboard.js";
import type { StaffDashboardData } from "../../services/staffDashboardApi.js";

const mockDashboard: StaffDashboardData = {
  unassignedCount: 4,
  assignedToMeCount: 7,
  inProgressCount: 12,
  waitingRequesterCount: 3,
  urgentPriorityCount: 2,
  resolvedTodayCount: 1,
  statusBreakdown: {
    NEW: 5,
    OPEN: 6,
    IN_PROGRESS: 12,
    PENDING: 1,
    WAITING_FOR_REQUESTER: 3,
    RESOLVED: 4,
    CLOSED: 9,
    REOPENED: 2,
    CANCELLED: 1,
  },
  priorityBreakdown: { LOW: 3, MEDIUM: 8, HIGH: 4, URGENT: 2 },
  recentTickets: [
    {
      id: "tkt-001",
      ticketNumber: "TKT-0001",
      summary: "Laptop battery drains rapidly after BIOS update",
      currentStatus: "IN_PROGRESS",
      requestedPriority: "HIGH",
      itPriority: "URGENT",
      category: { id: "cat-hardware", name: "Hardware" },
      requester: { id: "usr-req-1", fullName: "Jane Doe" },
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
      requester: { id: "usr-req-2", fullName: "Sam Lee" },
      assignedTo: null,
      updatedAt: "2026-10-13T09:15:00.000Z",
      createdAt: "2026-10-12T07:45:00.000Z",
    },
  ],
  userSummary: {
    activeRequestersCount: 15,
    activeStaffCount: 5,
    totalUsersCount: 22,
  },
  userAccountStats: {
    totalUsersCount: 22,
    activeUsersCount: 19,
    inactiveUsersCount: 3,
    byRole: { REQUESTER: 15, IT_STAFF: 5, ADMINISTRATOR: 2 },
  },
  unassignedTicketsCount: 4,
  myAssignedTicketsCount: 7,
  waitingForRequesterCount: 3,
  itPriorityBreakdown: { LOW: 3, MEDIUM: 8, HIGH: 4, URGENT: 2 },
  recentlyUpdatedTickets: [],
};

const renderDashboard = (
  overrides: Partial<ComponentProps<typeof StaffDashboard>> = {}
) => {
  const onNavigate = overrides.onNavigate ?? vi.fn();
  const onViewTicket = overrides.onViewTicket ?? vi.fn();
  const fetchDashboard =
    overrides.fetchDashboard ?? vi.fn().mockResolvedValue(mockDashboard);

  render(
    <StaffDashboard
      userName="Michael Brown"
      role="IT_STAFF"
      onNavigate={onNavigate}
      onViewTicket={onViewTicket}
      fetchDashboard={fetchDashboard}
      {...overrides}
    />
  );

  return { onNavigate, onViewTicket, fetchDashboard };
};

describe("StaffDashboard — metric cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the welcome header and all five KPI values from the API response", async () => {
    renderDashboard();

    expect(screen.getByTestId("staff-dashboard")).toBeInTheDocument();
    expect(screen.getByText(/Welcome back, Michael Brown!/i)).toBeInTheDocument();
    expect(
      screen.getByText("Operational overview of the IT service desk queue.")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("metric-value-unassignedCount")).toHaveTextContent("4");
    });

    expect(screen.getByTestId("metric-value-assignedToMeCount")).toHaveTextContent("7");
    expect(screen.getByTestId("metric-value-inProgressCount")).toHaveTextContent("12");
    expect(screen.getByTestId("metric-value-waitingRequesterCount")).toHaveTextContent("3");
    expect(screen.getByTestId("metric-value-urgentPriorityCount")).toHaveTextContent("2");

    expect(screen.getByText("Unassigned Tickets")).toBeInTheDocument();
    expect(screen.getByText("Assigned to Me")).toBeInTheDocument();
    expect(screen.getByText("Waiting on Requester")).toBeInTheDocument();
  });

  it("renders the recent tickets table with IT priority and status badges", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId("recent-tickets-list")).toBeInTheDocument();
    });

    expect(screen.getByTestId("recent-ticket-tkt-001")).toBeInTheDocument();
    expect(screen.getByTestId("recent-ticket-tkt-002")).toBeInTheDocument();
    expect(
      screen.getByText("Laptop battery drains rapidly after BIOS update")
    ).toBeInTheDocument();

    const recentList = within(screen.getByTestId("recent-tickets-list"));
    expect(recentList.getByText("Urgent")).toBeInTheDocument();
    expect(recentList.getByText("In Progress")).toBeInTheDocument();
    expect(recentList.getByText("Medium")).toBeInTheDocument();
  });
});

describe("StaffDashboard — drill-down and quick actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navigates to the correctly filtered staff queue URL for each metric card", async () => {
    const { onNavigate } = renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId("metric-card-unassignedCount")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("metric-card-unassignedCount"));
    expect(onNavigate).toHaveBeenLastCalledWith("/staff/queue?ownerId=unassigned");

    fireEvent.click(screen.getByTestId("metric-card-assignedToMeCount"));
    expect(onNavigate).toHaveBeenLastCalledWith("/staff/queue?ownerId=me");

    fireEvent.click(screen.getByTestId("metric-card-inProgressCount"));
    expect(onNavigate).toHaveBeenLastCalledWith("/staff/queue?status=IN_PROGRESS");

    fireEvent.click(screen.getByTestId("metric-card-waitingRequesterCount"));
    expect(onNavigate).toHaveBeenLastCalledWith(
      "/staff/queue?status=WAITING_FOR_REQUESTER"
    );

    fireEvent.click(screen.getByTestId("metric-card-urgentPriorityCount"));
    expect(onNavigate).toHaveBeenLastCalledWith("/staff/queue?itPriority=URGENT");
  });

  it("wires the Quick Action buttons to the queue, search, and create ticket", async () => {
    const { onNavigate } = renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId("quick-view-queue")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("quick-view-queue"));
    expect(onNavigate).toHaveBeenLastCalledWith("/staff/queue");

    fireEvent.click(screen.getByTestId("quick-search-tickets"));
    expect(onNavigate).toHaveBeenLastCalledWith("/staff/queue");

    fireEvent.click(screen.getByTestId("quick-create-ticket"));
    expect(onNavigate).toHaveBeenLastCalledWith("/create-ticket");
  });

  it("opens a recent ticket through the Open Detail drill-down", async () => {
    const { onViewTicket } = renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId("view-ticket-tkt-001")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("view-ticket-tkt-001"));
    expect(onViewTicket).toHaveBeenCalledWith("tkt-001");
  });
});

describe("StaffDashboard — administrator section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders user account statistics for ADMINISTRATOR users", async () => {
    renderDashboard({ role: "ADMINISTRATOR" });

    await waitFor(() => {
      expect(screen.getByTestId("admin-user-stats")).toBeInTheDocument();
    });

    expect(screen.getByTestId("admin-metric-value-totalUsersCount")).toHaveTextContent("22");
    expect(screen.getByTestId("admin-metric-value-activeUsersCount")).toHaveTextContent("19");
    expect(screen.getByTestId("admin-metric-value-inactiveUsersCount")).toHaveTextContent("3");
    expect(screen.getByTestId("admin-metric-value-requestersCount")).toHaveTextContent("15");
    expect(screen.getByTestId("admin-metric-value-staffCount")).toHaveTextContent("5");
    expect(screen.getByTestId("admin-metric-value-administratorsCount")).toHaveTextContent("2");
  });

  it("keeps the administrator section hidden for IT_STAFF users", async () => {
    renderDashboard({ role: "IT_STAFF" });

    await waitFor(() => {
      expect(screen.getByTestId("metric-value-unassignedCount")).toHaveTextContent("4");
    });

    expect(screen.queryByTestId("admin-user-stats")).not.toBeInTheDocument();
    expect(screen.queryByText("User Account Overview")).not.toBeInTheDocument();
  });
});

describe("StaffDashboard — loading and error states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading skeleton while the dashboard request is in flight", () => {
    const pending = new Promise<StaffDashboardData>(() => {
      /* intentionally never resolves */
    });

    renderDashboard({ fetchDashboard: vi.fn().mockReturnValue(pending) });

    expect(screen.getByTestId("staff-dashboard-loading")).toBeInTheDocument();
  });

  it("shows an error state and retries the request", async () => {
    const fetchDashboard = vi
      .fn()
      .mockRejectedValueOnce(new Error("Dashboard service unavailable."))
      .mockResolvedValueOnce(mockDashboard);

    renderDashboard({ fetchDashboard });

    await waitFor(() => {
      expect(screen.getByTestId("staff-dashboard-error")).toBeInTheDocument();
    });
    expect(screen.getByText("Dashboard service unavailable.")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("staff-dashboard-retry"));

    await waitFor(() => {
      expect(screen.getByTestId("metric-value-unassignedCount")).toHaveTextContent("4");
    });
    expect(fetchDashboard).toHaveBeenCalledTimes(2);
  });
});
