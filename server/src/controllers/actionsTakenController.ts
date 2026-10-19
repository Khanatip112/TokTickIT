import type { Request, Response } from "express";
import { getPrisma } from "../prisma.js";

/**
 * Valid action results per Lab 4 specification (docs/lab-04/api-spec.md §3.1).
 */
export const VALID_ACTION_RESULTS = ["SUCCESS", "PARTIAL", "PENDING", "FAILED"] as const;
export type ActionResultType = (typeof VALID_ACTION_RESULTS)[number];

function errorPayload(
  code: string,
  message: string,
  details?: Array<{ field: string; message: string }>
) {
  return {
    error: {
      code,
      message,
      ...(details && details.length > 0 ? { details } : {}),
    },
  };
}

function serverError(res: Response, scope: string, error: unknown) {
  console.error(`${scope} error:`, error);
  return res
    .status(500)
    .json(errorPayload("INTERNAL_SERVER_ERROR", "An unexpected error occurred."));
}

/**
 * GET /api/tickets/:id/actions-taken
 *
 * Retrieves all Actions Taken for a specific ticket, ordered chronologically by actionDateTime ASC.
 * - Access: IT_STAFF, ADMINISTRATOR, and the REQUESTER who owns the ticket.
 * - Requesters attempting to view another's ticket receive 403 Forbidden.
 */
