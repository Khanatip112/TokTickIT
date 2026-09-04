const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: string;
  name: string;
  description?: string | null;
}

export interface RelatedSystem {
  id: string;
  name: string;
  description?: string | null;
}

export interface DevRequester {
  id: string;
  name: string;
  email: string;
  department?: string | null;
}

export interface Attachment {
  id: string;
  ticketId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
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
  relatedSystemId?: string | null;
  requestedPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  itPriority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null;
  currentStatus: "NEW" | "OPEN" | "IN_PROGRESS" | "PENDING" | "RESOLVED" | "CLOSED";
  summary: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  requester?: DevRequester;
  category?: Category;
  relatedSystem?: RelatedSystem | null;
  attachments?: Attachment[];
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

export async function checkHealth(): Promise<{ status: string }> {
  const res = await fetch(`${API_URL}/api/health`);
  if (!res.ok) {
    throw new Error("Unable to connect to TokTickIT API");
  }
  return res.json();
}

export async function getCategories(): Promise<Category[]> {
  const res = await fetch(`${API_URL}/api/categories`);
  if (!res.ok) {
    throw new Error("Unable to connect to TokTickIT API");
  }
  return res.json();
}

export async function getRelatedSystems(): Promise<RelatedSystem[]> {
  const res = await fetch(`${API_URL}/api/related-systems`);
  if (!res.ok) {
    throw new Error("Failed to fetch related systems");
  }
  return res.json();
}

export async function getDevRequesters(): Promise<DevRequester[]> {
  const res = await fetch(`${API_URL}/api/dev-requesters`);
  if (!res.ok) {
    throw new Error("Failed to fetch development requesters");
  }
  return res.json();
}

export async function createTicket(formData: FormData, requesterId: string): Promise<Ticket> {
  const res = await fetch(`${API_URL}/api/tickets`, {
    method: "POST",
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

export async function checkSystem(): Promise<SystemStatus> {
  try {
    await checkHealth();
    const categories = await getCategories();
    return { online: true, categories };
  } catch (error) {
    throw new Error("Unable to connect to TokTickIT API");
  }
}
