import tseslint from "typescript-eslint";

/**
 * Minimal ESLint flat config (Issue 9 — code quality verification).
 *
 * Applies `typescript-eslint` recommended rules (non type-aware so it stays
 * fast) to every TypeScript/JavaScript file in the monorepo. Build outputs,
 * dependencies, generated artifacts, and Playwright reports are ignored.
 */
export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "artifacts/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Playwright fixtures and Prisma callbacks frequently need positional
      // parameters even when unused, so only flag bound variables.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { args: "none", argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Vitest/Supertest response bodies are untyped (`res.body: any`) and the
    // seed script bridges loose Prisma input shapes, so explicit `any` is
    // accepted in tests and seed tooling only. Application source stays strict.
    files: ["**/*.test.{ts,tsx}", "server/prisma/seed.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
);
