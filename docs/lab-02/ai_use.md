# Lab 2 — AI Use and Reflection

**LLM/agent used:** Antigravity for coding agent with Gemini 3.6 Flash (Medium) and Gemini (Chatbot) for general knowledge and guide my workflow to save token usage.

## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | How to resolve Playwright E2E test failures caused by strict mode locator violations when verifying ticket submission? | Updated locator assertions in `requester-ticket-flow.spec.ts` using `.first()` to target the primary success message without element collisions. |
| 2 | How to handle file uploads in Playwright E2E tests without encountering Node.js `Buffer` type definition leaks in TypeScript? | Used `TextEncoder().encode()` to create browser-compatible buffer payloads for PDF attachment uploads. |
| 3 | How to fix Vitest component test failure in `CreateTicketForm.test.tsx` when standard `<select>` options fail to trigger JSDOM `onChange` events? | Adjusted test event firing logic by toggling select option indices to properly trigger React synthetic state re-renders. |
| 4 | How to resolve Prisma `EPERM: operation not permitted` file-lock errors on `query_engine-windows.dll.node` on Windows? | Terminated active Node.js processes using `taskkill /F /IM node.exe`, reset the database with `npx prisma db push --force-reset`, and re-seeded. |
| 5 | How to fix Vite esbuild syntax errors caused by leftover Git merge conflict markers (`<<<<<<< HEAD`, `=======`) in `client/src/api.ts`? | Removed Git markers manually, unified error status handling logic, and verified Vite hot-reload server stability. |
| 6 | How to automate responsive viewport screenshots across Desktop, Tablet, and Mobile viewports in Playwright E2E tests? | Configured `page.setViewportSize()` across 1280x800, 834x1112, and 375x812 dimensions to store artifacts in `artifacts/lab-02/screenshots/`. |
| 7 | How to fix `TypeError: Cannot read properties of undefined (reading 'findMany')` when Prisma Client fails to reflect updated Lab 2 schema? | Cleared Prisma cache in `node_modules\.prisma`, ran `npx prisma generate`, and executed `npx prisma db seed` to align database relations. |
| 8 | How to perform a clean branch synchronization with `origin/Lab2-staging` when local tracking branches get corrupted by failed merge conflicts? | Executed `git fetch origin`, `git checkout Lab2-staging`, and `git reset --hard origin/Lab2-staging` to restore a clean working tree. |

## Reflection
Using more tokens in this lab led to deeper chatbot interactions, forcing me to build a stronger self-understanding. Learning step-by-step takes longer, but ensures true comprehension. Additionally, my prompting skills improved as I learned to formulate more detailed prompts.