# Lab 4 Test Plan, Traceability Matrix & Verification Specification
## TokTickIT Actions Taken, Dashboards, Resolution Gate, and Regression

---

## 1. Test Strategy & Architectural Levels

TokTickIT Sprint 4 extends the multi-tiered testing strategy to validate Actions Taken CRUD operations, Resolution Gate enforcement, role-tailored dashboard metric computations, interactive drill-down navigation, and full backward compatibility across Labs 1–3.

### 1.1. Testing Tiers

1. **Backend Unit & Utility Tests**:
   - Action result enum validation utilities.
   - Follow-up conditional logic (`followUpRequired` → `followUpNote` mandate).
   - Dashboard metric aggregation helper functions.
   - Status transition state machine with Resolution Gate integration.
2. **Backend API Integration Tests (`server/tests/lab-04/`)**:
   - `actions-taken.api.test.ts`: CRUD operations, field validation, RBAC enforcement, performer auto-derivation, follow-up conditional rules.
   - `ticket-workflow.api.test.ts`: Resolution Gate enforcement on `RESOLVED` and `CLOSED` transitions, interaction with Actions Taken count.
   - `requester-dashboard.api.test.ts`: Requester metric calculations, scope isolation to owned tickets.
   - `staff-dashboard.api.test.ts`: IT Staff metric calculations, unassigned/assigned/urgent counts, admin-extended user summary.
3. **Frontend Component & Workflow Tests (`client/tests/lab-04/`)**:
   - `ActionsTakenList.test.tsx`: Timeline rendering, result badges, follow-up callout, attachment notes display.
   - `ActionsTakenForm.test.tsx`: Form validation, conditional follow-up note field, performer read-only display, submit/cancel interaction.
   - `RequesterDashboard.test.tsx`: Metric card rendering, drill-down link generation, recent tickets list.
   - `StaffDashboard.test.tsx`: KPI cards rendering, drill-down navigation URLs, quick actions panel, urgent ticket table.
4. **End-to-End Playwright Tests (`e2e/lab-04/`)**:
   - `actions-taken.spec.ts`: Full cycle of recording, viewing, and editing Actions Taken from Ticket Detail view.
   - `resolution-gate.spec.ts`: Verifying that RESOLVED/CLOSED transitions are blocked without Actions Taken, and succeed after recording one.
   - `requester-dashboard.spec.ts`: Requester logs in, views dashboard metrics, clicks drill-down, verifies filtered ticket list.
   - `staff-dashboard.spec.ts`: IT Staff logs in, views dashboard metrics, clicks metric cards, verifies queue filtering.
   - `regression.spec.ts`: Full Lab 1–3 regression validating ticket creation, attachments, authentication, queue, and admin flows.
5. **Responsive Visual Verification**:
   - Desktop (≥ 1280px), Tablet (768px–1024px), and Mobile (< 768px) screenshots captured via Playwright for Actions Taken, Requester Dashboard, and IT Staff Dashboard views.

---

## 2. Acceptance Criteria to Test ID Traceability Matrix

| AC ID | Acceptance Criterion Description | Test IDs |
| :--- | :--- | :--- |
| **AC-01** | IT Staff creates ActionTaken with auto-derived `performedBy`; returns 201 Created. | API-01, API-02, UI-02, E2E-01 |
| **AC-02** | Validation rejects `followUpRequired: true` without `followUpNote`; returns 400. | API-03, UI-02, E2E-01 |
| **AC-03** | Requester blocked from creating ActionTaken; returns 403 Forbidden. | API-04, E2E-01 |
| **AC-04** | Requester views ActionTaken list on owned ticket; returns 200 OK. | API-05, UI-01, E2E-01 |
| **AC-05** | Requester blocked from viewing ActionTaken on another user's ticket; returns 403. | API-06, E2E-01 |
| **AC-06** | Resolution Gate blocks RESOLVED transition with 0 Actions Taken; returns 422. | API-09, API-10, E2E-02 |
| **AC-07** | Resolution Gate allows RESOLVED transition with ≥ 1 Action Taken + resolution summary; returns 200. | API-11, E2E-02 |
| **AC-08** | Requester dashboard returns accurate counts scoped to owned tickets only. | API-12, API-13, UI-03, E2E-03 |
| **AC-09** | IT Staff dashboard returns accurate global queue metrics. | API-14, API-15, UI-04, E2E-04 |
| **AC-10** | Clicking a dashboard KPI card navigates to filtered queue/ticket view. | UI-03, UI-04, E2E-03, E2E-04 |

