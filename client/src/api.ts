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
  currentStatus:
    | "NEW"
    | "OPEN"
    | "IN_PROGRESS"
    | "PENDING"
    | "WAITING_FOR_REQUESTER"
    | "RESOLVED"
    | "CLOSED"
    | "REOPENED"
    | "CANCELLED";
  resolutionSummary?: string | null;
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

// ---------------------------------------------------------------------------
// Lab 3 — Administrator User Management (Issue 5)
// ---------------------------------------------------------------------------

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string | null;
  isActive: boolean;
  requiresPasswordChange: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface ListUsersParams {
  search?: string;
  role?: UserRole | "";
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  role: UserRole;
  department?: string | null;
  isActive?: boolean;
  initialPassword?: string;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  role?: UserRole;
  department?: string | null;
  isActive?: boolean;
}

export interface ResetPasswordResult {
  message: string;
  userId: string;
}

/** GET /api/admin/users — directory listing with search/filter/pagination. */
export async function listUsers(params: ListUsersParams = {}): Promise<AdminUser[]> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.role) query.set("role", params.role);
  if (params.isActive !== undefined) query.set("isActive", String(params.isActive));
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));

  const qs = query.toString();
  const res = await fetch(`${API_URL}/api/admin/users${qs ? `?${qs}` : ""}`, { credentials: "include" });
  if (!res.ok) {
    const { message, code } = await readError(res, "Failed to load users.");
    throw new ApiError(message, res.status, code);
  }
  return res.json();
}

/** POST /api/admin/users — creates a user flagged for a first-login password change. */
export async function createUser(payload: CreateUserPayload): Promise<AdminUser> {
  const res = await fetch(`${API_URL}/api/admin/users`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const { message, code } = await readError(res, "Failed to create user.");
    throw new ApiError(message, res.status, code);
  }
  return res.json();
}

