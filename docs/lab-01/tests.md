# Lab 1 — Test Plan and Evidence

All test files live under `server/tests/lab-01/` and `client/tests/lab-01/`.

| Test File | Tool | Test | Result |
|---|------|------|--------|
| health.test.ts | Supertest | GET /api/health returns 200, status=ok | PASS |
| categories.test.ts | Supertest | GET /api/categories returns 4 seeded categories in id order | PASS |
| App.test.tsx | Vitest | Heading renders | PASS |
| App.test.tsx | Vitest | Success state shows Online + category list | PASS |
| App.test.tsx | Vitest | Error state shows Offline + message | PASS |

### Terminal Output (Screenshot will be included in lab report PDF)

```
PS ...\toktickit> cd server
PS ...\toktickit\server> npm run test

> toktickit-server@1.0.0 test
> vitest run


 RUN  v2.1.9 .../toktickit/server

 ✓ tests/lab-01/categories.test.ts (1)
 ✓ tests/lab-01/health.test.ts (1)

 Test Files  2 passed (2)
      Tests  2 passed (2)
   Start at  14:08:03
   Duration  992ms (transform 84ms, setup 0ms, collect 636ms, tests 102ms, environment 0ms, prepare 381ms)
```

```
PS ...\toktickit> cd client
PS ...\toktickit\client> npm run test

> toktickit-client@1.0.0 test
> vitest run


 RUN  v2.1.9 .../toktickit/client

 ✓ tests/lab-01/App.test.tsx (3)
   ✓ App (3)
     ✓ renders the TokTickIT heading
     ✓ shows Online and the seeded categories on success
     ✓ shows an Offline error message when the API is unavailable

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  14:12:02
   Duration  20.60s (transform 106ms, setup 2.91s, collect 2.09s, tests 126ms, environment 14.38s, prepare 546ms)
```