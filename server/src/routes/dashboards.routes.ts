import { Router } from "express";
import { enforcePasswordChange, requireAuth } from "../middleware/auth.js";
import { getRequesterDashboard } from "../controllers/dashboardController.js";

/**
 * Lab 4 — Dashboard routes (Issue 6).
 *
 * `GET /api/dashboards/requester` is available to every authenticated role
 * (docs/lab-04/api-spec.md §4) but metrics are always scoped to the session
 * user's own requested tickets.
 */
export const dashboardsRouter = Router();

dashboardsRouter.get(
  "/requester",
  requireAuth,
  enforcePasswordChange,
  getRequesterDashboard
);

export default dashboardsRouter;
