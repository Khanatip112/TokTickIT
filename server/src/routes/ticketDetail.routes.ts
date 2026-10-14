import { Router } from "express";
import { enforcePasswordChange, requireAuth, requireRole } from "../middleware/auth.js";
import {
  assignTicket,
  claimTicket,
  resolveIndication,
  updateItPriority,
  updateTicketStatus,
} from "../controllers/ticketDetailController.js";

/**
 * Ticket detail operation routes (Issue 7).
 *
 * Mounted at `/api/tickets` so the issue endpoints
 * (`/:id/claim`, `/:id/assign`, `/:id/it-priority`, `/:id/status`,
 * `/:id/resolve-indication`) are reachable alongside the canonical
 * `/api/staff/tickets/:id/...` paths (docs/lab-03/api-spec.md §3.2).
 *
 * The staff operations are RBAC-guarded to `IT_STAFF` + `ADMINISTRATOR`;
 * the requester "Problem Appears Resolved" action only requires an
 * authenticated session (ownership + role are enforced in the controller).
 */
export const ticketDetailRouter = Router();

const staffOnly = requireRole("IT_STAFF", "ADMINISTRATOR");

ticketDetailRouter.post(
  "/:id/resolve-indication",
  requireAuth,
  enforcePasswordChange,
  resolveIndication
);

ticketDetailRouter.patch("/:id/claim", staffOnly, enforcePasswordChange, claimTicket);
ticketDetailRouter.patch("/:id/assign", staffOnly, enforcePasswordChange, assignTicket);
ticketDetailRouter.patch("/:id/it-priority", staffOnly, enforcePasswordChange, updateItPriority);
ticketDetailRouter.patch("/:id/priority", staffOnly, enforcePasswordChange, updateItPriority);
ticketDetailRouter.patch("/:id/status", staffOnly, enforcePasswordChange, updateTicketStatus);

export default ticketDetailRouter;
