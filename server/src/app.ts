import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import fs from "fs";
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
// GET /api/dev-requesters (Issue 3)
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

// Multer upload error handling wrapper
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

// ---------------------------------------------------------------------------
// POST /api/tickets (Issue 4)
// Create a new ticket with optional file attachments
// ---------------------------------------------------------------------------
app.post("/api/tickets", handleTicketUpload, async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesterId = (req.body.requesterId || req.headers["x-dev-requester-id"]) as string;
    const { categoryId, relatedSystemId, requestedPriority, summary, description } = req.body;
    const files = (req.files as Express.Multer.File[]) || [];

    if (!requesterId) {
      return res.status(403).json({ error: "Forbidden: Requester identity context required" });
    }
    const requester = await prisma.requesterUser.findUnique({ where: { id: requesterId } });
    if (!requester || !requester.isActive) {
      return res.status(403).json({ error: "Forbidden: Requester user is inactive or does not exist" });
    }

    if (!categoryId || typeof categoryId !== "string") {
      return res.status(400).json({ error: "Bad Request: categoryId is required" });
    }
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return res.status(400).json({ error: "Bad Request: Category does not exist" });
    }

    let systemIdToUse: string | null = null;
    if (relatedSystemId && typeof relatedSystemId === "string" && relatedSystemId.trim() !== "") {
      const system = await prisma.relatedSystem.findUnique({ where: { id: relatedSystemId } });
      if (!system) {
        return res.status(400).json({ error: "Bad Request: Related System does not exist" });
      }
      systemIdToUse = relatedSystemId;
    }

    const validPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];
    if (!requestedPriority || !validPriorities.includes(requestedPriority)) {
      return res.status(400).json({ error: "Bad Request: requestedPriority must be LOW, MEDIUM, HIGH, or URGENT" });
    }

    const trimmedSummary = typeof summary === "string" ? summary.trim() : "";
    if (trimmedSummary.length < 5 || trimmedSummary.length > 150) {
      return res.status(400).json({ error: "Bad Request: Summary must be between 5 and 150 characters" });
    }

    const trimmedDescription = typeof description === "string" ? description.trim() : "";
    if (trimmedDescription.length < 10) {
      return res.status(400).json({ error: "Bad Request: Description must be at least 10 characters long" });
    }

    if (files.length > 5) {
      return res.status(422).json({ error: "Unprocessable Entity: Maximum 5 attachments allowed per ticket" });
    }

    const ticketNumber = await generateTicketNumber(prisma);

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

