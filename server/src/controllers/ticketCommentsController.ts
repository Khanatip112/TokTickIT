import type { Request, Response } from "express";
import { getPrisma } from "../prisma.js";

/**
 * Public Comments & Internal Notes controllers (Issue 8).
 *
 * Security model (docs/lab-03/api-spec.md §3.3, specification.md §4.5):
 * - FR-20 / API-18: Public comments are readable/writable by the ticket owner
 *   (`REQUESTER`), `IT_STAFF`, and `ADMINISTRATOR`. A non-owner Requester gets
 *   `403 Forbidden` (IDOR protection) and a missing ticket gets `404`.
 * - FR-21 / API-09, API-19: Internal Notes are restricted to `IT_STAFF` and
 *   `ADMINISTRATOR`. The `403` for Requesters is enforced by `requireRole` at
 *   the route level, before this controller runs, so note existence or counts
 *   are never disclosed.
 * - BR-18 (Append-Only): only GET/POST handlers exist. No PATCH/DELETE routes
 *   are registered anywhere, so entries can never be edited or removed.
 * - BR-19 (Backend Attribution): `authorId` always comes from the authenticated
 *   session (`req.user`), never from the request body.
 * - BR-20 (Validation): content is trimmed to 1–2,000 characters; blank or
 *   oversized payloads are rejected with `400 Bad Request`.
 */

const MAX_CONTENT_LENGTH = 2000;

function errorPayload(code: string, message: string) {
  return { error: { code, message } };
}

function serverError(res: Response, scope: string, error: unknown) {
  console.error(`${scope} error:`, error);
  return res
    .status(500)
    .json(errorPayload("INTERNAL_SERVER_ERROR", "An unexpected error occurred."));
}

/** Author projection shared by comments and notes (api-spec §3.3 responses). */
const authorSelect = { id: true, fullName: true, role: true } as const;

function mapAuthor(author: { id: string; fullName: string; role: string }) {
  return { id: author.id, name: author.fullName, role: author.role };
}

function requireUser(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json(errorPayload("UNAUTHORIZED", "Authentication required. Please log in."));
    return null;
  }
  return req.user;
}

/**
 * Loads the parent ticket and enforces Public Comment access:
 * `404` when the ticket does not exist, `403` when an authenticated Requester
 * does not own it. Staff and Administrators may access any ticket.
 * Returns the ticket (or `null` after responding).
 */
async function loadTicketForCommentAccess(req: Request, res: Response) {
  const prisma = getPrisma();
  const user = requireUser(req, res);
  if (!user) return null;

  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    select: { id: true, requesterId: true },
  });
  if (!ticket) {
    res.status(404).json(errorPayload("NOT_FOUND", "Ticket not found"));
    return null;
  }
  if (user.role === "REQUESTER" && ticket.requesterId !== user.id) {
    res
      .status(403)
      .json(errorPayload("FORBIDDEN", "Forbidden: You do not own this ticket."));
    return null;
  }
  return ticket;
}

/**
 * Loads the parent ticket for Internal Note handlers. Ticket existence is
 * checked here; the Requester `403` already happened in `requireRole`.
 * Returns the ticket (or `null` after responding).
 */
async function loadTicketForStaffAccess(req: Request, res: Response) {
  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });
  if (!ticket) {
    res.status(404).json(errorPayload("NOT_FOUND", "Ticket not found"));
    return null;
  }
  return ticket;
}

/**
 * BR-20 validation shared by comments and notes. Responds `400` and returns
 * `null` when `content` is missing, blank, or longer than 2,000 characters.
 */
function readContent(req: Request, res: Response): string | null {
  const body = req.body ?? {};
  if (typeof body.content !== "string") {
    res.status(400).json(errorPayload("BAD_REQUEST", "Bad Request: content must be a string."));
    return null;
  }
  const content = body.content.trim();
  if (content.length === 0) {
    res
      .status(400)
      .json(errorPayload("BAD_REQUEST", "Bad Request: content must not be blank."));
    return null;
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    res.status(400).json(
      errorPayload(
        "BAD_REQUEST",
        `Bad Request: content must not exceed ${MAX_CONTENT_LENGTH} characters.`
      )
    );
    return null;
  }
  return content;
}