---

## 3. Planned Test Suite Table

### 3.1. Backend Unit Tests

| Test ID | Level / Type | Target AC / BR | What It Tests | Expected Result | Automated Test File Path | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **UNIT-01** | Unit | BR-04 | Follow-up conditional validation logic. | Rejects `followUpRequired: true` with empty `followUpNote`; accepts when `followUpNote` provided. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| **UNIT-02** | Unit | BR-05 | Action result enum validation. | Accepts `SUCCESS`, `PARTIAL`, `PENDING`, `FAILED`; rejects invalid values like `UNKNOWN`. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| **UNIT-03** | Unit | BR-08, BR-09 | Status transition machine with Resolution Gate check. | Validates permitted transitions and blocks RESOLVED/CLOSED when Actions Taken count is 0. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |

### 3.2. Backend API Integration Tests

| Test ID | Level / Type | Target AC / BR | What It Tests | Expected Result | Automated Test File Path | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **API-01** | API | AC-01, FR-03, BR-03 | Create ActionTaken with valid payload as IT Staff (`POST /api/tickets/:id/actions-taken`). | HTTP 201 Created; `performedById` matches session user; all fields persisted correctly. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| **API-02** | API | AC-01, BR-03 | Auto-derivation of `performedById` ignoring client-supplied value. | `performedBy.id` in response always matches `req.session.userId`, regardless of request body. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| **API-03** | API | AC-02, BR-04 | Conditional follow-up note validation. | 400 Bad Request when `followUpRequired: true` and `followUpNote` is missing or empty. Succeeds when `followUpNote` is provided. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| **API-04** | API | AC-03, FR-06 | Requester blocked from creating ActionTaken. | HTTP 403 Forbidden. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| **API-05** | API | AC-04, FR-06 | Requester lists ActionTaken for owned ticket (`GET /api/tickets/:id/actions-taken`). | HTTP 200 OK with chronological list of actions. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| **API-06** | API | AC-05, BR-07 | Requester blocked from viewing ActionTaken on non-owned ticket. | HTTP 403 Forbidden. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| **API-07** | API | FR-05 | IT Staff updates own ActionTaken (`PUT /api/actions-taken/:actionId`). | HTTP 200 OK; updated fields reflected; `performedById` unchanged. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| **API-08** | API | FR-05 | IT Staff blocked from updating another staff's ActionTaken (non-admin). | HTTP 403 Forbidden. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| **API-09** | API | AC-06, BR-09 | Resolution Gate: RESOLVED transition with 0 Actions Taken. | HTTP 422 Unprocessable Entity: `"Cannot resolve or close a ticket without at least one recorded Action Taken."` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| **API-10** | API | AC-06, BR-09 | Resolution Gate: CLOSED transition with 0 Actions Taken. | HTTP 422 Unprocessable Entity. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| **API-11** | API | AC-07, BR-09 | Resolution Gate: RESOLVED transition with ≥ 1 Action Taken and valid summary. | HTTP 200 OK; status updated to RESOLVED. | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| **API-12** | API | AC-08, BR-12 | Requester dashboard metrics accuracy (`GET /api/dashboards/requester`). | All counts (`totalOpenTickets`, `waitingForRequesterCount`, etc.) match expected values scoped to owned tickets. | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| **API-13** | API | AC-08, BR-12 | Requester dashboard recent tickets limited to 5, ordered by `updatedAt DESC`. | `recentTickets` array contains at most 5 entries, all owned by the requester. | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| **API-14** | API | AC-09, BR-13 | IT Staff dashboard metrics accuracy (`GET /api/dashboards/staff`). | `unassignedCount`, `assignedToMeCount`, `urgentPriorityCount`, `inProgressCount`, `waitingRequesterCount`, `resolvedTodayCount` all match expected values. | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| **API-15** | API | AC-09, BR-13 | IT Staff dashboard recent tickets ordering. | `recentTickets` ordered by `itPriority DESC, updatedAt DESC`, limited to 5. | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| **API-16** | API | BR-14 | Administrator dashboard includes `userSummary` metrics. | Response includes `activeRequestersCount`, `activeStaffCount`, `totalUsersCount`. | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| **API-17** | API | FR-06 | Requester blocked from accessing IT Staff dashboard. | HTTP 403 Forbidden on `GET /api/dashboards/staff`. | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| **API-18** | API | FR-02 | Validation rejects `description` exceeding 1000 characters. | HTTP 400 Bad Request with field-level error. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |
| **API-19** | API | BR-06 | Validation rejects `attachmentNotes` exceeding 500 characters. | HTTP 400 Bad Request with field-level error. | `server/tests/lab-04/actions-taken.api.test.ts` | Planned |

