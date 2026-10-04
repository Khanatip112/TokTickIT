import { Router } from "express";
import { enforcePasswordChange, requireAuth, requireRole } from "../middleware/auth.js";
import {
  createComment,
  createInternalNote,
  listComments,
  listInternalNotes,
} from "../controllers/ticketCommentsController.js";

/**
 * Public Comments & Internal Notes routes (Issue 8).
 *
 * Mounted at `/api/tickets` (docs/lab-03/api-spec.md §3.3):
 * - `GET  /api/tickets/:id/comments` — owner Requester, IT Staff, Admin.
 * - `POST /api/tickets/:id/comments` — owner Requester, IT Staff, Admin.
 * - `GET  /api/tickets/:id/notes`     — IT Staff, Admin only (403 Requester).
 * - `POST /api/tickets/:id/notes`     — IT Staff, Admin only (403 Requester).
 *
 * `/internal-notes` is registered as an alias of `/notes` so the endpoint also
 * resolves under the descriptive path named in the Issue 8 task statement.
 * Both note routes apply `requireRole` FIRST so a Requester always receives
 * `403 Forbidden` without any information about the ticket or its notes.
 *
 * Append-only (BR-18): deliberately no PATCH/PUT/DELETE routes exist.
 */
export const commentsRouter = Router();

const staffOnly = requireRole("IT_STAFF", "ADMINISTRATOR");

// --- Public comments (FR-20 / AC-14) ---
commentsRouter.get("/:id/comments", requireAuth, enforcePasswordChange, listComments);
commentsRouter.post("/:id/comments", requireAuth, enforcePasswordChange, createComment);

// --- Internal notes (FR-21 / AC-15) — staff only ---
commentsRouter.get("/:id/notes", staffOnly, enforcePasswordChange, listInternalNotes);
commentsRouter.post("/:id/notes", staffOnly, enforcePasswordChange, createInternalNote);
commentsRouter.get("/:id/internal-notes", staffOnly, enforcePasswordChange, listInternalNotes);
commentsRouter.post("/:id/internal-notes", staffOnly, enforcePasswordChange, createInternalNote);

export default commentsRouter;