/** PATCH /api/admin/users/:id — updates name / email / role / status. */
export async function updateUser(id: string, payload: UpdateUserPayload): Promise<AdminUser> {
  const res = await fetch(`${API_URL}/api/admin/users/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const { message, code } = await readError(res, "Failed to update user.");
    throw new ApiError(message, res.status, code);
  }
  return res.json();
}

/** POST /api/admin/users/:id/reset-password — issues a new temporary password. */
export async function resetUserPassword(id: string, initialPassword: string): Promise<ResetPasswordResult> {
  const res = await fetch(`${API_URL}/api/admin/users/${id}/reset-password`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initialPassword }),
  });
  if (!res.ok) {
    const { message, code } = await readError(res, "Failed to reset password.");
    throw new ApiError(message, res.status, code);
  }
  return res.json();
}

/** Generates a complexity-compliant temporary password for the create/reset forms. */
export function generateTempPassword(): string {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const special = "!@#$%&*";
  const pick = (set: string, count: number) =>
    Array.from({ length: count }, () => set.charAt(Math.floor(Math.random() * set.length))).join("");

  const chars = (
    pick(upper, 1) +
    pick(lower, 4) +
    pick(digits, 2) +
    pick(special, 1) +
    pick(lower + upper + digits, 4)
  ).split("");

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join("");
}

// ---------------------------------------------------------------------------
// Lab 3 — IT Staff Ticket Queue (Issue 6)
// ---------------------------------------------------------------------------

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type StaffTicketStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "PENDING"
  | "WAITING_FOR_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";

export interface StaffTicket {
  id: string;
  ticketNumber: string;
  summary: string;
  description: string;
  requestedPriority: TicketPriority;
  itPriority: TicketPriority;
  currentStatus: StaffTicketStatus;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string };
  relatedSystem: { id: string; name: string };
  requester: { id: string; name: string; email: string };
  owner: { id: string; name: string; email: string } | null;
  activeAttachmentsCount: number;
  publicCommentsCount: number;
  internalNotesCount: number;
}

export interface StaffQueueParams {
  search?: string;
  categoryId?: string;
  status?: string;
  requestedPriority?: string;
  itPriority?: string;
  /** Owner id, `"unassigned"`, or `"me"`. */
  ownerId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface StaffTicketListResponse {
  data: StaffTicket[];
  pagination: Pagination;
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

/** GET /api/staff/tickets — paginated, filterable, sortable system-wide queue. */
export async function getStaffTickets(params: StaffQueueParams = {}): Promise<StaffTicketListResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.categoryId) query.set("categoryId", params.categoryId);
  if (params.status) query.set("status", params.status);
  if (params.requestedPriority) query.set("requestedPriority", params.requestedPriority);
  if (params.itPriority) query.set("itPriority", params.itPriority);
  if (params.ownerId) query.set("ownerId", params.ownerId);
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortOrder) query.set("sortOrder", params.sortOrder);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));

  const qs = query.toString();
  const res = await fetch(`${API_URL}/api/staff/tickets${qs ? `?${qs}` : ""}`, { credentials: "include" });
  if (!res.ok) {
    const { message, code } = await readError(res, "Failed to load the ticket queue.");
    throw new ApiError(message, res.status, code);
  }
  return res.json();
}

/** GET /api/staff/users — active IT Staff and Administrators for owner filters. */
export async function getStaffUsers(): Promise<StaffUser[]> {
  const res = await fetch(`${API_URL}/api/staff/users`, { credentials: "include" });
  if (!res.ok) {
    const { message, code } = await readError(res, "Failed to load staff members.");
    throw new ApiError(message, res.status, code);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Lab 3 — IT Staff Ticket Detail Operations (Issue 7)
// ---------------------------------------------------------------------------

/** Full operational detail for one ticket (api-spec §3.2.2). */
export interface StaffTicketDetail extends StaffTicket {
  /** Convenience mirror of `owner.id` (`null` when unassigned). */
  ownerId: string | null;
  resolutionSummary: string | null;
  requester: { id: string; name: string; email: string; department?: string | null };
  attachments: Attachment[];
  /**
   * Target statuses allowed for the current status + role, computed from the
   * server-side BR-15 transition matrix (admins additionally see the
   * CLOSED → REOPENED transition).
   */
  permittedTransitions: StaffTicketStatus[];
}

/** Response envelope shared by the claim/assign/priority/status operations. */
export interface StaffTicketOperationResult {
  id: string;
  ownerId?: string | null;
  assignedToId?: string | null;
  owner?: { id: string; name: string; email: string } | null;
  currentStatus?: StaffTicketStatus;
  requestedPriority?: TicketPriority;
  itPriority?: TicketPriority;
  resolutionSummary?: string | null;
  updatedAt: string;
}

/** Response of the Requester "Problem Appears Resolved" action. */
export interface ResolveIndicationResult {
  message: string;
  ticketId: string;
}

/** Shared PATCH helper: JSON body, session cookie, ApiError on failure. */
async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const { message, code } = await readError(res, "The request could not be completed.");
    throw new ApiError(message, res.status, code);
  }
  return res.json();
}

/** GET /api/staff/tickets/:id — operational detail with permitted transitions. */
export async function getStaffTicket(ticketId: string): Promise<StaffTicketDetail> {
  const res = await fetch(`${API_URL}/api/staff/tickets/${ticketId}`, { credentials: "include" });
  if (!res.ok) {
    const { message, code } = await readError(res, "Failed to load the ticket.");
    throw new ApiError(message, res.status, code);
  }
  return res.json();
}

/** PATCH /api/staff/tickets/:id/claim — "Assign to Me" (auto-opens NEW). */
export async function claimStaffTicket(ticketId: string): Promise<StaffTicketOperationResult> {
  return patchJson(`/api/staff/tickets/${ticketId}/claim`, {});
}

/** PATCH /api/staff/tickets/:id/assign — reassign owner (null unassigns). */
export async function assignStaffTicket(
  ticketId: string,
  ownerId: string | null
): Promise<StaffTicketOperationResult> {
  return patchJson(`/api/staff/tickets/${ticketId}/assign`, { ownerId });
}

/** PATCH /api/staff/tickets/:id/priority — updates `itPriority` only (BR-12). */
export async function updateStaffTicketPriority(
  ticketId: string,
  itPriority: TicketPriority
): Promise<StaffTicketOperationResult> {
  return patchJson(`/api/staff/tickets/${ticketId}/priority`, { itPriority });
}

/** PATCH /api/staff/tickets/:id/status — BR-15 transition + BR-17 summary. */
export async function updateStaffTicketStatus(
  ticketId: string,
  currentStatus: StaffTicketStatus,
  resolutionSummary?: string
): Promise<StaffTicketOperationResult> {
  return patchJson(`/api/staff/tickets/${ticketId}/status`, {
    currentStatus,
    ...(resolutionSummary !== undefined ? { resolutionSummary } : {}),
  });
}

/** POST /api/tickets/:id/resolve-indication — Requester "Problem Appears Resolved". */
export async function indicateProblemResolved(
  ticketId: string,
  note?: string
): Promise<ResolveIndicationResult> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/resolve-indication`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(note ? { note } : {}),
  });
  if (!res.ok) {
    const { message, code } = await readError(
      res,
      "The resolution indication could not be recorded."
    );
    throw new ApiError(message, res.status, code);
  }
  return res.json();
}
