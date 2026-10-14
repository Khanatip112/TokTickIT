# Lab 3 Test Plan, Traceability Matrix & Verification Specification
## TokTickIT Authentication, RBAC, IT Staff Ticketing, and Admin Screens

---

## 1. Test Strategy & Architectural Levels

TokTickIT Sprint 3 enforces a rigorous, multi-tiered testing strategy designed to validate role-based security boundaries, first-login password barriers, data migration integrity, IT triage workflows, confidential operational notes, and administrative safety invariants.

### 1.1. Testing Tiers
1. **Backend Unit & Utility Tests**:
   - Cryptographic password hashing and verification (`bcrypt`).
   - Password complexity validator functions.
   - Permitted ticket status transition state machine engine.
2. **Backend API Integration Tests (`server/tests/lab-03/`)**:
   - `auth.api.test.ts`: Login, logout, current user, first-login mandatory password change, inactive account handling.
   - `authorization.api.test.ts`: Role-based route guarding, IDOR ticket protection, password-change wall enforcement.
   - `staff-queue.api.test.ts`: Queue retrieval, search, multi-field filtering, sorting, and pagination.
   - `staff-ticket-detail.api.test.ts`: Ticket claiming, reassignment, IT Priority updates, status transitions, and resolution summaries.
   - `comments-notes.api.test.ts`: Public comment streams vs confidential internal notes access and validation.
   - `users-admin.api.test.ts`: Administrator user management, search, role filtering, duplicate email conflict, self-deactivation prevention, and last active admin protection.
3. **Frontend Component & Workflow Tests (`client/tests/lab-03/`)**:
   - `Login.test.tsx`: Login form rendering, password visibility toggle, inline validation, and error banner display.
   - `ChangePassword.test.tsx`: Mandatory password change prompt, dynamic password strength checklist, submission busy state.
   - `StaffTicketQueue.test.tsx`: Queue table rendering, filter toggle, status/priority badges, search debounce, pagination navigation.
   - `StaffTicketDetail.test.tsx`: Detail view, claim/reassign triggers, IT priority select, permitted status dropdown, tab switching between Public Comments and Internal Notes.
   - `UserManagement.test.tsx`: User directory table, Create User drawer, role assignment, active switch, self-deactivation button lock.
4. **End-to-End Playwright Tests (`e2e/lab-03/`)**:
   - `authentication.spec.ts`: Full login, first-login mandatory password change flow, logout, and protected route access prevention.
   - `staff-ticket-flow.spec.ts`: End-to-end IT Staff workflow: search queue, open detail, claim ticket, update priority, post internal note, transition to Resolved with summary.
   - `user-administration.spec.ts`: Admin creates user, attempts duplicate email (blocked), verifies self-deactivation prevention, resets user password.
5. **Database Migration & Regression Tests**:
   - Automated verification that Lab 2 tickets, categories, systems, and attachments remain 100% accessible after migrating to the Lab 3 schema.

---

## 2. Planned Test Suite Table

