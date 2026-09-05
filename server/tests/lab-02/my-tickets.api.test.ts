import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

describe("Dev Requesters API", () => {
  it("GET /api/dev-requesters returns active users and excludes inactive users", async () => {
    const res = await request(app).get("/api/dev-requesters");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    // Active requesters must be returned
    const activeEmails = res.body.map((r: any) => r.email);
    expect(activeEmails).toContain("jennifer.anderson@kmutt.ac.th");
    expect(activeEmails).toContain("david.lee@kmutt.ac.th");

    // Inactive requester must be excluded
    expect(activeEmails).not.toContain("inactive.test@kmutt.ac.th");
  });
});

describe("My Tickets API (Data Isolation)", () => {
  let userAId: string;
  let userBId: string;
  let ticketAId: string;
  let ticketBId: string;

  beforeEach(async () => {
    const prisma = getPrisma();
    const activeUsers = await prisma.requesterUser.findMany({ where: { isActive: true }, take: 2 });
    userAId = activeUsers[0].id;
    userBId = activeUsers[1].id;

    const category = await prisma.category.findFirst();

    // Create ticket for User A
    const ticketA = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-ISO-A-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        requesterId: userAId,
        categoryId: category!.id,
        requestedPriority: "HIGH",
        currentStatus: "NEW",
        summary: "User A Isolation Test Ticket",
        description: "Description for User A ticket isolation test.",
      },
    });
    ticketAId = ticketA.id;

    // Create ticket for User B
    const ticketB = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-ISO-B-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        requesterId: userBId,
        categoryId: category!.id,
        requestedPriority: "LOW",
        currentStatus: "NEW",
        summary: "User B Isolation Test Ticket",
        description: "Description for User B ticket isolation test.",
      },
    });
    ticketBId = ticketB.id;
  });

  it("GET /api/tickets enforces data isolation: User A sees ONLY User A tickets", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("x-dev-requester-id", userAId);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const ticketIds = res.body.map((t: any) => t.id);
    expect(ticketIds).toContain(ticketAId);
    expect(ticketIds).not.toContain(ticketBId);
  });

  it("GET /api/tickets enforces data isolation: User B sees ONLY User B tickets", async () => {
    const res = await request(app)
      .get("/api/tickets")
      .set("x-dev-requester-id", userBId);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const ticketIds = res.body.map((t: any) => t.id);
    expect(ticketIds).toContain(ticketBId);
    expect(ticketIds).not.toContain(ticketAId);
  });

  it("GET /api/tickets returns 403 Forbidden when requester header is missing", async () => {
    const res = await request(app).get("/api/tickets");
    expect(res.status).toBe(403);
  });
});
