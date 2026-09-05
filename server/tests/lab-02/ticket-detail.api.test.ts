import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Ticket Detail & Soft Removal APIs", () => {
  let userAId: string;
  let userBId: string;
  let ticketAId: string;
  let attachmentActiveId: string;

  beforeEach(async () => {
    const prisma = getPrisma();
    const activeUsers = await prisma.requesterUser.findMany({ where: { isActive: true }, take: 2 });
    userAId = activeUsers[0].id;
    userBId = activeUsers[1].id;

    const category = await prisma.category.findFirst();

    // Create a ticket for User A with an active attachment
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-TEST-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        requesterId: userAId,
        categoryId: category!.id,
        requestedPriority: "MEDIUM",
        currentStatus: "NEW",
        summary: "Test Ticket for Detail View",
        description: "Test ticket description details.",
        attachments: {
          create: {
            fileName: "test_doc.pdf",
            filePath: "uploads/test_doc.pdf",
            fileSize: 1024,
            mimeType: "application/pdf",
            isRemoved: false,
          },
        },
      },
      include: { attachments: true },
    });

    ticketAId = ticket.id;
    attachmentActiveId = ticket.attachments[0].id;
  });

  it("GET /api/tickets/:id returns ticket detail for owner (User A)", async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketAId}`)
      .set("x-dev-requester-id", userAId);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ticketAId);
    expect(res.body.summary).toBe("Test Ticket for Detail View");
  });

  it("GET /api/tickets/:id returns 403 Forbidden for non-owner (User B)", async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketAId}`)
      .set("x-dev-requester-id", userBId);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Forbidden/i);
  });

  it("DELETE /api/attachments/:id soft-removes attachment with valid removalReason", async () => {
    const res = await request(app)
      .delete(`/api/attachments/${attachmentActiveId}`)
      .set("x-dev-requester-id", userAId)
      .send({ removalReason: "Uploaded wrong version of diagnostic log" });

    expect(res.status).toBe(200);
    expect(res.body.isRemoved).toBe(true);
    expect(res.body.removalReason).toBe("Uploaded wrong version of diagnostic log");
    expect(res.body.removedAt).toBeDefined();
  });

  it("DELETE /api/attachments/:id returns 400 Bad Request when removalReason is missing", async () => {
    const res = await request(app)
      .delete(`/api/attachments/${attachmentActiveId}`)
      .set("x-dev-requester-id", userAId)
      .send({ removalReason: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/removalReason/i);
  });

  it("GET /api/attachments/:id/download returns 403 Forbidden if file is soft-removed", async () => {
    // Soft-remove the attachment first
    await request(app)
      .delete(`/api/attachments/${attachmentActiveId}`)
      .set("x-dev-requester-id", userAId)
      .send({ removalReason: "Removing for download block test" });

    // Attempt to download
    const res = await request(app)
      .get(`/api/attachments/${attachmentActiveId}/download`)
      .set("x-dev-requester-id", userAId);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/soft-removed/i);
  });
});