| Test ID | Level / Type | Target AC / Req | What It Tests | Expected Result | Automated Test File Path | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **UNIT-01** | Unit | BR-03 | Password complexity validator utility. | Rejects short or weak passwords; accepts valid passwords with upper, lower, number, special char. | `server/tests/lab-03/auth.api.test.ts` | Planned |
| **UNIT-02** | Unit | BR-15 | Status transition state machine evaluator. | Validates permitted transitions (e.g. `NEW` -> `OPEN`); rejects illegal jumps (e.g. `NEW` -> `RESOLVED`). | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| **API-01** | API | AC-01, BR-01 | Valid user credentials authentication (`POST /api/auth/login`). | HTTP 200 OK; sets session cookie; returns safe user profile with role. | `server/tests/lab-03/auth.api.test.ts` | Planned |
| **API-02** | API | AC-03, BR-01 | Invalid password / unknown email login attempt. | HTTP 401 Unauthorized with safe message `"Invalid email or password."`. | `server/tests/lab-03/auth.api.test.ts` | Planned |
| **API-03** | API | AC-04, BR-01 | Deactivated user (`isActive = false`) login attempt. | HTTP 401 Unauthorized with safe message without revealing account existence. | `server/tests/lab-03/auth.api.test.ts` | Planned |
| **API-04** | API | AC-02, BR-02 | Operational endpoint access when `requiresPasswordChange = true`. | HTTP 403 Forbidden with error code `PASSWORD_CHANGE_REQUIRED`. | `server/tests/lab-03/auth.api.test.ts` | Planned |
| **API-05** | API | AC-02, BR-02 | First-login password change (`POST /api/auth/change-password`). | Updates password hash, clears `requiresPasswordChange` flag, returns 200 OK. | `server/tests/lab-03/auth.api.test.ts` | Planned |
| **API-06** | API | FR-05, FR-06 | Current user retrieval (`GET /api/auth/me`) and Logout (`POST /api/auth/logout`). | Retrieves session profile; logout destroys session and clears cookie. | `server/tests/lab-03/auth.api.test.ts` | Planned |
| **API-07** | API | AC-05, BR-07 | Requester ticket submission identity binding. | Backend assigns `requesterId` from session; ignores client-supplied requester ID. | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| **API-08** | API | AC-06, BR-08 | Cross-requester ticket and attachment isolation (IDOR check). | Non-owner Requester accessing foreign ticket or attachment receives 403 Forbidden. | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| **API-09** | API | AC-07, BR-09 | Requester access to Internal Notes (`GET` / `POST /api/tickets/:id/notes`). | HTTP 403 Forbidden without disclosing note existence or count. | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| **API-10** | API | AC-08, FR-13 | IT Staff Ticket Queue retrieval (`GET /api/staff/tickets`). | HTTP 200 OK with paginated ticket list, category, priority, status, and owner. | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| **API-11** | API | AC-08, FR-14 | IT Staff Ticket Queue search and filtering. | Correctly filters by summary text, category, priority, status, and owner. | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| **API-12** | API | FR-15 | IT Staff Ticket Queue pagination metadata. | Returns accurate `totalCount`, `page`, `pageSize`, `totalPages`, `hasNextPage`. | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| **API-13** | API | AC-09, FR-17 | IT Staff claim ticket (`PATCH /api/staff/tickets/:id/claim`). | Sets `ownerId` to active IT Staff user and transitions status if appropriate. | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| **API-14** | API | FR-17, BR-11 | Ticket reassignment (`PATCH /api/staff/tickets/:id/assign`). | Reassigns ticket to target IT Staff; rejects reassignment to non-staff user. | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| **API-15** | API | AC-10, BR-12 | Independent IT Priority update (`PATCH /api/staff/tickets/:id/priority`). | Updates `itPriority` without altering original `requestedPriority`. | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| **API-16** | API | AC-11, BR-17 | Status progression to `RESOLVED` with resolution summary. | Updates status to `RESOLVED` and stores `resolutionSummary`; returns 200 OK. | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| **API-17** | API | AC-12, BR-15 | Illegal status transition attempt. | HTTP 422 Unprocessable Entity rejecting unpermitted state change. | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| **API-18** | API | AC-14, FR-20 | Public Comment authoring and retrieval (`/api/tickets/:id/comments`). | Saves append-only comment stamped with author ID/role; visible to all roles. | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| **API-19** | API | AC-15, FR-21 | Internal Note authoring by IT Staff (`POST /api/tickets/:id/notes`). | Saves confidential note; accessible only by IT Staff and Administrator. | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| **API-20** | API | AC-13, BR-16 | Requester "Problem Appears Resolved" indication. | Records public resolution event comment; leaves formal status intact. | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| **API-21** | API | AC-16, FR-23 | Administrator user listing and role filtering (`GET /api/admin/users`). | HTTP 200 OK with user directory; filters by role (`REQUESTER`, `IT_STAFF`, `ADMIN`). | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| **API-22** | API | AC-17, FR-25 | Administrator user account creation (`POST /api/admin/users`). | Creates user with `requiresPasswordChange = true` and hashed initial password. | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| **API-23** | API | AC-18, BR-21 | Duplicate email address creation / update conflict. | HTTP 409 Conflict with message `"Email address is already in use"`. | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| **API-24** | API | AC-19, BR-22 | Administrator self-deactivation attempt. | HTTP 422 Unprocessable Entity blocking admin from deactivating self. | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| **API-25** | API | AC-20, BR-23 | Deactivating or demoting the last active Administrator. | HTTP 422 Unprocessable Entity preventing zero-admin system state. | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| **API-26** | API | AC-21, FR-08 | Non-Administrator access to User Management APIs. | HTTP 403 Forbidden for Requester or IT Staff attempting admin operations. | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| **API-27** | API | FR-27, BR-25 | Administrator password reset (`POST /api/admin/users/:id/reset-password`). | Sets new initial password and forces `requiresPasswordChange = true`. | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| **API-28** | API | AC-22 | Lab 2 regression: Attachment soft removal and download. | Lab 2 attachment soft removal and download block continue to function. | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| **UI-01** | Component | AC-01, AC-03 | Login component interaction and error banner. | Renders email/password inputs, eye toggle, submit spinner, error alert. | `client/tests/lab-03/Login.test.tsx` | Planned |
| **UI-02** | Component | AC-02, BR-03 | Mandatory password change form and checklist. | Displays dynamic checkmarks for 8+ chars, upper/lower, number, symbol. | `client/tests/lab-03/ChangePassword.test.tsx` | Planned |
| **UI-03** | Component | AC-08, FR-14 | IT Staff Ticket Queue table, search, filters. | Renders search box, filter dropdowns, badges, and paginated rows. | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| **UI-04** | Component | AC-10, AC-11 | IT Staff Ticket Detail operational form and tabs. | Renders read-only vs editable fields, status dropdown, comment tabs. | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| **UI-05** | Component | AC-15, BR-09 | Public Comments vs Internal Notes UI separation. | Distinct visual badges; confidential amber banner on Internal Notes. | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| **UI-06** | Component | AC-16, AC-19 | Administrator User Management console. | Renders user list, create user modal, disables self-deactivation button. | `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| **E2E-01** | Playwright | AC-01, FR-06 | Authentication, session persistence, and logout flow. | Logs in as active user, verifies dashboard header, logs out, verifies redirect. | `e2e/lab-03/authentication.spec.ts` | Planned |
| **E2E-02** | Playwright | AC-02, BR-02 | Mandatory first-login password change flow. | Logs in with temporary password, blocked at password screen, updates password, lands in app. | `e2e/lab-03/authentication.spec.ts` | Planned |
| **E2E-03** | Playwright | AC-08, AC-11 | Complete IT Staff queue triage and detail resolution. | IT Staff opens queue, searches ticket, claims ownership, updates IT priority, posts note, resolves ticket. | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| **E2E-04** | Playwright | AC-17, AC-19 | Administrator user provisioning and safety rules. | Admin creates new IT Staff account, verifies unique email error, verifies self-deactivation lock. | `e2e/lab-03/user-administration.spec.ts` | Planned |
| **E2E-05** | Playwright | AC-07, AC-13 | Requester comment stream and problem resolved indication. | Requester views ticket, posts comment, clicks "Problem Appears Resolved", verifies note tab absent. | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| **E2E-06** | Playwright | AC-22 | Cross-role responsive inspection (Desktop, Tablet, Mobile). | Captures screenshots at 1200px, 800px, 375px; checks zero horizontal overflow. | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |

---

## 3. Acceptance Criteria Traceability Matrix

| Acceptance Criterion | Description Summary | Covered by Automated Test IDs | Target Test Implementation Files |
| :--- | :--- | :--- | :--- |
| **AC-01** | Valid user login establishes session and returns role. | `API-01`, `UI-01`, `E2E-01` | `server/tests/lab-03/auth.api.test.ts`, `client/tests/lab-03/Login.test.tsx`, `e2e/lab-03/authentication.spec.ts` |
| **AC-02** | First-login password change wall intercepts navigation. | `API-04`, `API-05`, `UI-02`, `E2E-02` | `server/tests/lab-03/auth.api.test.ts`, `client/tests/lab-03/ChangePassword.test.tsx`, `e2e/lab-03/authentication.spec.ts` |
| **AC-03** | Invalid credentials rejected with safe generic message. | `API-02`, `UI-01` | `server/tests/lab-03/auth.api.test.ts`, `client/tests/lab-03/Login.test.tsx` |
| **AC-04** | Inactive accounts blocked without leaking metadata. | `API-03` | `server/tests/lab-03/auth.api.test.ts` |
| **AC-05** | Authenticated Requester ownership enforcement on ticket creation. | `API-07` | `server/tests/lab-03/authorization.api.test.ts` |
| **AC-06** | Cross-Requester ticket and attachment isolation (403). | `API-08` | `server/tests/lab-03/authorization.api.test.ts` |
| **AC-07** | Internal Notes invisible and inaccessible to Requesters. | `API-09`, `UI-05`, `E2E-05` | `server/tests/lab-03/comments-notes.api.test.ts`, `e2e/lab-03/staff-ticket-flow.spec.ts` |
| **AC-08** | IT Staff Ticket Queue retrieval, search, and filters. | `API-10`, `API-11`, `UI-03`, `E2E-03` | `server/tests/lab-03/staff-queue.api.test.ts`, `client/tests/lab-03/StaffTicketQueue.test.tsx`, `e2e/lab-03/staff-ticket-flow.spec.ts` |
| **AC-09** | IT Staff ticket claiming ("Assign to Me"). | `API-13`, `E2E-03` | `server/tests/lab-03/staff-ticket-detail.api.test.ts`, `e2e/lab-03/staff-ticket-flow.spec.ts` |
| **AC-10** | Independent IT Priority update without changing requested priority. | `API-15`, `UI-04`, `E2E-03` | `server/tests/lab-03/staff-ticket-detail.api.test.ts`, `client/tests/lab-03/StaffTicketDetail.test.tsx` |
| **AC-11** | Permitted status transition and mandatory resolution summary. | `API-16`, `UI-04`, `E2E-03` | `server/tests/lab-03/staff-ticket-detail.api.test.ts`, `e2e/lab-03/staff-ticket-flow.spec.ts` |
| **AC-12** | Invalid status transition rejected with 422 Unprocessable. | `API-17`, `UNIT-02` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` |
| **AC-13** | Requester "Problem Appears Resolved" indication. | `API-20`, `E2E-05` | `server/tests/lab-03/staff-ticket-detail.api.test.ts`, `e2e/lab-03/staff-ticket-flow.spec.ts` |
| **AC-14** | Public Comments append-only authoring & multi-role visibility. | `API-18`, `UI-05`, `E2E-05` | `server/tests/lab-03/comments-notes.api.test.ts`, `client/tests/lab-03/StaffTicketDetail.test.tsx` |
| **AC-15** | Internal Notes authoring restricted to IT Staff and Admin. | `API-19`, `UI-05`, `E2E-03` | `server/tests/lab-03/comments-notes.api.test.ts`, `e2e/lab-03/staff-ticket-flow.spec.ts` |
| **AC-16** | Administrator user directory listing and search/filtering. | `API-21`, `UI-06` | `server/tests/lab-03/users-admin.api.test.ts`, `client/tests/lab-03/UserManagement.test.tsx` |
| **AC-17** | Administrator account creation with initial password flag. | `API-22`, `UI-06`, `E2E-04` | `server/tests/lab-03/users-admin.api.test.ts`, `e2e/lab-03/user-administration.spec.ts` |
| **AC-18** | Duplicate email rejected with 409 Conflict. | `API-23`, `E2E-04` | `server/tests/lab-03/users-admin.api.test.ts`, `e2e/lab-03/user-administration.spec.ts` |
| **AC-19** | Administrator self-deactivation blocked (422). | `API-24`, `UI-06`, `E2E-04` | `server/tests/lab-03/users-admin.api.test.ts`, `e2e/lab-03/user-administration.spec.ts` |
| **AC-20** | Deactivating or demoting last active Administrator blocked (422). | `API-25` | `server/tests/lab-03/users-admin.api.test.ts` |
| **AC-21** | Forbidden access for non-Administrators to admin APIs (403). | `API-26` | `server/tests/lab-03/authorization.api.test.ts` |
| **AC-22** | Lab 2 data preservation and regression verification. | `API-28`, `E2E-06` | `server/tests/lab-03/authorization.api.test.ts`, `e2e/lab-03/staff-ticket-flow.spec.ts` |

