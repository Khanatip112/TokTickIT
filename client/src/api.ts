const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: string;
  name: string;
  description?: string | null;
}

export interface RelatedSystem {
  id: string;
  name: string;
  code: string;
  description?: string | null;
}

export interface RequesterSummary {
  id: string;
  name: string;
  email: string;
  department?: string | null;
}

export interface Attachment {
  id: string;
  ticketId: string;
  fileName: string;
  originalName: string;
  filePath: string;
  sizeBytes: number;
  mimeType: string;
  isRemoved: boolean;
  removedAt?: string | null;
  removalReason?: string | null;
  createdAt: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  requesterId: string;
  categoryId: string;
  relatedSystemId: string;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  itPriority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null;
  currentStatus: "NEW" | "OPEN" | "IN_PROGRESS" | "PENDING" | "RESOLVED" | "CLOSED";
  summary: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  requester?: RequesterSummary;
  category?: Category;
  relatedSystem?: RelatedSystem | null;
  attachments?: Attachment[];
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export interface Pagination {
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedTickets {
  data: Ticket[];
  pagination: Pagination;
}

// ---------------------------------------------------------------------------
// Lab 3 — Authentication (Issue 4)
// ---------------------------------------------------------------------------

export type UserRole = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

/** Sanitized authenticated user profile returned by the auth API. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string | null;
  isActive: boolean;
  /** The user must change their password before using the app. */
  requiresPasswordChange: boolean;
}

interface RawAuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string | null;
  isActive?: boolean;
  requiresPasswordChange?: boolean;
  mustChangePassword?: boolean;
}

/** Error thrown by API helpers, carrying the HTTP status and server error code. */
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function normalizeAuthUser(raw: RawAuthUser): AuthUser {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role: raw.role,
    department: raw.department ?? null,
    isActive: raw.isActive ?? true,
    requiresPasswordChange: raw.requiresPasswordChange ?? raw.mustChangePassword ?? false,
  };
}

async function readError(res: Response, fallback: string): Promise<{ message: string; code?: string }> {
  try {
    const body = await res.json();
    const err = body?.error;
    if (typeof err === "string") return { message: err };
    if (err && typeof err === "object") {
      return { message: typeof err.message === "string" ? err.message : fallback, code: err.code };
    }
    if (typeof body?.message === "string") return { message: body.message };
  } catch {
    /* non-JSON body — fall through */
  }
  return { message: fallback };
}

/** Authenticates with email + password and establishes the session cookie. */
export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const { message, code } = await readError(res, "Invalid email or password. Please try again.");
    throw new ApiError(message, res.status, code);
  }
  const data = await res.json();
  return normalizeAuthUser(data.user as RawAuthUser);
}

/** Destroys the server session and clears the auth cookie. */
export async function logout(): Promise<void> {
  await fetch(`${API_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
}

/** Returns the current authenticated user, or `null` when there is no session. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const res = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new ApiError("Failed to load the current session.", res.status);
  const data = await res.json();
  return normalizeAuthUser(data.user as RawAuthUser);
}

/** Changes the current user's password (used for the mandatory first-login flow). */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/auth/change-password`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
  });
  if (!res.ok) {
    const { message, code } = await readError(res, "Failed to change password.");
    throw new ApiError(message, res.status, code);
  }
  const data = await res.json();
  return normalizeAuthUser(data.user as RawAuthUser);
}

export interface TicketQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  requestedPriority?: string;
  currentStatus?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// Issue 2 + Issue 4 — call the backend.
// Steps: fetch `${API_URL}/api/health`; if not ok, throw.
//        then fetch `${API_URL}/api/categories`; if not ok, throw.
//        return { online: true, categories }.
// Throwing on failure lets the UI show a single Offline/error state.
export async function checkHealth(): Promise<{ status: string }> {
  const res = await fetch(`${API_URL}/api/health`);
  if (!res.ok) throw new Error("Unable to connect to TokTickIT API");
  return res.json();
}

export async function getCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/api/categories`);
  if (!res.ok) throw new Error("Unable to connect to TokTickIT API");
  return res.json();
}

export async function checkSystem(): Promise<SystemStatus> {
  try {
    await checkHealth();
    const categories = await getCategories();
    return { online: true, categories };
  } catch (error) {
    throw new Error("Unable to connect to TokTickIT API");
  }
}

export async function getTicketDetail(ticketId: string, requesterId: string): Promise<Ticket> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}`, {
    credentials: "include",
    headers: { "x-dev-requester-id": requesterId },
  });
  const data = await res.json();
  if (!res.ok) {
    const error: any = new Error(data.error || "Failed to fetch ticket detail");
    error.status = res.status;
    throw error;
  }
  return data;
}

export async function uploadAttachmentToTicket(ticketId: string, formData: FormData, requesterId: string): Promise<Attachment[]> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    credentials: "include",
    headers: { "x-dev-requester-id": requesterId },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to upload attachment");
  return data;
}

export async function softRemoveAttachment(
  attachmentId: string,
  removalReason: string,
  requesterId: string
): Promise<Attachment> {
  // เปลี่ยน Method เป็น DELETE และลบ /soft-remove ท้าย URL ออก
  const res = await fetch(`${API_URL}/api/attachments/${attachmentId}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "x-dev-requester-id": requesterId,
    },
    body: JSON.stringify({ removalReason }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    try {
      const errorJson = JSON.parse(errorText);
      throw new Error(errorJson.error || "Failed to soft-remove attachment");
    } catch {
      throw new Error(`Server Error (${res.status}): Soft remove action failed`);
    }
  }

  return await res.json();
}

export function getAttachmentDownloadUrl(attachmentId: string, requesterId: string): string {
  return `${API_URL}/api/attachments/${attachmentId}/download?requesterId=${encodeURIComponent(requesterId)}`;
}

export async function getRelatedSystems(): Promise<RelatedSystem[]> {
  const res = await fetch(`${API_URL}/api/related-systems`);
  if (!res.ok) {
    throw new Error("Failed to fetch related systems");
  }
  return res.json();
}

export async function createTicket(formData: FormData, requesterId: string): Promise<Ticket> {
  const res = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
    credentials: "include",
    headers: {
      "x-dev-requester-id": requesterId,
    },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    const errorMsg = data.error || `Ticket creation failed (${res.status})`;
    const error: any = new Error(errorMsg);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function getMyTickets(
  requesterId: string,
  params: TicketQueryParams = {}
): Promise<PaginatedTickets> {
  const query = new URLSearchParams();
  if (params.page != null) query.set("page", String(params.page));
  if (params.pageSize != null) query.set("pageSize", String(params.pageSize));
  if (params.search) query.set("search", params.search);
  if (params.categoryId) query.set("categoryId", params.categoryId);
  if (params.requestedPriority) query.set("requestedPriority", params.requestedPriority);
  if (params.currentStatus) query.set("currentStatus", params.currentStatus);
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortOrder) query.set("sortOrder", params.sortOrder);

  const qs = query.toString();
  const res = await fetch(`${API_URL}/api/tickets${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    headers: {
      "x-dev-requester-id": requesterId,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    const errorMsg = data.error || `Failed to fetch my tickets (${res.status})`;
    const error: any = new Error(errorMsg);
    error.status = res.status;
    throw error;
  }
  return data as PaginatedTickets;
}