export async function listActionsTaken(req: Request, res: Response): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json(errorPayload("UNAUTHORIZED", "Authentication required. Please log in."));
    }

    const ticketId = req.params.id;
    const prisma = getPrisma();

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, requesterId: true },
    });

    if (!ticket) {
      return res.status(404).json(errorPayload("NOT_FOUND", "Ticket not found."));
    }

    if (req.user.role === "REQUESTER" && ticket.requesterId !== req.user.id) {
      return res.status(403).json(errorPayload("FORBIDDEN", "Forbidden: You do not own this ticket."));
    }

    const actions = await prisma.actionTaken.findMany({
      where: { ticketId },
      orderBy: { actionDateTime: "asc" },
      include: {
        performedBy: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    return res.status(200).json({
      data: actions.map((a) => ({
        id: a.id,
        ticketId: a.ticketId,
        actionDateTime: a.actionDateTime,
        description: a.description,
        result: a.result,
        performedBy: {
          id: a.performedBy.id,
          fullName: a.performedBy.fullName,
          role: a.performedBy.role,
        },
        followUpRequired: a.followUpRequired,
        followUpNote: a.followUpNote,
        attachmentNotes: a.attachmentNotes,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
      meta: {
        total: actions.length,
        ticketId,
      },
    });
  } catch (error) {
    return serverError(res, "GET /api/tickets/:id/actions-taken", error);
  }
}

/**
 * POST /api/tickets/:id/actions-taken
 *
 * Creates a new Action Taken record for the specified ticket.
 * - Access: Restricted to IT_STAFF and ADMINISTRATOR roles only (403 for Requesters).
 * - performedById is automatically derived from the session user (req.user.id).
 * - Validation:
 *   - description: 1-1,000 chars required.
 *   - result: One of SUCCESS, PARTIAL, PENDING, FAILED.
 *   - followUpNote: Mandatory (1-1,000 chars) if followUpRequired is true.
 *   - attachmentNotes: Optional, max 500 chars.
 *   - actionDateTime: Optional ISO string, cannot be in the future.
 */
export async function createActionTaken(req: Request, res: Response): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json(errorPayload("UNAUTHORIZED", "Authentication required. Please log in."));
    }

    if (req.user.role !== "IT_STAFF" && req.user.role !== "ADMINISTRATOR") {
      return res.status(403).json(
        errorPayload("FORBIDDEN", "Access denied. Only IT Staff and Administrators may record Actions Taken.")
      );
    }

    const ticketId = req.params.id;
    const prisma = getPrisma();

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });

    if (!ticket) {
      return res.status(404).json(errorPayload("NOT_FOUND", "Ticket not found."));
    }

    // Validate description
    if (typeof req.body.description !== "string" || req.body.description.trim().length === 0) {
      return res.status(400).json(
        errorPayload("BAD_REQUEST", "Description is required and must be between 1 and 1000 characters.", [
          { field: "description", message: "Description is required and must be between 1 and 1000 characters." },
        ])
      );
    }
    const description = req.body.description.trim();
    if (description.length > 1000) {
      return res.status(400).json(
        errorPayload("BAD_REQUEST", "Description cannot exceed 1000 characters.", [
          { field: "description", message: "Description cannot exceed 1000 characters." },
        ])
      );
    }

    // Validate result
    if (!req.body.result || !VALID_ACTION_RESULTS.includes(req.body.result)) {
      return res.status(400).json(
        errorPayload("BAD_REQUEST", "Result must be one of: SUCCESS, PARTIAL, PENDING, FAILED.", [
          { field: "result", message: "Result must be one of: SUCCESS, PARTIAL, PENDING, FAILED." },
        ])
      );
    }
    const result = req.body.result as ActionResultType;

    // Validate followUpRequired & followUpNote
    const followUpRequired = Boolean(req.body.followUpRequired);
    let followUpNote: string | null = null;

    if (followUpRequired) {
      const note = typeof req.body.followUpNote === "string" ? req.body.followUpNote.trim() : "";
      if (note.length === 0) {
        return res.status(400).json(
          errorPayload("BAD_REQUEST", "Follow-up note is required when follow-up is requested.", [
            { field: "followUpNote", message: "Follow-up note is required when follow-up is requested." },
          ])
        );
      }
      if (note.length > 1000) {
        return res.status(400).json(
          errorPayload("BAD_REQUEST", "Follow-up note cannot exceed 1000 characters.", [
            { field: "followUpNote", message: "Follow-up note cannot exceed 1000 characters." },
          ])
        );
      }
      followUpNote = note;
    }

    // Validate attachmentNotes
    let attachmentNotes: string | null = null;
    if (req.body.attachmentNotes !== undefined && req.body.attachmentNotes !== null) {
      if (typeof req.body.attachmentNotes !== "string") {
        return res.status(400).json(
          errorPayload("BAD_REQUEST", "Attachment notes must be a string.", [
            { field: "attachmentNotes", message: "Attachment notes must be a string." },
          ])
        );
      }
      const trimmed = req.body.attachmentNotes.trim();
      if (trimmed.length > 500) {
        return res.status(400).json(
          errorPayload("BAD_REQUEST", "Attachment notes must not exceed 500 characters.", [
            { field: "attachmentNotes", message: "Attachment notes must not exceed 500 characters." },
          ])
        );
      }
      attachmentNotes = trimmed.length > 0 ? trimmed : null;
    }

    // Validate actionDateTime
    let actionDateTime = new Date();
    if (req.body.actionDateTime) {
      const parsed = new Date(req.body.actionDateTime);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json(
          errorPayload("BAD_REQUEST", "Invalid action date time.", [
            { field: "actionDateTime", message: "Invalid action date time." },
          ])
        );
      }
      // Clock skew tolerance of 60 seconds
      if (parsed.getTime() > Date.now() + 60_000) {
        return res.status(400).json(
          errorPayload("BAD_REQUEST", "Action date/time cannot be in the future.", [
            { field: "actionDateTime", message: "Action date/time cannot be in the future." },
          ])
        );
      }
      actionDateTime = parsed;
    }

    // Auto-derive performedById from session user (ignoring any client-supplied body)
    const performedById = req.user.id;

    const action = await prisma.actionTaken.create({
      data: {
        ticketId: ticket.id,
        actionDateTime,
        description,
        result,
        performedById,
        followUpRequired,
        followUpNote,
        attachmentNotes,
      },
      include: {
        performedBy: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    return res.status(201).json({
      data: {
        id: action.id,
        ticketId: action.ticketId,
        actionDateTime: action.actionDateTime,
        description: action.description,
        result: action.result,
        performedBy: {
          id: action.performedBy.id,
          fullName: action.performedBy.fullName,
          role: action.performedBy.role,
        },
        followUpRequired: action.followUpRequired,
        followUpNote: action.followUpNote,
        attachmentNotes: action.attachmentNotes,
        createdAt: action.createdAt,
        updatedAt: action.updatedAt,
      },
    });
  } catch (error) {
    return serverError(res, "POST /api/tickets/:id/actions-taken", error);
  }
}

/**
 * PUT /api/actions-taken/:actionId
 *
 * Updates an existing Action Taken record.
 * - Access: Restricted to IT_STAFF (if original performer) and ADMINISTRATOR.
 * - performedById is immutable.
 */
export async function updateActionTaken(req: Request, res: Response): Promise<Response | void> {
  try {
    if (!req.user) {
      return res.status(401).json(errorPayload("UNAUTHORIZED", "Authentication required. Please log in."));
    }

    if (req.user.role !== "IT_STAFF" && req.user.role !== "ADMINISTRATOR") {
      return res.status(403).json(
        errorPayload("FORBIDDEN", "Access denied. Only IT Staff and Administrators may update Actions Taken.")
      );
    }

    const actionId = req.params.actionId;
    const prisma = getPrisma();

    const existing = await prisma.actionTaken.findUnique({
      where: { id: actionId },
      include: {
        performedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    if (!existing) {
      return res.status(404).json(errorPayload("NOT_FOUND", "Action taken record not found."));
    }

    // Role check: Only original performer or Administrator may update
    if (req.user.role !== "ADMINISTRATOR" && existing.performedById !== req.user.id) {
      return res.status(403).json(
        errorPayload("FORBIDDEN", "Forbidden: You can only edit your own actions taken.")
      );
    }

    // Validate description if provided
    let description = existing.description;
    if (req.body.description !== undefined) {
      if (typeof req.body.description !== "string" || req.body.description.trim().length === 0) {
        return res.status(400).json(
          errorPayload("BAD_REQUEST", "Description is required and must be between 1 and 1000 characters.", [
            { field: "description", message: "Description is required and must be between 1 and 1000 characters." },
          ])
        );
      }
      description = req.body.description.trim();
      if (description.length > 1000) {
        return res.status(400).json(
          errorPayload("BAD_REQUEST", "Description cannot exceed 1000 characters.", [
            { field: "description", message: "Description cannot exceed 1000 characters." },
          ])
        );
      }
    }

    // Validate result if provided
    let result = existing.result;
    if (req.body.result !== undefined) {
      if (!VALID_ACTION_RESULTS.includes(req.body.result)) {
        return res.status(400).json(
          errorPayload("BAD_REQUEST", "Result must be one of: SUCCESS, PARTIAL, PENDING, FAILED.", [
            { field: "result", message: "Result must be one of: SUCCESS, PARTIAL, PENDING, FAILED." },
          ])
        );
      }
      result = req.body.result;
    }

    // Validate followUpRequired & followUpNote
    const effectiveFollowUpRequired =
      req.body.followUpRequired !== undefined
        ? Boolean(req.body.followUpRequired)
        : existing.followUpRequired;

    let followUpNote: string | null = null;
    if (effectiveFollowUpRequired) {
      const candidateNote =
        req.body.followUpNote !== undefined ? req.body.followUpNote : existing.followUpNote;
      const note = typeof candidateNote === "string" ? candidateNote.trim() : "";
      if (note.length === 0) {
        return res.status(400).json(
          errorPayload("BAD_REQUEST", "Follow-up note is required when follow-up is requested.", [
            { field: "followUpNote", message: "Follow-up note is required when follow-up is requested." },
          ])
        );
      }
      if (note.length > 1000) {
        return res.status(400).json(
          errorPayload("BAD_REQUEST", "Follow-up note cannot exceed 1000 characters.", [
            { field: "followUpNote", message: "Follow-up note cannot exceed 1000 characters." },
          ])
        );
      }
      followUpNote = note;
    } else {
      followUpNote = null;
    }

    // Validate attachmentNotes if provided
    let attachmentNotes = existing.attachmentNotes;
    if (req.body.attachmentNotes !== undefined) {
      if (req.body.attachmentNotes === null) {
        attachmentNotes = null;
      } else if (typeof req.body.attachmentNotes === "string") {
        const trimmed = req.body.attachmentNotes.trim();
        if (trimmed.length > 500) {
          return res.status(400).json(
            errorPayload("BAD_REQUEST", "Attachment notes must not exceed 500 characters.", [
              { field: "attachmentNotes", message: "Attachment notes must not exceed 500 characters." },
            ])
          );
        }
        attachmentNotes = trimmed.length > 0 ? trimmed : null;
      } else {
        return res.status(400).json(
          errorPayload("BAD_REQUEST", "Attachment notes must be a string.", [
            { field: "attachmentNotes", message: "Attachment notes must be a string." },
          ])
        );
      }
    }

    // Validate actionDateTime if provided
    let actionDateTime = existing.actionDateTime;
    if (req.body.actionDateTime !== undefined) {
      const parsed = new Date(req.body.actionDateTime);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json(
          errorPayload("BAD_REQUEST", "Invalid action date time.", [
            { field: "actionDateTime", message: "Invalid action date time." },
          ])
        );
      }
      if (parsed.getTime() > Date.now() + 60_000) {
        return res.status(400).json(
          errorPayload("BAD_REQUEST", "Action date/time cannot be in the future.", [
            { field: "actionDateTime", message: "Action date/time cannot be in the future." },
          ])
        );
      }
      actionDateTime = parsed;
    }

    const updated = await prisma.actionTaken.update({
      where: { id: actionId },
      data: {
        description,
        result,
        followUpRequired: effectiveFollowUpRequired,
        followUpNote,
        attachmentNotes,
        actionDateTime,
      },
      include: {
        performedBy: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    return res.status(200).json({
      data: {
        id: updated.id,
        ticketId: updated.ticketId,
        actionDateTime: updated.actionDateTime,
        description: updated.description,
        result: updated.result,
        performedBy: {
          id: updated.performedBy.id,
          fullName: updated.performedBy.fullName,
          role: updated.performedBy.role,
        },
        followUpRequired: updated.followUpRequired,
        followUpNote: updated.followUpNote,
        attachmentNotes: updated.attachmentNotes,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    return serverError(res, "PUT /api/actions-taken/:actionId", error);
  }
}
