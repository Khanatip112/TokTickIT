import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import fs from "fs";
import { getPrisma } from "./prisma.js";
import { generateTicketNumber } from "./utils/ticketNumber.js";
import { uploadMiddleware } from "./utils/upload.js";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.routes.js";
import { staffRouter } from "./routes/staff.routes.js";
import { enforcePasswordChange, loadSession } from "./middleware/auth.js";
import { ticketDetailRouter } from "./routes/ticketDetail.routes.js";
import { commentsRouter } from "./routes/comments.routes.js";
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
// Lab 3 — Session hydration (Issue 3)
// Populates `req.user` when a valid `toktickit_session` cookie (or a Bearer
// token) is present. It never blocks the request by itself, so Lab 1/Lab 2
// routes without a session continue to behave exactly as before.
// ---------------------------------------------------------------------------
app.use(loadSession);

// ---------------------------------------------------------------------------
// Lab 3 — Authentication & session management (Issue 3)
// ---------------------------------------------------------------------------
app.use("/api/auth", authRouter);

// ---------------------------------------------------------------------------
// Lab 3 — Administrator User Management (Issue 5)
// RBAC-guarded under /api/admin (ADMINISTRATOR only).
// ---------------------------------------------------------------------------
app.use("/api/admin", adminRouter);

// ---------------------------------------------------------------------------
// Lab 3 — IT Staff Ticket Queue (Issue 6)
// RBAC-guarded under /api/staff (IT_STAFF + ADMINISTRATOR only).
// ---------------------------------------------------------------------------
app.use("/api/staff", staffRouter);

// ---------------------------------------------------------------------------
// Lab 3 — Ticket detail operations (Issue 7)
// `/api/tickets/:id/claim|assign|it-priority|status` (IT Staff + Admin, guarded
// by `requireRole` inside the router) and `/api/tickets/:id/resolve-indication`
// (authenticated owning Requester). The sub-router only matches those paths,
// so the legacy Lab 2 routes below (GET/POST /api/tickets, GET /api/tickets/:id)
// are untouched.
// ---------------------------------------------------------------------------
app.use("/api/tickets", ticketDetailRouter);

// ---------------------------------------------------------------------------
// Lab 3 — Public Comments & Internal Notes (Issue 8)
// `GET/POST /api/tickets/:id/comments` (owner Requester + IT Staff + Admin)
// and `GET/POST /api/tickets/:id/notes` (IT Staff + Admin only; alias
// `/internal-notes`). RBAC guards live inside the router. The sub-router only
// matches those nested paths, so the legacy Lab 2 routes below
// (GET/POST /api/tickets, GET /api/tickets/:id) are untouched.
// ---------------------------------------------------------------------------
app.use("/api/tickets", commentsRouter);

// ---------------------------------------------------------------------------
// Lab 3 — Requester identity bridge (Issue 3)
// Prefer the authenticated session identity (`req.user`). When no session is
// present we fall back to the legacy Lab 2 development header / parameter so
// existing clients and the Lab 2 test-suite keep working unchanged.
// ---------------------------------------------------------------------------
function resolveRequesterId(req: Request): string | undefined {
  if (req.user?.id) return req.user.id;
  const fromBody =
    req.body && typeof req.body.requesterId === "string" ? req.body.requesterId.trim() : undefined;
  const fromHeader = req.headers["x-dev-requester-id"];
  const fromQuery = typeof req.query.requesterId === "string" ? req.query.requesterId.trim() : undefined;
  const resolved =
    (fromBody && fromBody !== "" ? fromBody : undefined) ||
    (typeof fromHeader === "string" && fromHeader !== "" ? fromHeader : undefined) ||
    fromQuery;
  return resolved;
}

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

