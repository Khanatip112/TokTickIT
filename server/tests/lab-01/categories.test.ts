import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("GET /api/categories", () => {
  it("returns the four seeded categories", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(4);
    const categoryNames = res.body.map((c: any) => c.name);
    expect(categoryNames).toContain("Account and Access");
    expect(categoryNames).toContain("Hardware");
    expect(categoryNames).toContain("Software");
    expect(categoryNames).toContain("Network");
  });
});
