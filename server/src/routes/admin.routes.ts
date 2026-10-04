import { Router } from "express";
import { enforcePasswordChange, requireRole } from "../middleware/auth.js";
import { createUser, listUsers, resetPassword, updateUser } from "../controllers/adminController.js";

/**
 * Administrator User Management routes (docs/lab-03/api-spec.md §3.5).
 *
 * RBAC: the entire router is restricted to authenticated `ADMINISTRATOR`s.
 * `requireRole` returns 401 when unauthenticated and 403 for any other role.
 * `enforcePasswordChange` keeps the first-login password wall intact.
 *
 * Note: `PATCH /api/admin/users/:id` is the contract method; `PUT` is accepted
 * as an alias (Issue 5 task wording) and routed to the same handler.
 */
export const adminRouter = Router();

adminRouter.use(requireRole("ADMINISTRATOR"), enforcePasswordChange);

adminRouter.get("/users", listUsers);
adminRouter.post("/users", createUser);
adminRouter.patch("/users/:id", updateUser);
adminRouter.put("/users/:id", updateUser);
adminRouter.post("/users/:id/reset-password", resetPassword);

export default adminRouter;