### 3.3. Frontend Component Tests

| Test ID | Level / Type | Target AC / BR | What It Tests | Expected Result | Automated Test File Path | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **UI-01** | Component | AC-04 | Actions Taken list rendering on Ticket Detail. | Renders chronological action cards with `actionDateTime`, result badge, performer badge, description, follow-up callout (if applicable), and attachment notes. | `client/tests/lab-04/ActionsTakenList.test.tsx` | Planned |
| **UI-02** | Component | AC-01, AC-02 | Actions Taken form modal validation and submission. | Renders form with read-only performer field, required description, result dropdown, conditional follow-up note, and validates before submit. Shows spinner on save. | `client/tests/lab-04/ActionsTakenForm.test.tsx` | Planned |
| **UI-03** | Component | AC-08, AC-10 | Requester Dashboard metric cards rendering and drill-down. | Renders 4 KPI metric cards with correct values. Drill-down links generate proper query-filtered URLs. Recent tickets list displays with status badges. | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| **UI-04** | Component | AC-09, AC-10 | IT Staff Dashboard metric cards rendering and drill-down. | Renders 5 KPI metric cards with correct values. Drill-down links generate `/staff/queue?...` URLs. Quick actions panel and urgent tickets table render correctly. | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| **UI-05** | Component | BR-05 | Action result badge color coding. | `SUCCESS` renders green, `PARTIAL` renders blue, `PENDING` renders amber, `FAILED` renders red, matching design tokens in `ui-spec.md`. | `client/tests/lab-04/ActionsTakenList.test.tsx` | Planned |
| **UI-06** | Component | FR-11 | Role-aware navigation bar updates. | Navigation bar shows "Dashboard" link for all roles, "My Queue" for IT Staff, "My Tickets" for Requesters. | `client/tests/lab-04/Header.test.tsx` | Planned |

### 3.4. End-to-End Playwright Tests

| Test ID | Level / Type | Target AC / BR | What It Tests | Expected Result | Automated Test File Path | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **E2E-01** | Playwright | AC-01, AC-02, AC-03, AC-04 | Complete Actions Taken lifecycle. | IT Staff opens ticket detail, clicks "Record Action Taken", fills form, saves. Action appears in timeline. Requester views same ticket and sees the action in read-only mode. Requester is blocked from recording actions. | `e2e/lab-04/actions-taken.spec.ts` | Planned |
| **E2E-02** | Playwright | AC-06, AC-07 | Resolution Gate end-to-end flow. | IT Staff attempts to resolve a ticket with 0 actions (blocked with error). Staff records an action, re-attempts resolve (succeeds). | `e2e/lab-04/resolution-gate.spec.ts` | Planned |
| **E2E-03** | Playwright | AC-08, AC-10 | Requester Dashboard full interaction. | Requester logs in, navigates to dashboard, verifies metric card values, clicks "My Open Tickets" card, lands on filtered My Tickets view. | `e2e/lab-04/requester-dashboard.spec.ts` | Planned |
| **E2E-04** | Playwright | AC-09, AC-10 | IT Staff Dashboard full interaction. | IT Staff logs in, navigates to dashboard, verifies metric card values (Unassigned, Assigned to Me, Urgent), clicks "Unassigned" card, lands on `/staff/queue?ownerId=unassigned`. | `e2e/lab-04/staff-dashboard.spec.ts` | Planned |
| **E2E-05** | Playwright | All Labs | Full system regression validation. | Complete regression covering: Lab 1 categories/systems, Lab 2 ticket creation/attachments, Lab 3 auth/queue/admin. All prior functionality works without regressions. | `e2e/lab-04/regression.spec.ts` | Planned |

### 3.5. Responsive Visual Verification Screenshots

