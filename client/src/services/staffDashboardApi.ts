import type { StaffTicketStatus, TicketPriority } from "../api.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/**
 * Lab 4 — IT Staff / Administrator Dashboard API client (Issue 7).
 *
 * Isolated from the shared `api.ts` surface. The browser session cookie is sent
 * with `credentials: "include"`; the backend derives the "assigned to me"
 * metric from that session identity.
 */
export interface StaffDashboardRecentTicket {
  id: string;
  ticketNumber: string;
  summary: string;
  currentStatus: StaffTicketStatus;
  requestedPriority: TicketPriority;
  itPriority: TicketPriority;
  category: { id: string; name: string } | null;
  requester: { id: string; fullName: string } | null;
  assignedTo: { id: string; fullName: string } | null;
  updatedAt: string;
  createdAt: string;
}

export interface StaffDashboardUserSummary {
  activeRequestersCount: number;
  activeStaffCount: number;
  totalUsersCount: number;
}

export interface StaffDashboardUserAccountStats {
  totalUsersCount: number;
  activeUsersCount: number;
  inactiveUsersCount: number;
  byRole: {
    REQUESTER: number;
    IT_STAFF: number;
    ADMINISTRATOR: number;
  };
}

export interface StaffDashboardData {
  unassignedCount: number;
  assignedToMeCount: number;
  inProgressCount: number;
  waitingRequesterCount: number;
  urgentPriorityCount: number;
  resolvedTodayCount: number;
  statusBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  recentTickets: StaffDashboardRecentTicket[];
  /** Administrator-only (null for IT Staff). */
  userSummary: StaffDashboardUserSummary | null;
  /** Administrator-only (null for IT Staff). */
  userAccountStats: StaffDashboardUserAccountStats | null;
  /** Mission-facing aliases returned by the API. */
  unassignedTicketsCount?: number;
  myAssignedTicketsCount?: number;
  waitingForRequesterCount?: number;
  itPriorityBreakdown?: Record<string, number>;
  recentlyUpdatedTickets?: StaffDashboardRecentTicket[];
}

interface StaffDashboardResponse {
  data?: StaffDashboardData;
  error?: { code?: string; message?: string } | string;
}

/** GET /api/dashboards/staff — IT Staff / Administrator operational metrics. */
export async function getStaffDashboard(): Promise<StaffDashboardData> {
  const res = await fetch(`${API_URL}/api/dashboards/staff`, {
    credentials: "include",
  });

  let body: StaffDashboardResponse | null = null;
  try {
    body = (await res.json()) as StaffDashboardResponse;
  } catch {
    body = null;
  }

  if (!res.ok) {
    const error = body?.error;
    const message =
      typeof error === "string"
        ? error
        : error?.message ?? "Failed to load the staff dashboard. Please try again.";
    throw new Error(message);
  }

  const data = body?.data ?? (body as unknown as StaffDashboardData | null);
  if (!data) throw new Error("Failed to load the staff dashboard. Please try again.");
  return data;
}
