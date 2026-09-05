import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import { generateTicketNumber } from "./utils/ticketNumber.js";
import { uploadMiddleware } from "./utils/upload.js";
import multer from "multer";


// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  })
);
app.use(express.json());

// ---------------------------------------------------------------------------
// Issue 2 — API health check
// Make the test in tests/lab-01/health.test.ts pass.
// It must return HTTP 200 with JSON: { status: "ok", service: "TokTickIT API" }
// ---------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

// ---------------------------------------------------------------------------
// GET /api/dev-requesters
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
      orderBy: { name: "asc" },
    });
    res.status(200).json(devRequesters);
  } catch (error) {
    console.error("GET /api/dev-requesters error:", error);
    res.status(500).json({ error: "Failed to fetch development requesters" });
  }
});

// ---------------------------------------------------------------------------
// Issue 4 — Category list
// GET /api/categories
//   -> read categories from PostgreSQL via getPrisma().category.findMany(...)
//   -> return each { id, name } in a predictable (id) order
//   -> on failure, respond 500 with a safe message
// ---------------------------------------------------------------------------
app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: { name: "asc" },
    });
    res.status(200).json(categories);
  } catch (error) {
    console.error("GET /api/categories error:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/related-systems
// ---------------------------------------------------------------------------
app.get("/api/related-systems", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const systems = await prisma.relatedSystem.findMany({
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: { name: "asc" },
    });
    res.status(200).json(systems);
  } catch (error) {
    console.error("GET /api/related-systems error:", error);
    res.status(500).json({ error: "Failed to fetch related systems" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tickets (Issue 4)
// Create a new ticket with optional file attachments
// ---------------------------------------------------------------------------
const handleTicketUpload = (req: Request, res: Response, next: NextFunction) => {
  uploadMiddleware.array("attachments", 10)(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ error: "Payload Too Large: File size exceeds 5MB limit" });
        }
      }
      if (err.message && err.message.startsWith("INVALID_MIME_TYPE")) {
        return res.status(400).json({ error: "Bad Request: Only JPG, PNG, WEBP, and PDF files are allowed" });
      }
      return res.status(400).json({ error: err.message || "File upload error" });
    }
    next();
  });
};

app.post("/api/tickets", handleTicketUpload, async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesterId = (req.body.requesterId || req.headers["x-dev-requester-id"]) as string;
    const { categoryId, relatedSystemId, requestedPriority, summary, description } = req.body;
    const files = (req.files as Express.Multer.File[]) || [];

    // 1. Verify Requester
    if (!requesterId) {
      return res.status(403).json({ error: "Forbidden: Requester identity context required" });
    }
    const requester = await prisma.requesterUser.findUnique({
      where: { id: requesterId },
    });
    if (!requester || !requester.isActive) {
      return res.status(403).json({ error: "Forbidden: Requester user is inactive or does not exist" });
    }

    // 2. Validate Category
    if (!categoryId || typeof categoryId !== "string") {
      return res.status(400).json({ error: "Bad Request: categoryId is required" });
    }
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return res.status(400).json({ error: "Bad Request: Category does not exist" });
    }

    // 3. Validate Related System (Optional)
    let systemIdToUse: string | null = null;
    if (relatedSystemId && typeof relatedSystemId === "string" && relatedSystemId.trim() !== "") {
      const system = await prisma.relatedSystem.findUnique({ where: { id: relatedSystemId } });
      if (!system) {
        return res.status(400).json({ error: "Bad Request: Related System does not exist" });
      }
      systemIdToUse = relatedSystemId;
    }

    // 4. Validate Priority
    const validPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
    if (!requestedPriority || !validPriorities.includes(requestedPriority)) {
      return res.status(400).json({ error: "Bad Request: requestedPriority must be LOW, MEDIUM, HIGH, or URGENT" });
    }

    // 5. Validate Summary (min 5, max 150)
    const trimmedSummary = typeof summary === "string" ? summary.trim() : "";
    if (trimmedSummary.length < 5 || trimmedSummary.length > 150) {
      return res.status(400).json({ error: "Bad Request: Summary must be between 5 and 150 characters" });
    }

    // 6. Validate Description (min 10)
    const trimmedDescription = typeof description === "string" ? description.trim() : "";
    if (trimmedDescription.length < 10) {
      return res.status(400).json({ error: "Bad Request: Description must be at least 10 characters long" });
    }

    // 7. Validate Attachment Quota (Max 5 active files)
    if (files.length > 5) {
      return res.status(422).json({ error: "Unprocessable Entity: Maximum 5 attachments allowed per ticket" });
    }

    // Generate unique Ticket Number (TKT-2026-XXXXXX)
    const ticketNumber = await generateTicketNumber(prisma);

    // Create Ticket and Attachments in transaction
    const newTicket = await prisma.ticket.create({
      data: {
        ticketNumber,
        requesterId,
        categoryId,
        relatedSystemId: systemIdToUse,
        requestedPriority: requestedPriority as any,
        itPriority: requestedPriority as any,
        currentStatus: "NEW",
        summary: trimmedSummary,
        description: trimmedDescription,
        attachments: {
          create: files.map((f) => ({
            fileName: f.originalname,
            filePath: f.path,
            fileSize: f.size,
            mimeType: f.mimetype,
            isRemoved: false,
          })),
        },
      },
      include: {
        requester: {
          select: { id: true, name: true, email: true, department: true },
        },
        category: {
          select: { id: true, name: true },
        },
        relatedSystem: {
          select: { id: true, name: true },
        },
        attachments: true,
      },
    });

    return res.status(201).json(newTicket);
  } catch (error) {
    console.error("POST /api/tickets error:", error);
    return res.status(500).json({ error: "Internal Server Error: Ticket creation failed" });
  }
});

export default app;

