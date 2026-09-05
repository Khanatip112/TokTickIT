import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";
import { RequesterProvider } from "../../src/context/RequesterContext.js";
import React from "react";

describe("App Component", () => {
  it("renders the TokTickIT header heading", async () => {
    render(
      <RequesterProvider>
        <App />
      </RequesterProvider>
    );
    expect((await screen.findAllByText(/TokTickIT/i)).length).toBeGreaterThan(0);
  });
});
