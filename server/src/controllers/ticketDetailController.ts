import type { Request, Response } from "express";
import type { Priority, TicketStatus } from "@prisma/client";
import { getPrisma } from "../prisma.js";

const STATUSES: readonly TicketStatus[] = [
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
const PRIORITIES: readonly Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

/** Statuses that may receive a Requester "Problem Appears Resolved" indication (api-spec §3.4.3). */
const INDICATION_ACTIVE_STATUSES: readonly TicketStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
];

/** Statuses that require a resolution summary when entered (BR-17). */
const RESOLUTION_TARGETS: readonly TicketStatus[] = ["RESOLVED", "CLOSED"];

const MIN_RESOLUTION_LENGTH = 5;
const MAX_RESOLUTION_LENGTH = 1000;
const MAX_NOTE_LENGTH = 2000;

const RESOLUTION_INDICATION_TEXT =
  "Requester indicated that the problem appears resolved.";

/**
 * BR-15 (Status Transition Enforcement Matrix).
 * Any transition not listed for the current status must be rejected with
 * `422 Unprocessable Entity`. `PENDING` (legacy DB enum) has no permitted
 * transitions, and `CANCELLED` is terminal.
 */
export const STATUS_TRANSITIONS: Record<string, readonly TicketStatus[]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "OPEN", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "OPEN", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  REOPENED: ["IN_PROGRESS", "OPEN", "RESOLVED", "CANCELLED"],
  // Terminal state; reopening is Administrator-only (BR-15).
  CLOSED: ["REOPENED"],
  CANCELLED: [],
};

function errorPayload(code: string, message: string) {
  return { error: { code, message } };
}

