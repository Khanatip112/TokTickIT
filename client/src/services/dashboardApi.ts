import type { StaffTicketStatus, TicketPriority } from "../api.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/**
 * Lab 4 — Requester Dashboard API client (Issue 6).
 *
 * Kept in an isolated service module so the shared `api.ts` surface stays
 * untouched. The browser session cookie is sent with `credentials: "include"`;
 * the backend derives ownership from that session (never from client input).
 */
export interface RequesterRecentTicket {
  id: string;
  ticketNumber: string;
  summary: string;
  currentStatus: StaffTicketStatus;
  requestedPriority: TicketPriority;
  itPriority: TicketPriority;
  category: { id: string; name: string } | null;
  assignedTo: { id: string; fullName: string } | null;
  updatedAt: string;
  createdAt: string;
}

export interface RequesterDashboardData {
  totalOpenTickets: number;
  inProgressCount: number;
  waitingForRequesterCount: number;
  recentlyResolvedCount: number;
  closedTicketsCount: number;
  recentlyUpdatedCount: number;
  /** Mission-facing aliases returned by the API. */
  ticketsWaitingForRequester?: number;
  recentlyResolvedTickets?: number;
  recentlyUpdatedTickets?: number;
  recentTickets: RequesterRecentTicket[];
}

interface RequesterDashboardResponse {
  data?: RequesterDashboardData;
  error?: { code?: string; message?: string } | string;
}

/** GET /api/dashboards/requester — authenticated, ownership-scoped metrics. */
export async function getRequesterDashboard(): Promise<RequesterDashboardData> {
  const res = await fetch(`${API_URL}/api/dashboards/requester`, {
    credentials: "include",
  });

  let body: RequesterDashboardResponse | null = null;
  try {
    body = (await res.json()) as RequesterDashboardResponse;
  } catch {
    body = null;
  }

  if (!res.ok) {
    const error = body?.error;
    const message =
      typeof error === "string"
        ? error
        : error?.message ?? "Failed to load your dashboard. Please try again.";
    throw new Error(message);
  }

  const data = body?.data ?? (body as unknown as RequesterDashboardData | null);
  if (!data) throw new Error("Failed to load your dashboard. Please try again.");
  return data;
}