---

## 4. Security & Authorization Boundary Test Matrix

| Target Vector | Scenario Tested | HTTP Endpoint | Caller Role | Expected Status | Security Assertion |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Route Authorization** | Fetch IT Staff queue | `GET /api/staff/tickets` | `REQUESTER` | `403 Forbidden` | Requester cannot view system queue. |
| **Route Authorization** | Fetch admin user list | `GET /api/admin/users` | `IT_STAFF` | `403 Forbidden` | IT Staff cannot access admin management. |
| **Route Authorization** | Fetch admin user list | `GET /api/admin/users` | Unauthenticated | `401 Unauthorized` | Public cannot access user directory. |
| **Confidentiality** | Read Internal Notes | `GET /api/tickets/:id/notes`| `REQUESTER` | `403 Forbidden` | Internal operational notes never leaked to customer. |
| **Confidentiality** | Write Internal Note | `POST /api/tickets/:id/notes`| `REQUESTER` | `403 Forbidden` | Requester cannot submit internal notes. |
| **IDOR Isolation** | View foreign ticket | `GET /api/tickets/:foreignId`| `REQUESTER` | `403 Forbidden` | Requester cannot inspect another user's ticket. |
| **IDOR Isolation** | Download foreign file | `GET /api/attachments/:id/download` | `REQUESTER` | `403 Forbidden` | Requester cannot download foreign attachment. |
| **State Tampering** | Bypass password change | `GET /api/staff/tickets` | User w/ `requiresPasswordChange = true` | `403 Forbidden` | Password wall cannot be bypassed by direct API call. |
| **Integrity Guard** | Self-deactivation | `PATCH /api/admin/users/:ownId` | `ADMINISTRATOR` | `422 Unprocessable` | Admin cannot lock themselves out. |
| **Integrity Guard** | Orphan system guard | `PATCH /api/admin/users/:lastAdminId` | `ADMINISTRATOR` | `422 Unprocessable` | System cannot be left with 0 active admins. |

