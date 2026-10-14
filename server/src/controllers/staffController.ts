import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import type { Priority, TicketStatus } from "@prisma/client";
import { getPrisma } from "../prisma.js";

const STATUSES: readonly TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "PENDING",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];
const PRIORITIES: readonly Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const SORT_FIELDS = ["createdAt", "updatedAt", "ticketNumber", "itPriority"] as const;
type SortField = (typeof SORT_FIELDS)[number];

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

type SortOrder = "asc" | "desc";

function errorPayload(code: string, message: string) {
  return { error: { code, message } };
}

function serverError(res: Response, scope: string, error: unknown) {
  console.error(`${scope} error:`, error);
  return res.status(500).json(errorPayload("INTERNAL_SERVER_ERROR", "An unexpected error occurred."));
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function pickStatus(value: unknown): TicketStatus | undefined {
  const candidate = asString(value);
  return candidate && (STATUSES as readonly string[]).includes(candidate)
    ? (candidate as TicketStatus)
    : undefined;
}

function pickPriority(value: unknown): Priority | undefined {
  const candidate = asString(value);
  return candidate && (PRIORITIES as readonly string[]).includes(candidate)
    ? (candidate as Priority)
    : undefined;
}

/** Shape returned to the IT Staff queue UI (docs/lab-03/api-spec.md §3.2.1). */
interface StaffTicketRow {
  id: string;
  ticketNumber: string;
  summary: string;
  description: string;
  requestedPriority: Priority;
  itPriority: Priority;
  currentStatus: TicketStatus;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string };
  relatedSystem: { id: string; name: string };
  requester: { id: string; name: string; email: string };
  owner: { id: string; name: string; email: string } | null;
  activeAttachmentsCount: number;
  publicCommentsCount: number;
  internalNotesCount: number;
}

/**
 * GET /api/staff/users
 * Lookup of active IT Staff and Administrators for assignment dropdowns
 * (docs/lab-03/api-spec.md §3.5.5).
 */
export async function listStaffUsers(_req: Request, res: Response): Promise<Response> {
  try {
    const users = await getPrisma().user.findMany({
      where: { isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
      select: { id: true, fullName: true, email: true, role: true },
      orderBy: { fullName: "asc" },
    });

    return res.status(200).json(
      users.map((u) => ({ id: u.id, name: u.fullName, email: u.email, role: u.role }))
    );
  } catch (error) {
    return serverError(res, "GET /api/staff/users", error);
  }
}

/**
 * GET /api/staff/tickets
 * Paginated, filterable, sortable system-wide ticket queue (api-spec §3.2.1).
 *
 * Query params (contract names first, common aliases accepted):
 *   search|q, categoryId|category, status, requestedPriority, itPriority,
 *   ownerId|assignedToId|owner ("unassigned" or "me"), sortBy, sortOrder,
 *   page, pageSize|limit.
 */
export async function listStaffTickets(req: Request, res: Response): Promise<Response> {
  try {
    const prisma = getPrisma();

    const search = asString(req.query.search) ?? asString(req.query.q);
    const categoryId = asString(req.query.categoryId) ?? asString(req.query.category);
    const status = pickStatus(req.query.status);
    const requestedPriority = pickPriority(req.query.requestedPriority);
    const itPriority = pickPriority(req.query.itPriority);
    const ownerRaw =
      asString(req.query.ownerId) ?? asString(req.query.assignedToId) ?? asString(req.query.owner);

    const where: Prisma.TicketWhereInput = {};

    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (status) where.currentStatus = status;
    if (requestedPriority) where.requestedPriority = requestedPriority;
    if (itPriority) where.itPriority = itPriority;

    if (ownerRaw) {
      if (ownerRaw === "unassigned") where.assignedToId = null;
      else if (ownerRaw === "me") where.assignedToId = req.user?.id ?? "___none___";
      else where.assignedToId = ownerRaw;
    }

    const sortByParam = asString(req.query.sortBy);
    const sortBy: SortField = (SORT_FIELDS as readonly string[]).includes(sortByParam ?? "")
      ? (sortByParam as SortField)
      : "createdAt";
    const sortOrder: SortOrder =
      (asString(req.query.sortOrder) ?? "desc").toLowerCase() === "asc" ? "asc" : "desc";

    const orderBy: Prisma.TicketOrderByWithRelationInput[] = [{ [sortBy]: sortOrder }];
    if (sortBy !== "createdAt") orderBy.push({ createdAt: "desc" });

    const pageRaw = Number.parseInt(asString(req.query.page) ?? "", 10);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

    const sizeRaw = Number.parseInt(
      asString(req.query.pageSize) ?? asString(req.query.limit) ?? "",
      10
    );
    const pageSize = Number.isFinite(sizeRaw) && sizeRaw > 0 ? Math.min(sizeRaw, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;

    const [totalCount, tickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          ticketNumber: true,
          summary: true,
          description: true,
          requestedPriority: true,
          itPriority: true,
          currentStatus: true,
          createdAt: true,
          updatedAt: true,
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
          requester: { select: { id: true, fullName: true, email: true } },
          assignedTo: { select: { id: true, fullName: true, email: true } },
          _count: {
            select: {
              attachments: { where: { isRemoved: false } },
              comments: true,
              internalNotes: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    const data: StaffTicketRow[] = tickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      summary: t.summary,
      description: t.description,
      requestedPriority: t.requestedPriority,
      itPriority: t.itPriority,
      currentStatus: t.currentStatus,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      category: { id: t.category.id, name: t.category.name },
      relatedSystem: { id: t.relatedSystem.id, name: t.relatedSystem.name },
      requester: { id: t.requester.id, name: t.requester.fullName, email: t.requester.email },
      owner: t.assignedTo
        ? { id: t.assignedTo.id, name: t.assignedTo.fullName, email: t.assignedTo.email }
        : null,
      activeAttachmentsCount: t._count.attachments,
      publicCommentsCount: t._count.comments,
      internalNotesCount: t._count.internalNotes,
    }));

    return res.status(200).json({
      data,
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
    return serverError(res, "GET /api/staff/tickets", error);
  }
}