// ---------------------------------------------------------------------------
// GET /api/tickets (Issue 6)
// List all tickets owned by the current requester (strict data isolation)
// ---------------------------------------------------------------------------
app.get("/api/tickets", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesterId = (req.headers["x-dev-requester-id"] || req.query.requesterId) as string;

    if (!requesterId) {
      return res.status(403).json({ error: "Forbidden: Requester identity context required" });
    }

    const requester = await prisma.requesterUser.findUnique({ where: { id: requesterId } });
    if (!requester || !requester.isActive) {
      return res.status(403).json({ error: "Forbidden: Requester user is inactive or does not exist" });
    }

    const tickets = await prisma.ticket.findMany({
      where: { requesterId },
      include: {
        category: { select: { id: true, name: true } },
        relatedSystem: { select: { id: true, name: true } },
        attachments: {
          where: { isRemoved: false },
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(tickets);
  } catch (error) {
    console.error("GET /api/tickets error:", error);
    return res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/tickets/:id (Issue 6)
// Retrieve detail of owned ticket with strict 403 ownership enforcement
// ---------------------------------------------------------------------------
app.get("/api/tickets/:id", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesterId = (req.headers["x-dev-requester-id"] || req.query.requesterId) as string;
    const { id } = req.params;

    if (!requesterId) {
      return res.status(403).json({ error: "Forbidden: Requester identity context required" });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
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
        attachments: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (ticket.requesterId !== requesterId) {
      return res.status(403).json({ error: "Forbidden: You do not own this ticket" });
    }

    return res.status(200).json(ticket);
  } catch (error) {
    console.error("GET /api/tickets/:id error:", error);
    return res.status(500).json({ error: "Failed to fetch ticket details" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tickets/:id/attachments (Issue 6)
// Upload additional file attachment to an existing owned ticket
// ---------------------------------------------------------------------------
app.post("/api/tickets/:id/attachments", handleTicketUpload, async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesterId = (req.body.requesterId || req.headers["x-dev-requester-id"]) as string;
    const { id } = req.params;
    const files = (req.files as Express.Multer.File[]) || [];

    if (!requesterId) {
      return res.status(403).json({ error: "Forbidden: Requester identity context required" });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        attachments: {
          where: { isRemoved: false },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (ticket.requesterId !== requesterId) {
      return res.status(403).json({ error: "Forbidden: You do not own this ticket" });
    }

    const currentActiveCount = ticket.attachments.length;
    if (currentActiveCount + files.length > 5) {
      return res
        .status(422)
        .json({ error: "Unprocessable Entity: Maximum 5 active attachments allowed per ticket" });
    }

    const newAttachments = await Promise.all(
      files.map((f) =>
        prisma.attachment.create({
          data: {
            ticketId: id,
            fileName: f.originalname,
            filePath: f.path,
            fileSize: f.size,
            mimeType: f.mimetype,
            isRemoved: false,
          },
        })
      )
    );

    return res.status(201).json(files.length === 1 ? newAttachments[0] : newAttachments);
  } catch (error) {
    console.error("POST /api/tickets/:id/attachments error:", error);
    return res.status(500).json({ error: "Failed to upload attachment" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/attachments/:id/download (Issue 6)
// Download active file stream with ownership and soft removal enforcement
// ---------------------------------------------------------------------------
app.get("/api/attachments/:id/download", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesterId = (req.headers["x-dev-requester-id"] || req.query.requesterId) as string;
    const { id } = req.params;

    if (!requesterId) {
      return res.status(403).json({ error: "Forbidden: Requester identity context required" });
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: { ticket: true },
    });

    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    if (attachment.ticket.requesterId !== requesterId) {
      return res.status(403).json({ error: "Forbidden: You do not own this attachment" });
    }

    if (attachment.isRemoved) {
      return res
        .status(403)
        .json({ error: "Forbidden: File soft-removed and unavailable for download" });
    }

    if (!fs.existsSync(attachment.filePath)) {
      return res.status(404).json({ error: "Physical file not found on disk" });
    }

    return res.download(attachment.filePath, attachment.fileName);
  } catch (error) {
    console.error("GET /api/attachments/:id/download error:", error);
    return res.status(500).json({ error: "Failed to download attachment" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/attachments/:id (Issue 6)
// Soft-remove an attachment requiring mandatory removalReason
// ---------------------------------------------------------------------------
app.delete("/api/attachments/:id", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesterId = (req.body.requesterId || req.headers["x-dev-requester-id"]) as string;
    const { removalReason } = req.body;
    const { id } = req.params;

    if (!requesterId) {
      return res.status(403).json({ error: "Forbidden: Requester identity context required" });
    }

    const trimmedReason = typeof removalReason === "string" ? removalReason.trim() : "";
    if (!trimmedReason || trimmedReason.length < 3) {
      return res
        .status(400)
        .json({ error: "Bad Request: A valid removalReason (min 3 characters) is required" });
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: { ticket: true },
    });

    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    if (attachment.ticket.requesterId !== requesterId) {
      return res.status(403).json({ error: "Forbidden: You do not own this attachment" });
    }

    const updatedAttachment = await prisma.attachment.update({
      where: { id },
      data: {
        isRemoved: true,
        removedAt: new Date(),
        removalReason: trimmedReason,
      },
    });

    return res.status(200).json(updatedAttachment);
  } catch (error) {
    console.error("DELETE /api/attachments/:id error:", error);
    return res.status(500).json({ error: "Failed to soft-remove attachment" });
  }
});

export default app;