---

## 5. Responsive & Visual Verification Checklist

| Viewport Category | Screen Width & Height | Verified Elements & Behaviors |
| :--- | :--- | :--- |
| **Desktop** | `1200 x 900` | Full multi-column grid, full 8-column Ticket Queue table, user directory table, side-by-side comment forms, zero text truncation issues. |
| **Tablet** | `800 x 1024` | 2-column forms, Queue table scrolls horizontally or wraps gracefully, User drawer takes 60% width, touch targets >= 44px. |
| **Mobile** | `375 x 812` | Single column flow, Ticket Queue transforms to card list view, buttons expand to 100% width, zero horizontal page overflow (`scrollWidth === clientWidth`). |

Screenshots must be captured for:
- `artifacts/lab-03/screenshots/authentication/` (Desktop, Tablet, Mobile)
- `artifacts/lab-03/screenshots/staff-queue/` (Desktop, Tablet, Mobile)
- `artifacts/lab-03/screenshots/staff-ticket-detail/` (Desktop, Tablet, Mobile)
- `artifacts/lab-03/screenshots/user-management/` (Desktop, Tablet, Mobile)

---

## 6. Test Execution Commands

```bash
# 1. Run all server unit & API integration tests for Lab 3
npm --prefix server test -- lab-03

# 2. Run all client React component tests for Lab 3
npm --prefix client test -- lab-03

# 3. Run full regression suite (Lab 1, Lab 2, and Lab 3)
npm --prefix server test
npm --prefix client test

# 4. Run Playwright End-to-End tests for Lab 3
npx playwright test e2e/lab-03/

# 5. Run Playwright with visual artifact generation
npx playwright test e2e/lab-03/ --project=chromium
```

---

## 7. Definition of Done (DoD) Verification Checklist

- [ ] All 22 Acceptance Criteria (AC-01 through AC-22) mapped to passing automated tests.
- [ ] 0 failing tests and 0 skipped tests across server Vitest, client Vitest, and Playwright suites.
- [ ] All 10 security boundary test cases passing with expected 401/403/422 responses.
- [ ] Backward compatibility verified: 100% of Lab 2 test suite passes without regressions.
- [ ] Responsive viewport screenshots generated for all major screens and organized under `artifacts/lab-03/screenshots/`.
