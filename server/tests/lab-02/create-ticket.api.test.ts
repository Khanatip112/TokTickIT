import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("POST /api/tickets", () => {
  it("creates a ticket with valid inputs and auto ticket number TKT-2026-XXXXXX", async () => {
    const prisma = getPrisma();
    const activeUser = await prisma.requesterUser.findFirst({ where: { isActive: true } });
    const category = await prisma.category.findFirst();
    const system = await prisma.relatedSystem.findFirst();

    expect(activeUser).toBeDefined();
    expect(category).toBeDefined();

    const res = await request(app)
      .post("/api/tickets")
      .set("x-dev-requester-id", activeUser!.id)
      .field("requesterId", activeUser!.id)
      .field("categoryId", category!.id)
      .field("relatedSystemId", system?.id || "")
      .field("requestedPriority", "HIGH")
      .field("summary", "Laptop screen flickering on battery")
      .field("description", "The laptop screen flickers constantly whenever running on battery power.");

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.ticketNumber).toMatch(/^TKT-2026-\d{6}$/);
    expect(res.body.currentStatus).toBe("NEW");
    expect(res.body.summary).toBe("Laptop screen flickering on battery");
    expect(res.body.requesterId).toBe(activeUser!.id);
    expect(res.body.category.id).toBe(category!.id);
  });

  it("returns 400 Bad Request when summary is under 5 characters", async () => {
    const prisma = getPrisma();
    const activeUser = await prisma.requesterUser.findFirst({ where: { isActive: true } });
    const category = await prisma.category.findFirst();

    const res = await request(app)
      .post("/api/tickets")
      .set("x-dev-requester-id", activeUser!.id)
      .field("requesterId", activeUser!.id)
      .field("categoryId", category!.id)
      .field("requestedPriority", "MEDIUM")
      .field("summary", "Bad")
      .field("description", "Description long enough for test validation.");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Summary/i);
  });

  it("returns 403 Forbidden when requester is inactive", async () => {
    const prisma = getPrisma();
    const inactiveUser = await prisma.requesterUser.findFirst({ where: { isActive: false } });
    const category = await prisma.category.findFirst();

    expect(inactiveUser).toBeDefined();

    const res = await request(app)
      .post("/api/tickets")
      .set("x-dev-requester-id", inactiveUser!.id)
      .field("requesterId", inactiveUser!.id)
      .field("categoryId", category!.id)
      .field("requestedPriority", "LOW")
      .field("summary", "Test ticket with inactive user")
      .field("description", "Testing that inactive requester cannot create ticket.");

    expect(res.status).toBe(403);
  });

  it("accepts valid PDF file attachment", async () => {
    const prisma = getPrisma();
    const activeUser = await prisma.requesterUser.findFirst({ where: { isActive: true } });
    const category = await prisma.category.findFirst();

    const res = await request(app)
      .post("/api/tickets")
      .set("x-dev-requester-id", activeUser!.id)
      .field("requesterId", activeUser!.id)
      .field("categoryId", category!.id)
      .field("requestedPriority", "LOW")
      .field("summary", "Testing attachment upload functionality")
      .field("description", "Detailed problem description with attached test file.")
      .attach("attachments", Buffer.from("%PDF-1.4 test pdf content"), "test_log.pdf");

    expect(res.status).toBe(201);
    expect(res.body.attachments.length).toBe(1);
    expect(res.body.attachments[0].fileName).toBe("test_log.pdf");
    expect(res.body.attachments[0].isRemoved).toBe(false);
  });
});
