import { Router } from "express";
import { enforcePasswordChange, requireAuth, requireRole } from "../middleware/auth.js";
import {
  listActionsTaken,
  createActionTaken,
  updateActionTaken,
} from "../controllers/actionsTakenController.js";

const staffOrAdmin = requireRole("IT_STAFF", "ADMINISTRATOR");

/**
 * Routes mounted at `/api/tickets`
 * - GET  /api/tickets/:id/actions-taken (Requester-owner, IT Staff, Admin)
 * - POST /api/tickets/:id/actions-taken (IT Staff, Admin only)
 */
export const ticketActionsRouter = Router();

ticketActionsRouter.get(
  "/:id/actions-taken",
  requireAuth,
  enforcePasswordChange,
  listActionsTaken
);

ticketActionsRouter.post(
  "/:id/actions-taken",
  requireAuth,
  staffOrAdmin,
  enforcePasswordChange,
  createActionTaken
);

/**
 * Routes mounted at `/api/actions-taken`
 * - PUT /api/actions-taken/:actionId (Original performer IT Staff, Admin)
 */
export const actionsTakenRouter = Router();

actionsTakenRouter.put(
  "/:actionId",
  requireAuth,
  staffOrAdmin,
  enforcePasswordChange,
  updateActionTaken
);

export default ticketActionsRouter;
