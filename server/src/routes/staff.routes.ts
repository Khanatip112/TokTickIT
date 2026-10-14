import { Router } from "express";
import { enforcePasswordChange, requireRole } from "../middleware/auth.js";
import { listStaffTickets, listStaffUsers } from "../controllers/staffController.js";
import {
  assignTicket,
  claimTicket,
  getStaffTicketDetail,
  updateItPriority,
  updateTicketStatus,
} from "../controllers/ticketDetailController.js";

/**
 * IT Staff Ticketing routes (docs/lab-03/api-spec.md §3.2 / §3.5.5).
 *
 * RBAC: restricted to authenticated `IT_STAFF` and `ADMINISTRATOR` users.
 * `requireRole` returns 401 when unauthenticated and 403 for Requesters.
 * `enforcePasswordChange` keeps the first-login password wall intact.
 */
export const staffRouter = Router();

staffRouter.use(requireRole("IT_STAFF", "ADMINISTRATOR"), enforcePasswordChange);

staffRouter.get("/tickets", listStaffTickets);
staffRouter.get("/users", listStaffUsers);

// Issue 7 — ticket detail operations (api-spec §3.2.2 – §3.2.6).
staffRouter.get("/tickets/:id", getStaffTicketDetail);
staffRouter.patch("/tickets/:id/claim", claimTicket);
staffRouter.patch("/tickets/:id/assign", assignTicket);
staffRouter.patch("/tickets/:id/priority", updateItPriority);
staffRouter.patch("/tickets/:id/it-priority", updateItPriority);
staffRouter.patch("/tickets/:id/status", updateTicketStatus);

export default staffRouter;
