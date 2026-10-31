import type { Request, Response } from "express";
import type { Prisma, TicketStatus } from "@prisma/client";
import { getPrisma } from "../prisma.js";

/**
 * Lab 4 — Requester Dashboard (Issue 6).
 *
 * Authoritative metrics are computed server-side (BR-11) and scoped strictly to
 * tickets owned by the authenticated user (BR-12 / AC-08). The authenticated
 * session id is the only accepted ownership source; callers cannot override it
 * with a query parameter or request body field.
 */
export const OPEN_TICKET_STATUSES: readonly TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "REOPENED",
];

/** Window used for the "recently updated" summary metric. */
export const RECENT_WINDOW_DAYS = 7;

/** Maximum number of tickets returned in the recent-tickets widget. */
export const RECENT_TICKETS_LIMIT = 5;

function errorPayload(code: string, message: string) {
  return { error: { code, message } };
}

function serverError(res: Response, scope: string, error: unknown) {
  console.error(`${scope} error:`, error);
  return res
    .status(500)
    .json(errorPayload("INTERNAL_SERVER_ERROR", "An unexpected error occurred."));
}

/**
 * GET /api/dashboards/requester
 *
 * Response contract (docs/lab-04/api-spec.md §3.3.1):
 * {
 *   data: {
 *     totalOpenTickets, inProgressCount, waitingForRequesterCount,
 *     recentlyResolvedCount, closedTicketsCount, recentTickets[]
 *   }
 * }
 *
 * Mission aliases (`ticketsWaitingForRequester`, `recentlyResolvedTickets`,
 * `recentlyUpdatedTickets`) are included for convenience but always mirror the
 * authoritative counts above.
 */
export async function getRequesterDashboard(req: Request, res: Response): Promise<Response> {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(errorPayload("UNAUTHORIZED", "Authentication required. Please log in."));
    }

    // Ownership guard: the session identity is authoritative.
    const requesterId = req.user.id;
    const prisma = getPrisma();
    const recentSince = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const owned: Prisma.TicketWhereInput = { requesterId };

    const [
      totalOpenTickets,
      inProgressCount,
      waitingForRequesterCount,
      recentlyResolvedCount,
      closedTicketsCount,
      recentlyUpdatedCount,
      recentTickets,
    ] = await Promise.all([
      prisma.ticket.count({
        where: { ...owned, currentStatus: { in: [...OPEN_TICKET_STATUSES] } },
      }),
      prisma.ticket.count({ where: { ...owned, currentStatus: "IN_PROGRESS" } }),
      prisma.ticket.count({ where: { ...owned, currentStatus: "WAITING_FOR_REQUESTER" } }),
      prisma.ticket.count({ where: { ...owned, currentStatus: "RESOLVED" } }),
      prisma.ticket.count({ where: { ...owned, currentStatus: "CLOSED" } }),
      prisma.ticket.count({ where: { ...owned, updatedAt: { gte: recentSince } } }),
      prisma.ticket.findMany({
        where: owned,
        orderBy: { updatedAt: "desc" },
        take: RECENT_TICKETS_LIMIT,
        select: {
          id: true,
          ticketNumber: true,
          summary: true,
          currentStatus: true,
          requestedPriority: true,
          itPriority: true,
          updatedAt: true,
          createdAt: true,
          category: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, fullName: true } },
        },
      }),
    ]);

    return res.status(200).json({
      data: {
        totalOpenTickets,
        inProgressCount,
        waitingForRequesterCount,
        recentlyResolvedCount,
        closedTicketsCount,
        recentlyUpdatedCount,
        // Mission-facing aliases (mirror the authoritative values).
        ticketsWaitingForRequester: waitingForRequesterCount,
        recentlyResolvedTickets: recentlyResolvedCount,
        recentlyUpdatedTickets: recentlyUpdatedCount,
        recentTickets,
      },
    });
  } catch (error) {
    return serverError(res, "GET /api/dashboards/requester", error);
  }
}
