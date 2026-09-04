import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("GET /api/dev-requesters", () => {
  it("returns 200 OK with only active development requesters", async () => {
    const res = await request(app).get("/api/dev-requesters");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    // Verify inactive user is excluded
    const inactiveUser = res.body.find(
      (user: any) => user.email === "inactive.test@kmutt.ac.th"
    );
    expect(inactiveUser).toBeUndefined();

    // Verify fields returned
    const firstUser = res.body[0];
    expect(firstUser).toHaveProperty("id");
    expect(firstUser).toHaveProperty("name");
    expect(firstUser).toHaveProperty("email");
    expect(firstUser).toHaveProperty("department");
  });
});