// ---------------------------------------------------------------------------    // Issue 4 — Category list
// GET /api/categories
//   -> read categories from PostgreSQL via getPrisma().category.findMany(...)
//   -> return each { id, name } in a predictable (id) order
//   -> on failure, respond 500 with a safe message
// ---------------------------------------------------------------------------
app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const categories = await prisma.category.findMany({
      where: { isActive: true },
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
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
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
app.post("/api/tickets", enforcePasswordChange, handleTicketUpload, async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesterId = resolveRequesterId(req);
    const { categoryId, relatedSystemId, requestedPriority, summary, description } = req.body;
    const files = (req.files as Express.Multer.File[]) || [];

    if (!requesterId) {
      return res.status(403).json({ error: "Forbidden: Requester identity context required" });
    }
    if (!req.user) {
      // Legacy Lab 2 development-identity path (no authenticated session).
      const requester = await prisma.requesterUser.findUnique({ where: { id: requesterId } });
      if (!requester || !requester.isActive) {
        return res.status(403).json({ error: "Forbidden: Requester user is inactive or does not exist" });
      }
    }

    if (!categoryId || typeof categoryId !== "string") {
      return res.status(400).json({ error: "Bad Request: categoryId is required" });
    }
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || !category.isActive) {
      return res.status(400).json({ error: "Bad Request: Category does not exist or is inactive" });
    }

    if (!relatedSystemId || typeof relatedSystemId !== "string" || relatedSystemId.trim() === "") {
      return res.status(400).json({ error: "Bad Request: relatedSystemId is required" });
    }
    const relatedSystem = await prisma.relatedSystem.findUnique({ where: { id: relatedSystemId } });
    if (!relatedSystem || !relatedSystem.isActive) {
      return res.status(400).json({ error: "Bad Request: Related System does not exist or is inactive" });
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
        relatedSystemId,
        requestedPriority: requestedPriority as any,
        itPriority: requestedPriority as any,
        currentStatus: "NEW",
        summary: trimmedSummary,
        description: trimmedDescription,
        attachments: {
          create: files.map((f) => ({
            fileName: f.filename,
            originalName: f.originalname,
            filePath: f.path,
            sizeBytes: f.size,
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
app.get("/api/tickets", enforcePasswordChange, async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesterId = resolveRequesterId(req);

    if (!requesterId) {
      return res.status(403).json({ error: "Forbidden: Requester identity context required" });
    }

    if (!req.user) {
      const requester = await prisma.requesterUser.findUnique({ where: { id: requesterId } });
      if (!requester || !requester.isActive) {
        return res.status(403).json({ error: "Forbidden: Requester user is inactive or does not exist" });
      }
    }

    // --- Query parameters: server-side search / filter / sort / pagination ---
    const parseEnum = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
      typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

    const page = Math.max(1, Number.parseInt(String(req.query.page ?? ""), 10) || 1);
    const rawPageSize = Number.parseInt(String(req.query.pageSize ?? ""), 10) || 10;
    const pageSize = Math.min(50, Math.max(1, rawPageSize));
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const categoryId =
      typeof req.query.categoryId === "string" && req.query.categoryId.trim() !== ""
        ? req.query.categoryId
        : undefined;
    const requestedPriority = parseEnum(req.query.requestedPriority, ["LOW", "MEDIUM", "HIGH", "URGENT"] as const);
    const currentStatus = parseEnum(req.query.currentStatus, [
      "NEW",
      "OPEN",
      "IN_PROGRESS",
      "PENDING",
      "RESOLVED",
      "CLOSED",
    ] as const);
    const sortBy = parseEnum(req.query.sortBy, [
      "createdAt",
      "updatedAt",
      "ticketNumber",
      "requestedPriority",
    ] as const) ?? "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? "asc" : "desc";

    const where: any = { requesterId };
    if (categoryId) where.categoryId = categoryId;
    if (requestedPriority) where.requestedPriority = requestedPriority;
    if (currentStatus) where.currentStatus = currentStatus;
    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
      ];
    }

    const [totalCount, tickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        include: {
          requester: { select: { id: true, name: true, email: true, department: true } },
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
          attachments: {
            where: { isRemoved: false },
            select: { id: true },
          },
        },
        orderBy: { [sortBy]: sortOrder } as any,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    return res.status(200).json({
      data: tickets.map((t) => ({
        ...t,
        activeAttachmentsCount: t.attachments.length,
      })),
      pagination: {
        totalCount,
        page,
        pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("GET /api/tickets error:", error);
    return res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/tickets/:id (Issue 6)
// Retrieve detail of owned ticket with strict 403 ownership enforcement
// ---------------------------------------------------------------------------
app.get("/api/tickets/:id", enforcePasswordChange, async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesterId = resolveRequesterId(req);
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
app.post("/api/tickets/:id/attachments", enforcePasswordChange, handleTicketUpload, async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesterId = resolveRequesterId(req);
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
            fileName: f.filename,
            originalName: f.originalname,
            filePath: f.path,
            sizeBytes: f.size,
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
app.get("/api/attachments/:id/download", enforcePasswordChange, async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesterId = resolveRequesterId(req);
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

    return res.download(attachment.filePath, attachment.originalName);
  } catch (error) {
    console.error("GET /api/attachments/:id/download error:", error);
    return res.status(500).json({ error: "Failed to download attachment" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/attachments/:id (Issue 6)
// Soft-remove an attachment requiring mandatory removalReason
// ---------------------------------------------------------------------------
app.delete("/api/attachments/:id", enforcePasswordChange, async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesterId = resolveRequesterId(req);
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

