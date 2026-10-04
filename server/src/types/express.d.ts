import type { SessionUser } from "./session.js";

// Augment the Express Request with the authenticated session user. This lets
// every controller and middleware reference `req.user` with full type safety.
declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export {};