/**
 * GET /api/tickets/:id/comments
 * Public comment stream for the owner Requester, IT Staff, and Administrator
 * (api-spec §3.3.1). Ordered oldest-first; the UI renders it in reverse
 * chronological order.
 */
export async function listComments(req: Request, res: Response): Promise<Response> {
  try {
    const ticket = await loadTicketForCommentAccess(req, res);
    if (!ticket) return res;

    const comments = await getPrisma().comment.findMany({
      where: { ticketId: ticket.id },
      include: { author: { select: authorSelect } },
      orderBy: { createdAt: "asc" },
    });

    return res.status(200).json(
      comments.map((comment) => ({
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        author: mapAuthor(comment.author),
      }))
    );
  } catch (error) {
    return serverError(res, "GET /api/tickets/:id/comments", error);
  }
}

/**
 * POST /api/tickets/:id/comments
 * Appends a public comment authored by the authenticated user
 * (api-spec §3.3.2). `401`/`403`/`404`/`400` per the spec error table.
 */
export async function createComment(req: Request, res: Response): Promise<Response> {
  try {
    const user = requireUser(req, res);
    if (!user) return res;

    const ticket = await loadTicketForCommentAccess(req, res);
    if (!ticket) return res;

    const content = readContent(req, res);
    if (content === null) return res;

    const comment = await getPrisma().comment.create({
      data: { ticketId: ticket.id, authorId: user.id, content },
      include: { author: { select: authorSelect } },
    });

    return res.status(201).json({
      id: comment.id,
      ticketId: comment.ticketId,
      content: comment.content,
      createdAt: comment.createdAt,
      author: mapAuthor(comment.author),
    });
  } catch (error) {
    return serverError(res, "POST /api/tickets/:id/comments", error);
  }
}

/**
 * GET /api/tickets/:id/notes (alias: `/api/tickets/:id/internal-notes`)
 * Confidential internal note stream, restricted to `IT_STAFF` and
 * `ADMINISTRATOR` (api-spec §3.3.3). Requesters receive `403` from
 * `requireRole` before this handler executes.
 */
export async function listInternalNotes(req: Request, res: Response): Promise<Response> {
  try {
    const ticket = await loadTicketForStaffAccess(req, res);
    if (!ticket) return res;

    const notes = await getPrisma().internalNote.findMany({
      where: { ticketId: ticket.id },
      include: { author: { select: authorSelect } },
      orderBy: { createdAt: "asc" },
    });

    return res.status(200).json(
      notes.map((note) => ({
        id: note.id,
        content: note.content,
        createdAt: note.createdAt,
        author: mapAuthor(note.author),
      }))
    );
  } catch (error) {
    return serverError(res, "GET /api/tickets/:id/notes", error);
  }
}

/**
 * POST /api/tickets/:id/notes (alias: `/api/tickets/:id/internal-notes`)
 * Creates a confidential internal note (api-spec §3.3.4). Restricted to
 * `IT_STAFF` and `ADMINISTRATOR` at the route level.
 */
export async function createInternalNote(req: Request, res: Response): Promise<Response> {
  try {
    const user = requireUser(req, res);
    if (!user) return res;

    const ticket = await loadTicketForStaffAccess(req, res);
    if (!ticket) return res;

    const content = readContent(req, res);
    if (content === null) return res;

    const note = await getPrisma().internalNote.create({
      data: { ticketId: ticket.id, authorId: user.id, content },
      include: { author: { select: authorSelect } },
    });

    return res.status(201).json({
      id: note.id,
      ticketId: note.ticketId,
      content: note.content,
      createdAt: note.createdAt,
      author: mapAuthor(note.author),
    });
  } catch (error) {
    return serverError(res, "POST /api/tickets/:id/notes", error);
  }
}


