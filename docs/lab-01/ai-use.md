# Lab 1 — AI Use and Reflection

**LLM/agent used:** Antigravity for coding agent with Gemini 3.6 Flash (Medium) and Gemini (Chatbot) for general knowledge and guide my workflow to save token usage. 

## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | How to resolve a Git non-fast-forward push rejection involving branch case mismatches? | Executed git pull origin Lab1-staging --rebase to integrate remote commits before pushing lab1-staging to Lab1-staging. |
| 2 | How to initialize a full-stack project scaffold with React, Express, TypeScript, Bootstrap, and Prisma matching the required directory structure? | Set up the repository structure for client and server folders, installed dependencies, and configured .gitignore and .env.example. |
| 3 | How to implement the GET /api/health Express route and write a Supertest assertion to verify HTTP 200 response? | Created the health check endpoint in app.ts and added unit test cases in tests/lab-01/health.test.ts to verify API availability. |
| 4 | How to define the Prisma Category model, create database migrations, and write a re-runnable seed script for the four IT categories? | Configured schema.prisma, ran npx prisma db push, and populated the PostgreSQL database using npx prisma db seed. |
| 5 | How to query Prisma categories in Express, build a React UI handling loading/success/error states, and activate Vitest test assertions? | Implemented /api/categories, refactored App.tsx with a Bootstrap table layout, removed .skip from App.test.tsx, and completed peer review docs. |
| 6 | How to fix a Pull Request accidentally targeted at main instead of the integration branch lab1-staging. | Base branch was changed in the GitHub PR settings from main to lab1-staging to enforce the required Git Flow. |


## Reflection
Working with Antigravity and Gemini was a great hands-on experience. I learned that without clear prompt boundaries, the AI can go overboard—building future features early, wasting tokens, and messing up my Kanban flow.To manage this, I used Gemini Chatbot for workflow advice and quick fixes (like Git casing and PR target errors), saving Antigravity purely for step-by-step coding. Prompting one issue at a time worked much better.I also had to spend extra time on AI and YouTube to grasp some tough technical concepts, which made me realize how much I still need to learn.