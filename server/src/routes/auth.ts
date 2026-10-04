import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { changePassword, login, logout, me } from "../controllers/authController.js";

/**
 * Authentication & session management routes (docs/lab-03/api-spec.md §3.1).
 *
 * `GET /api/auth/me`, `POST /api/auth/change-password` and `POST /api/auth/logout`
 * are exempt from the first-login password wall (see `enforcePasswordChange`).
 */
export const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/logout", requireAuth, logout);
authRouter.get("/me", requireAuth, me);
authRouter.post("/change-password", requireAuth, changePassword);

export default authRouter;
