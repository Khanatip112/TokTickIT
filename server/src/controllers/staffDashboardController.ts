import type { Request, Response } from "express";
import type { Priority, TicketStatus } from "@prisma/client";
import { getPrisma } from "../prisma.js";

/**
 * Lab 4 — IT Staff & Administrator Dashboard (Issue 7).
 *
 * Authoritative operational metrics are computed server-side
 * (docs/lab-04/api-spec.md §3.3.2). The session identity is the only source for
 * the "assigned to me" metric; no client-supplied user id is honoured.
 */

/** Unassigned tickets that still need an owner. */
export const STAFF_UNASSIGNED_STATUSES: readonly TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "REOPENED",
];

/** Active statuses counted toward "assigned to me". */
export const STAFF_ASSIGNED_STATUSES: readonly TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "REOPENED",
];

/** Statuses excluded from the "urgent priority" metric. */
export const STAFF_INACTIVE_STATUSES: readonly TicketStatus[] = [
  "RESOLVED",
  "CLOSED",
  "CANCELLED",
];

/** Stable key set for the status breakdown widget. */
export const STAFF_STATUS_KEYS: readonly TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "PENDING",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];

/** Stable key set for the IT priority breakdown widget. */
export const STAFF_PRIORITY_KEYS: readonly Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

/** Maximum number of tickets returned in the recent-tickets widget. */
export const STAFF_RECENT_TICKETS_LIMIT = 5;

function errorPayload(code: string, message: string) {
  return { error: { code, message } };
}

function serverError(res: Response, scope: string, error: unknown) {
  console.error(`${scope} error:`, error);
  return res
    .status(500)
    .json(errorPayload("INTERNAL_SERVER_ERROR", "An unexpected error occurred."));
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function emptyStatusBreakdown(): Record<TicketStatus, number> {
  return STAFF_STATUS_KEYS.reduce(
    (acc, status) => {
      acc[status] = 0;
      return acc;
    },
    {} as Record<TicketStatus, number>
  );
}

function emptyPriorityBreakdown(): Record<Priority, number> {
  return STAFF_PRIORITY_KEYS.reduce(
    (acc, priority) => {
      acc[priority] = 0;
      return acc;
    },
    {} as Record<Priority, number>
  );
}

/**
 * GET /api/dashboards/staff
 *
 * Response contract (docs/lab-04/api-spec.md §3.3.2):
 * {
 *   data: {
 *     unassignedCount, assignedToMeCount, inProgressCount,
 *     waitingRequesterCount, urgentPriorityCount, resolvedTodayCount,
 *     statusBreakdown, priorityBreakdown, recentTickets[],
 *     userSummary (ADMIN only), userAccountStats (ADMIN only)
 *   }
 * }
 *
 * Mission-facing aliases (`unassignedTicketsCount`, `myAssignedTicketsCount`,
 * `waitingForRequesterCount`, `itPriorityBreakdown`, `recentlyUpdatedTickets`)
 * mirror the authoritative values above.
 */
export async function getStaffDashboard(req: Request, res: Response): Promise<Response> {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json(errorPayload("UNAUTHORIZED", "Authentication required. Please log in."));
    }

    const prisma = getPrisma();
    const userId = req.user.id;
    const isAdministrator = req.user.role === "ADMINISTRATOR";
    const today = startOfToday();

    const [
      unassignedCount,
      assignedToMeCount,
      inProgressCount,
      waitingRequesterCount,
      urgentPriorityCount,
      resolvedTodayCount,
      statusGroups,
      priorityGroups,
      recentTickets,
    ] = await Promise.all([
      prisma.ticket.count({
        where: {
          assignedToId: null,
          currentStatus: { in: [...STAFF_UNASSIGNED_STATUSES] },
        },
      }),
      prisma.ticket.count({
        where: {
          assignedToId: userId,
          currentStatus: { in: [...STAFF_ASSIGNED_STATUSES] },
        },
      }),
      prisma.ticket.count({ where: { currentStatus: "IN_PROGRESS" } }),
      prisma.ticket.count({ where: { currentStatus: "WAITING_FOR_REQUESTER" } }),
      prisma.ticket.count({
        where: {
          itPriority: "URGENT",
          currentStatus: { notIn: [...STAFF_INACTIVE_STATUSES] },
        },
      }),
      prisma.ticket.count({
        where: { currentStatus: "RESOLVED", updatedAt: { gte: today } },
      }),
      prisma.ticket.groupBy({ by: ["currentStatus"], _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ["itPriority"], _count: { _all: true } }),
      prisma.ticket.findMany({
        orderBy: [{ itPriority: "desc" }, { updatedAt: "desc" }],
        take: STAFF_RECENT_TICKETS_LIMIT,
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
          requester: { select: { id: true, fullName: true } },
          assignedTo: { select: { id: true, fullName: true } },
        },
      }),
    ]);

    // Mission-facing field aliases for the recent-ticket widgets.
    const recentTicketRows = recentTickets.map((ticket) => ({
      ...ticket,
      title: ticket.summary,
      status: ticket.currentStatus,
      priority: ticket.itPriority,
    }));

    const statusBreakdown = emptyStatusBreakdown();
    for (const group of statusGroups) {
      statusBreakdown[group.currentStatus] = group._count._all;
    }

    const priorityBreakdown = emptyPriorityBreakdown();
    for (const group of priorityGroups) {
      priorityBreakdown[group.itPriority] = group._count._all;
    }

    // Administrator-only account statistics.
    let userSummary: {
      activeRequestersCount: number;
      activeStaffCount: number;
      totalUsersCount: number;
    } | null = null;
    let userAccountStats: {
      totalUsersCount: number;
      activeUsersCount: number;
      inactiveUsersCount: number;
      byRole: { REQUESTER: number; IT_STAFF: number; ADMINISTRATOR: number };
    } | null = null;

    if (isAdministrator) {
      const [totalUsersCount, activeUsersCount, activeRequestersCount, activeStaffCount, roleGroups] =
        await Promise.all([
          prisma.user.count(),
          prisma.user.count({ where: { isActive: true } }),
          prisma.user.count({ where: { role: "REQUESTER", isActive: true } }),
          prisma.user.count({ where: { role: "IT_STAFF", isActive: true } }),
          prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
        ]);

      const byRole = { REQUESTER: 0, IT_STAFF: 0, ADMINISTRATOR: 0 };
      for (const group of roleGroups) {
        byRole[group.role] = group._count._all;
      }

      userSummary = { activeRequestersCount, activeStaffCount, totalUsersCount };
      userAccountStats = {
        totalUsersCount,
        activeUsersCount,
        inactiveUsersCount: totalUsersCount - activeUsersCount,
        byRole,
      };
    }

    return res.status(200).json({
      data: {
        unassignedCount,
        assignedToMeCount,
        inProgressCount,
        waitingRequesterCount,
        urgentPriorityCount,
        resolvedTodayCount,
        statusBreakdown,
        priorityBreakdown,
        recentTickets: recentTicketRows,
        userSummary,
        userAccountStats,
        // Mission-facing aliases (mirror the authoritative values).
        unassignedTicketsCount: unassignedCount,
        myAssignedTicketsCount: assignedToMeCount,
        waitingForRequesterCount: waitingRequesterCount,
        itPriorityBreakdown: priorityBreakdown,
        recentlyUpdatedTickets: recentTicketRows,
      },
    });
  } catch (error) {
    return serverError(res, "GET /api/dashboards/staff", error);
  }
}
