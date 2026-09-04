import { PrismaClient } from "@prisma/client";

/**
 * Auto-generates a unique Ticket Number formatted as TKT-2026-XXXXXX
 */
export async function generateTicketNumber(prisma: PrismaClient): Promise<string> {
  const count = await prisma.ticket.count();
  let nextNum = count + 1;
  let ticketNumber = `TKT-2026-${String(nextNum).padStart(6, "0")}`;

  while (await prisma.ticket.findUnique({ where: { ticketNumber } })) {
    nextNum += 1;
    ticketNumber = `TKT-2026-${String(nextNum).padStart(6, "0")}`;
  }

  return ticketNumber;
}

/**
 * Validates file MIME types and size (Max 5MB)
 */
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export function validateFileMetadata(mimeType: string, sizeBytes: number): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `Invalid file type: ${mimeType}. Only JPG, PNG, WEBP, and PDF files are allowed.`,
    };
  }
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds maximum 5MB limit (${(sizeBytes / (1024 * 1024)).toFixed(2)}MB).`,
    };
  }
  return { valid: true };
}
