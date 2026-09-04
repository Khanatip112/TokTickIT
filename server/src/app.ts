import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";

export const app = express();

// Enable CORS for all local development origins and allow custom header x-dev-requester-id
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-dev-requester-id", "Authorization"],
  })
);

app.use(express.json());

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// ---------------------------------------------------------------------------
// GET /api/dev-requesters (Issue 3)
// Returns active Development Requesters (where isActive = true)
// ---------------------------------------------------------------------------
app.get("/api/dev-requesters", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const devRequesters = await prisma.requesterUser.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
      },
      orderBy: {
        name: "asc",
      },
    });
    res.status(200).json(devRequesters);
  } catch (error) {
    console.error("GET /api/dev-requesters error:", error);
    res.status(500).json({ error: "Failed to fetch development requesters" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/categories
// ---------------------------------------------------------------------------
app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });
    res.status(200).json(categories);
  } catch (error) {
    console.error("GET /api/categories error:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

export default app;