| Screenshot ID | Viewport | View / Page | Verified Aspect | Automated Capture File |
| :--- | :--- | :--- | :--- | :--- |
| **VIS-01** | Desktop (1920×1080) | IT Staff Dashboard | 5-column KPI grid, split panel layout, urgent tickets table. | `e2e/lab-04/staff-dashboard.spec.ts` |
| **VIS-02** | Tablet (768×1024) | IT Staff Dashboard | 2–3 column wrapped KPI cards, stacked panels. | `e2e/lab-04/staff-dashboard.spec.ts` |
| **VIS-03** | Mobile (375×667) | IT Staff Dashboard | Single-column stacked cards, no horizontal overflow. | `e2e/lab-04/staff-dashboard.spec.ts` |
| **VIS-04** | Desktop (1920×1080) | Requester Dashboard | 4-column KPI grid, recent tickets list, quick actions. | `e2e/lab-04/requester-dashboard.spec.ts` |
| **VIS-05** | Tablet (768×1024) | Requester Dashboard | 2-column wrapped KPI cards, stacked layout. | `e2e/lab-04/requester-dashboard.spec.ts` |
| **VIS-06** | Mobile (375×667) | Requester Dashboard | Single-column stacked cards. | `e2e/lab-04/requester-dashboard.spec.ts` |
| **VIS-07** | Desktop (1920×1080) | Actions Taken (Ticket Detail) | Full-width timeline cards with inline badges and edit buttons. | `e2e/lab-04/actions-taken.spec.ts` |
| **VIS-08** | Tablet (768×1024) | Actions Taken (Ticket Detail) | Responsive timeline cards, wrapping metadata. | `e2e/lab-04/actions-taken.spec.ts` |
| **VIS-09** | Mobile (375×667) | Actions Taken (Ticket Detail) | Stacked metadata above description, compact layout. | `e2e/lab-04/actions-taken.spec.ts` |
| **VIS-10** | Desktop (1920×1080) | Actions Taken Form Modal | Full modal with all form controls visible. | `e2e/lab-04/actions-taken.spec.ts` |
| **VIS-11** | Tablet (768×1024) | Actions Taken Form Modal | Responsive modal, stacked form controls. | `e2e/lab-04/actions-taken.spec.ts` |
| **VIS-12** | Mobile (375×667) | Actions Taken Form Modal | Full-screen drawer/modal, touch-friendly tap targets. | `e2e/lab-04/actions-taken.spec.ts` |

---

## 4. Regression Test Coverage

### 4.1. Lab 1 Regression
- Categories CRUD operations remain functional.
- Related Systems CRUD operations remain functional.
- All existing Lab 1 test suites pass without modification.

### 4.2. Lab 2 Regression
- Ticket creation with requester binding, category, and system association.
- Attachment upload, download, and soft-removal.
- My Tickets list with filtering and pagination.
- All existing Lab 2 test suites pass without modification.

### 4.3. Lab 3 Regression
- Authentication (login, logout, session, first-login password change).
- Authorization (RBAC, IDOR protection, internal note privacy).
- IT Staff Ticket Queue (search, filter, pagination, claim, assign, status transitions).
- Public Comments and Internal Notes.
- Administrator User Management (create, edit, deactivate, last admin protection).
- All existing Lab 3 test suites pass without modification.

### 4.4. Lab 4 New Functionality
- Actions Taken CRUD with all validation rules.
- Resolution Gate enforcement.
- Requester and IT Staff Dashboards with accurate metrics.
- Interactive drill-down navigation.

---

## 5. Test Environment Requirements

| Requirement | Specification |
| :--- | :--- |
| **Database** | PostgreSQL with fresh migration and seed data per test suite run. |
| **Test Runner (Backend)** | Vitest with `@prisma/client` test utilities. |
| **Test Runner (Frontend)** | Vitest with `@testing-library/react` and `jsdom`. |
| **E2E Framework** | Playwright with Chromium, Firefox, and WebKit. |
| **Seed Data** | At least: 3 users (Requester, IT Staff, Admin), 5 tickets in varied statuses, 3 ActionTaken records across different tickets. |
| **Viewport Sizes** | Desktop (1920×1080), Tablet (768×1024), Mobile (375×667). |

---

*Document version: 1.0 — 2026‑10‑15*
