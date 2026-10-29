import { defineConfig, mergeConfig } from "vite";
import { defineConfig as defineVitestConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default mergeConfig(
  defineConfig({
    plugins: [react()],
    server: { port: 5173 },
  }),
  defineVitestConfig({
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./tests/setup.ts",
      include: ["tests/**/*.test.tsx", "src/tests/**/*.test.tsx"],
    },
  })
);