function serverError(res: Response, scope: string, error: unknown) {
  console.error(`${scope} error:`, error);
  return res
    .status(500)
    .json(errorPayload("INTERNAL_SERVER_ERROR", "An unexpected error occurred."));
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function pickStatus(value: unknown): TicketStatus | undefined {
  const candidate = asString(value);
  return candidate && (STATUSES as readonly string[]).includes(candidate)
    ? (candidate as TicketStatus)
    : undefined;
}

function pickPriority(value: unknown): Priority | undefined {
  const candidate = asString(value);
  return candidate && (PRIORITIES as readonly string[]).includes(candidate)
    ? (candidate as Priority)
    : undefined;
}

function isOwnerRole(role: string | undefined): boolean {
  return role === "IT_STAFF" || role === "ADMINISTRATOR";
}

/**
 * Targets reachable from `current` for `role`, applying the BR-15 role rule
 * (reopening a CLOSED ticket is restricted to Administrators).
 */
function permittedTargets(current: TicketStatus, role: string | undefined): TicketStatus[] {
  const targets = STATUS_TRANSITIONS[current] ?? [];
  return targets.filter(
    (target) => !(current === "CLOSED" && target === "REOPENED") || role === "ADMINISTRATOR"
  );
}

const requesterSelect = {
  select: { id: true, fullName: true, email: true, department: true },
} as const;
const ownerSelect = { select: { id: true, fullName: true, email: true } } as const;

/**
 * GET /api/staff/tickets/:id
 * Full operational detail for one ticket (docs/lab-03/api-spec.md §3.2.2),
 * enriched with `permittedTransitions` for the requesting role so the UI can
 * render the status dropdown straight from the server-side BR-15 matrix.
 */
export async function getStaffTicketDetail(req: Request, res: Response): Promise<Response> {
  try {
    const ticket = await getPrisma().ticket.findUnique({
      where: { id: req.params.id },
      include: {
        requester: requesterSelect,
        assignedTo: ownerSelect,
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true, code: true } },
        attachments: { orderBy: { createdAt: "asc" } },
        _count: {
          select: {
            comments: true,
            internalNotes: true,
            attachments: { where: { isRemoved: false } },
          },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json(errorPayload("NOT_FOUND", "Ticket not found"));
    }

    return res.status(200).json({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      summary: ticket.summary,
      description: ticket.description,
      requestedPriority: ticket.requestedPriority,
      itPriority: ticket.itPriority,
      currentStatus: ticket.currentStatus,
      resolutionSummary: ticket.resolutionSummary,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      requester: {
        id: ticket.requester.id,
        name: ticket.requester.fullName,
        email: ticket.requester.email,
        department: ticket.requester.department,
      },
      ownerId: ticket.assignedTo?.id ?? null,
      owner: ticket.assignedTo
        ? { id: ticket.assignedTo.id, name: ticket.assignedTo.fullName, email: ticket.assignedTo.email }
        : null,
      category: ticket.category,
      relatedSystem: ticket.relatedSystem,
      attachments: ticket.attachments,
      activeAttachmentsCount: ticket._count.attachments,
      publicCommentsCount: ticket._count.comments,
      internalNotesCount: ticket._count.internalNotes,
      permittedTransitions: permittedTargets(ticket.currentStatus, req.user?.role),
    });
  } catch (error) {
    return serverError(res, "GET /api/staff/tickets/:id", error);
  }
}

/**
 * PATCH /api/staff/tickets/:id/claim
 * "Assign to Me" — sets `assignedToId` to the authenticated staff user and
 * auto-moves a `NEW` ticket to `OPEN` (BR-15 matrix note / BR-14).
 */
export async function claimTicket(req: Request, res: Response): Promise<Response> {
  try {
    const prisma = getPrisma();
    const { id } = req.params;

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return res.status(404).json(errorPayload("NOT_FOUND", "Ticket not found"));
    }

    const staffId = req.user!.id;
    const nextStatus = ticket.currentStatus === "NEW" ? "OPEN" : ticket.currentStatus;

    const updated = await prisma.ticket.update({
      where: { id },
      data: {
        assignedToId: staffId,
        ...(nextStatus !== ticket.currentStatus ? { currentStatus: nextStatus } : {}),
      },
      include: { assignedTo: ownerSelect },
    });

    return res.status(200).json({
      id: updated.id,
      ownerId: updated.assignedToId,
      assignedToId: updated.assignedToId,
      currentStatus: updated.currentStatus,
      updatedAt: updated.updatedAt,
      owner: updated.assignedTo
        ? {
            id: updated.assignedTo.id,
            name: updated.assignedTo.fullName,
            email: updated.assignedTo.email,
          }
        : null,
    });
  } catch (error) {
    return serverError(res, "PATCH /api/staff/tickets/:id/claim", error);
  }
}

/**
 * PATCH /api/staff/tickets/:id/assign
 * Reassigns the ticket owner. `ownerId: null` unassigns (returns the ticket to
 * the pool, BR-13). A non-staff or inactive target user is rejected (BR-11).
 * Assigning an owner to a `NEW` ticket moves it to `OPEN` (BR-14).
 */
export async function assignTicket(req: Request, res: Response): Promise<Response> {
  try {
    const prisma = getPrisma();
    const { id } = req.params;
    const body = req.body ?? {};

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return res.status(404).json(errorPayload("NOT_FOUND", "Ticket not found"));
    }

    if (!("ownerId" in body)) {
      return res
        .status(400)
        .json(errorPayload("BAD_REQUEST", "Bad Request: ownerId is required (use null to unassign)."));
    }

    const ownerId: string | null =
      body.ownerId === "" || body.ownerId === null ? null : body.ownerId;

    if (ownerId !== null) {
      if (typeof ownerId !== "string") {
        return res
          .status(400)
          .json(errorPayload("BAD_REQUEST", "Bad Request: ownerId must be a user id or null."));
      }
      const target = await prisma.user.findUnique({ where: { id: ownerId } });
      if (!target || !target.isActive || !isOwnerRole(target.role)) {
        return res.status(400).json(
          errorPayload(
            "BAD_REQUEST",
            "Bad Request: ownerId must reference an active IT Staff or Administrator user."
          )
        );
      }
    }

    const nextStatus = ownerId && ticket.currentStatus === "NEW" ? "OPEN" : ticket.currentStatus;

    const updated = await prisma.ticket.update({
      where: { id },
      data: {
        assignedToId: ownerId,
        ...(nextStatus !== ticket.currentStatus ? { currentStatus: nextStatus } : {}),
      },
      include: { assignedTo: ownerSelect },
    });

    return res.status(200).json({
      id: updated.id,
      ownerId: updated.assignedToId,
      owner: updated.assignedTo
        ? {
            id: updated.assignedTo.id,
            name: updated.assignedTo.fullName,
            email: updated.assignedTo.email,
          }
        : null,
      currentStatus: updated.currentStatus,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    return serverError(res, "PATCH /api/staff/tickets/:id/assign", error);
  }
}

/**
 * PATCH /api/staff/tickets/:id/priority (alias: `/it-priority`)
 * Updates `itPriority` only — `requestedPriority` is immutable (BR-12).
 */
export async function updateItPriority(req: Request, res: Response): Promise<Response> {
  try {
    const prisma = getPrisma();
    const { id } = req.params;
    const body = req.body ?? {};

    const priority = pickPriority(body.itPriority ?? body.priority);
    if (!priority) {
      return res.status(400).json(
        errorPayload(
          "BAD_REQUEST",
          "Bad Request: itPriority must be one of LOW, MEDIUM, HIGH, URGENT."
        )
      );
    }

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return res.status(404).json(errorPayload("NOT_FOUND", "Ticket not found"));
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: { itPriority: priority },
    });

    return res.status(200).json({
      id: updated.id,
      requestedPriority: updated.requestedPriority,
      itPriority: updated.itPriority,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    return serverError(res, "PATCH /api/staff/tickets/:id/priority", error);
  }
}

/**
 * PATCH /api/staff/tickets/:id/status
 * Advances the ticket through the BR-15 lifecycle matrix. The target status is
 * accepted as `currentStatus` (api-spec §3.2.6) with `status` / `targetStatus`
 * aliases. Entering `RESOLVED` or `CLOSED` requires a 5–1,000 character
 * `resolutionSummary` (BR-17). Reopening a CLOSED ticket is Administrator-only.
 */
export async function updateTicketStatus(req: Request, res: Response): Promise<Response> {
  try {
    const prisma = getPrisma();
    const { id } = req.params;
    const body = req.body ?? {};

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return res.status(404).json(errorPayload("NOT_FOUND", "Ticket not found"));
    }

    const target = pickStatus(body.currentStatus ?? body.status ?? body.targetStatus);
    if (!target) {
      return res.status(400).json(
        errorPayload("BAD_REQUEST", "Bad Request: currentStatus must be a valid ticket status.")
      );
    }

    const current = ticket.currentStatus;
    const allowed = STATUS_TRANSITIONS[current] ?? [];
    if (target === current || !allowed.includes(target)) {
      return res.status(422).json(
        errorPayload(
          "UNPROCESSABLE_ENTITY",
          `Status transition from ${current} to ${target} is not permitted.`
        )
      );
    }

    if (current === "CLOSED" && target === "REOPENED" && req.user?.role !== "ADMINISTRATOR") {
      return res
        .status(403)
        .json(errorPayload("FORBIDDEN", "Only Administrators may reopen a closed ticket."));
    }

    let resolutionSummary = ticket.resolutionSummary;
    if (RESOLUTION_TARGETS.includes(target)) {
      const summary = asString(body.resolutionSummary) ?? "";
      if (summary.length < MIN_RESOLUTION_LENGTH) {
        return res.status(400).json(
          errorPayload(
            "BAD_REQUEST",
            `Bad Request: resolutionSummary (minimum ${MIN_RESOLUTION_LENGTH} characters) is required when resolving or closing a ticket.`
          )
        );
      }
      if (summary.length > MAX_RESOLUTION_LENGTH) {
        return res.status(400).json(
          errorPayload(
            "BAD_REQUEST",
            `Bad Request: resolutionSummary must not exceed ${MAX_RESOLUTION_LENGTH} characters.`
          )
        );
      }
      resolutionSummary = summary;
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: { currentStatus: target, resolutionSummary },
    });

    return res.status(200).json({
      id: updated.id,
      currentStatus: updated.currentStatus,
      resolutionSummary: updated.resolutionSummary,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    return serverError(res, "PATCH /api/staff/tickets/:id/status", error);
  }
}

/**
 * POST /api/tickets/:id/resolve-indication
 * Requester "Problem Appears Resolved" action (api-spec §3.4.3, BR-16 / FR-12).
 * Verifies ownership and an active status, then records an automated Public
 * Comment. The formal ticket status is intentionally left unchanged.
 */
export async function resolveIndication(req: Request, res: Response): Promise<Response> {
  try {
    const prisma = getPrisma();
    const { id } = req.params;
    const user = req.user;

    if (!user) {
      return res
        .status(401)
        .json(errorPayload("UNAUTHORIZED", "Authentication required. Please log in."));
    }
    if (user.role !== "REQUESTER") {
      return res.status(403).json(
        errorPayload(
          "FORBIDDEN",
          "Only the ticket Requester can indicate that the problem appears resolved."
        )
      );
    }

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return res.status(404).json(errorPayload("NOT_FOUND", "Ticket not found"));
    }
    if (ticket.requesterId !== user.id) {
      return res
        .status(403)
        .json(errorPayload("FORBIDDEN", "Forbidden: You do not own this ticket."));
    }
    if (!INDICATION_ACTIVE_STATUSES.includes(ticket.currentStatus)) {
      return res.status(422).json(
        errorPayload(
          "UNPROCESSABLE_ENTITY",
          `A resolution indication cannot be recorded for a ticket with status ${ticket.currentStatus}.`
        )
      );
    }

    const body = req.body ?? {};
    if (body.note !== undefined && body.note !== null && typeof body.note !== "string") {
      return res
        .status(400)
        .json(errorPayload("BAD_REQUEST", "Bad Request: note must be a string."));
    }
    const note = asString(body.note) ?? "";
    if (note.length > MAX_NOTE_LENGTH) {
      return res
        .status(400)
        .json(errorPayload("BAD_REQUEST", `Bad Request: note must not exceed ${MAX_NOTE_LENGTH} characters.`));
    }

    const content = note ? `${RESOLUTION_INDICATION_TEXT} ${note}` : RESOLUTION_INDICATION_TEXT;

    await prisma.comment.create({
      data: { ticketId: ticket.id, authorId: user.id, content },
    });

    return res.status(200).json({
      message: "Resolution indication recorded successfully",
      ticketId: ticket.id,
    });
  } catch (error) {
    return serverError(res, "POST /api/tickets/:id/resolve-indication", error);
  }
}




