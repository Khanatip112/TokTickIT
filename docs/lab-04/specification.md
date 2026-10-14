# Lab 4 Sprint Engineering Specification
## TokTickIT Actions Taken, Dashboards, and Final Regression

---

## 1. Sprint Goal

Deliver the complete operational lifecycle for the TokTickIT service desk by introducing **Actions Taken** (a parent-child operational activity log under each Ticket), enforcing strict **Ticket Status Transitions and Resolution Gate** rules (requiring documented actions before resolution), providing role-tailored **Dashboards** (for Requesters, IT Staff, and Administrators) with actionable metrics and drill-down capabilities, and executing full-system **Regression Hardening** to ensure all capabilities across Labs 1 through 3 remain fully functional, performant, and compliant with the Zen Green design language.

---

## 2. Stakeholder Request Interpretation

The TokTickIT platform has successfully established ticket submission, attachment management, secure authentication, role segregation, queue triage, and public/internal communication. However, IT operations lack a structured, auditable mechanism to record and track the actual technical actions performed during ticket handling.

Key stakeholder expectations for Sprint 4 include:
1. **Actions Taken Work Tracking**:
   - Each ticket must maintain a chronological, auditable sub-entity collection of "Actions Taken".
   - Each Action Taken entry must record: Action Date/Time (`actionDateTime`), Description (`description`), Result (`result`), Performed By auto-derived from the authenticated session (`performedBy`), Follow-Up Required toggle (`followUpRequired`), Follow-up Note mandatory when follow-up is required (`followUpNote`), and Attachment Notes (`attachmentNotes`) referencing any relevant evidence or diagnostic screenshots.
   - The primary Ticket Owner coordinates the ticket overall, but any authorized IT Staff member or Administrator may perform work and record an Action Taken.
   - Requesters can view the Actions Taken on their owned tickets to understand work progress, but cannot author or modify actions.
2. **Ticket Workflow Hardening & Resolution Gate**:
   - Tickets must follow a formal, permitted status lifecycle: `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`.
   - **Resolution Gate**: A ticket cannot be formally transitioned to `RESOLVED` or `CLOSED` unless at least one valid Action Taken has been recorded detailing the fix or intervention.
   - Requester "Problem Appears Resolved" indication remains purely advisory and does not bypass the IT Staff resolution verification gate.
3. **Role-Tailored Operational Dashboards**:
   - **Requester Dashboard**: High-level personal summary highlighting total open tickets, tickets waiting for requester action, recently updated tickets, and resolved tickets with drill-downs to My Tickets or Ticket Detail.
   - **IT Staff Dashboard**: Operational workstation summarizing unassigned tickets, tickets owned by the current staff member, queue distribution by status and IT priority, and high-priority/recently updated tickets with direct queue drill-down filters.
   - **Administrator Dashboard**: System-wide governance overview extending the IT Staff metrics with user account distributions and platform health.
4. **Final Regression & System Hardening**:
   - Full backward compatibility for all Lab 1, Lab 2, and Lab 3 features.
   - Consistent error handling, concurrency protection, accessible keyboard navigation, and seamless responsiveness across desktop, tablet, and mobile devices.

---

## 3. Scope

### 3.1. Included in Sprint 4
- **Actions Taken Management**:
  - Relational schema extension linking `Ticket` (1) to `ActionTaken` (N).
  - Endpoints to list (`GET /api/tickets/:id/actions-taken`), create (`POST /api/tickets/:id/actions-taken`), and update/retract (`PUT /api/actions-taken/:actionId`).
  - Automatic attribution of `performedById` from the authenticated session.
  - Validation rules for description, result values, and conditional follow-up notes.
- **Workflow & Resolution Gate**:
  - Server-enforced status transition state machine.
  - Resolution gate blocking `RESOLVED` and `CLOSED` transitions unless at least one Action Taken exists.
  - Concurrency conflict detection using `updatedAt` timestamps.
- **Role-Appropriate Dashboards**:
  - Requester dashboard endpoint (`GET /api/dashboards/requester`) with personal metrics and quick actions.
  - IT Staff dashboard endpoint (`GET /api/dashboards/staff`) with queue totals, my assignments, status/priority breakdown, and actionable ticket cards.
  - Interactive drill-down navigation linking dashboard metric cards to filtered queue and ticket views.
- **UI Enhancements**:
  - Actions Taken tab and modal/drawer inside Ticket Detail for IT Staff and Requesters.
  - Dashboard pages for Requesters and IT Staff with Zen Green metric cards.
  - Role-aware navigation bar updates (Dashboard vs. Queue vs. My Tickets).
- **Quality & Verification**:
  - Full automated test suite (Unit, API integration, UI component, and Playwright E2E).
  - Visual and accessibility compliance check across Desktop (>=1280px), Tablet (768px-1024px), and Mobile (<768px).

### 3.2. Explicitly Excluded from Sprint 4 (Handout Section 4.2)
- Automatic SLA clocks, breach notifications, and real-time escalation countdown engines.
- External push notification channels (Email, SMS, LINE, Webhook integrations).
- Spare-parts inventory consumption, hardware asset tracking, and service cost billing.
- Timesheet management, consultant hourly rates, and payroll calculations.
- Multi-tier formal management sign-offs and digital signature workflows.
- Advanced OLAP business intelligence cubes, ad-hoc query builders, and CSV/PDF export warehouses.
- Multi-tenant database tenancy and cloud-cluster auto-scaling.

---

## 4. Functional Requirements

| ID | Description | Role Authorization |
| :--- | :--- | :--- |
| **FR-01** | The system shall maintain a 1:N relationship between a `Ticket` and `ActionTaken` records, ordered chronologically by `actionDateTime` ascending. | All authenticated users (scoped by ticket access) |
| **FR-02** | The system shall record for each Action Taken: `actionDateTime`, `description` (1-1000 chars), `result` (`PENDING`, `SUCCESS`, `PARTIAL`, `FAILED`), `performedById` (auto-derived), `followUpRequired` (boolean), `followUpNote` (conditional string, 1-1000 chars), and `attachmentNotes` (optional, max 500 chars). | `IT_STAFF`, `ADMINISTRATOR` |
| **FR-03** | The system shall automatically derive `performedById` from the active authenticated session cookie (`req.session.userId`), ignoring or rejecting any client-supplied identity payload. | Server-enforced |
| **FR-04** | The system shall mandate `followUpNote` whenever `followUpRequired` is `true`. Requests with `followUpRequired: true` but empty or missing `followUpNote` must be rejected with HTTP 400 Bad Request. | Server-enforced |
| **FR-05** | The system shall allow authorized IT Staff and Administrators to update an existing Action Taken record via `PUT /api/actions-taken/:actionId` with updated description, result, follow-up flags, or attachment notes. | `IT_STAFF`, `ADMINISTRATOR` |
| **FR-06** | Requesters shall be permitted to read Actions Taken on tickets they own via `GET /api/tickets/:id/actions-taken`, but shall be strictly blocked (HTTP 403 Forbidden) from creating or editing Actions Taken. | `REQUESTER` (Read-only) |
| **FR-07** | The system shall enforce the Resolution Gate: Transitioning a ticket to `RESOLVED` or `CLOSED` must fail with HTTP 422 Unprocessable Entity if the ticket has 0 associated `ActionTaken` records. | `IT_STAFF`, `ADMINISTRATOR` |
| **FR-08** | The system shall calculate Requester Dashboard metrics (`GET /api/dashboards/requester`) including: `totalOpenTickets`, `waitingForRequesterCount`, `recentlyUpdatedCount`, `recentlyResolvedCount`, and recent ticket summaries. | `REQUESTER` |
| **FR-09** | The system shall calculate IT Staff Dashboard metrics (`GET /api/dashboards/staff`) including: `unassignedCount`, `assignedToMeCount`, `urgentPriorityCount`, `openCount`, `inProgressCount`, `waitingRequesterCount`, and a recent ticket activity list. | `IT_STAFF`, `ADMINISTRATOR` |
| **FR-10** | Clicking a dashboard metric card shall navigate to the corresponding pre-filtered view (e.g., clicking "Unassigned" navigates to `/staff/queue?ownerId=unassigned`). | `REQUESTER`, `IT_STAFF`, `ADMINISTRATOR` |
| **FR-11** | The application header navigation shall adapt based on user role to include direct links to "Dashboard", "My Queue", "My Tickets", "Create Ticket", or "Admin" as permitted. | All roles |
| **FR-12** | The system shall prevent concurrent overwrite anomalies by evaluating the ticket's `updatedAt` or version tag during state and operational updates. | Server-enforced |

---

## 5. Business Rules

### 5.1. Actions Taken Business Rules
- **BR-01 (Ticket Association)**: Every Action Taken belongs to exactly one Ticket (`ticketId` is non-nullable). Deleting a ticket cascades to its actions, but tickets are non-deletable in standard operations.
- **BR-02 (Operational Responsibility vs. Ticket Ownership)**: The Ticket Owner coordinates the overall ticket resolution, but any active IT Staff member or Administrator may perform work and record an Action Taken. The `performedById` records the actual contributor, who may differ from the Ticket Owner.
- **BR-03 (Auto-Derived Performer Identity)**: The `performedById` is strictly assigned from `req.session.userId`. Any client attempt to spoof or pass `performedById` in the request body is discarded.
- **BR-04 (Follow-Up Conditional Requirement)**:
  - If `followUpRequired === true`, `followUpNote` MUST be non-empty and between 1 and 1,000 characters.
  - If `followUpRequired === false`, `followUpNote` is optional or sanitized to `null`.
- **BR-05 (Valid Action Results)**:
  - Allowed `result` values are:
    * `SUCCESS`: Action resolved the immediate obstacle or ticket objective.
    * `PARTIAL`: Action progressed the issue, but additional steps remain.
    * `PENDING`: Action initiated (e.g., diagnostic running, vendor contacted) awaiting output.
    * `FAILED`: Action attempted but unsuccessful or encountered errors.
- **BR-06 (Attachment Notes Reference)**: `attachmentNotes` is an optional descriptive string (max 500 characters) referencing specific files, log names, or screenshots. It does not enforce a rigid foreign key to allow flexible references to external or system logs.
- **BR-07 (Requester Read Access)**: Requesters have read-only visibility into Actions Taken for tickets where `ticket.requesterId === req.session.userId`. Requesters attempting `POST` or `PUT` actions receive HTTP 403 Forbidden.

### 5.2. Status Transition Matrix & Resolution Gate
- **BR-08 (Permitted Status Transitions)**:
  Ticket state transitions are governed by the authoritative transition matrix:

| Current Status (`From`) | Allowed Next Status (`To`) | Permitted Roles | Condition / Gate |
| :--- | :--- | :--- | :--- |
| `NEW` | `OPEN` | `IT_STAFF`, `ADMINISTRATOR` | Claimed by staff or owner assigned |
| `NEW` | `CANCELLED` | `IT_STAFF`, `ADMINISTRATOR` | Invalid, spam, or duplicate |
| `OPEN` | `IN_PROGRESS` | `IT_STAFF`, `ADMINISTRATOR` | Work actively begins |
| `OPEN` | `WAITING_FOR_REQUESTER` | `IT_STAFF`, `ADMINISTRATOR` | Clarification or user response requested |
| `OPEN` | `CANCELLED` | `IT_STAFF`, `ADMINISTRATOR` | Request withdrawn or obsolete |
| `IN_PROGRESS` | `WAITING_FOR_REQUESTER` | `IT_STAFF`, `ADMINISTRATOR` | Awaiting user reproduction/verification |
| `IN_PROGRESS` | `RESOLVED` | `IT_STAFF`, `ADMINISTRATOR` | **Resolution Gate**: Requires >= 1 Action Taken |
| `IN_PROGRESS` | `CANCELLED` | `IT_STAFF`, `ADMINISTRATOR` | Cancelled during active triage |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS` | `IT_STAFF`, `ADMINISTRATOR` | Requester provided feedback |
| `WAITING_FOR_REQUESTER` | `RESOLVED` | `IT_STAFF`, `ADMINISTRATOR` | **Resolution Gate**: Requires >= 1 Action Taken |
| `WAITING_FOR_REQUESTER` | `CANCELLED` | `IT_STAFF`, `ADMINISTRATOR` | Closed due to inactivity or cancellation |
| `RESOLVED` | `CLOSED` | `IT_STAFF`, `ADMINISTRATOR` | Final administrative closure |
| `RESOLVED` | `REOPENED` | `IT_STAFF`, `ADMINISTRATOR` | Requester indicates problem recurs |
| `CLOSED` | `REOPENED` | `ADMINISTRATOR` | Re-evaluation authorized by Admin |
| `REOPENED` | `IN_PROGRESS` | `IT_STAFF`, `ADMINISTRATOR` | Work resumed on reopened ticket |
| `REOPENED` | `CANCELLED` | `IT_STAFF`, `ADMINISTRATOR` | Cancelled post-reopening |

- **BR-09 (Resolution Gate Enforcement)**:
  - Any request attempting to set status to `RESOLVED` or `CLOSED` MUST be validated against the database for the ticket.
  - If `count(actionsTaken) === 0`, the status transition is rejected with HTTP 422 Unprocessable Entity and the message: `"Cannot resolve or close a ticket without at least one recorded Action Taken."`
  - In addition, transitioning to `RESOLVED` or `CLOSED` requires `resolutionSummary` (minimum 5 characters, maximum 1,000 characters), continuing the Lab 3 business rule.
- **BR-10 (Requester Advisory Status Indication)**:
  - Requesters clicking "Problem Appears Resolved" sets an advisory flag (`isResolvedByRequester: true`), but does NOT automatically change status to `RESOLVED`. IT Staff review remains mandatory.

### 5.3. Dashboard Metrics Calculation Rules
- **BR-11 (Authoritative Backend Computation)**: All dashboard metrics are calculated dynamically server-side via SQL aggregation queries from live data. Client-side math is strictly prohibited for authoritative counters.
- **BR-12 (Requester Dashboard Metrics)**:
  - Scoped exclusively to tickets where `ticket.requesterId === req.session.userId`.
  - `totalOpenTickets`: Count of owned tickets where status IN (`NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `REOPENED`).
  - `waitingForRequesterCount`: Count of owned tickets where status === `WAITING_FOR_REQUESTER`.
  - `recentlyResolvedCount`: Count of owned tickets where status === `RESOLVED`.
  - `closedTicketsCount`: Count of owned tickets where status === `CLOSED`.
  - `recentTickets`: Up to 5 most recently created or updated tickets owned by the requester.
- **BR-13 (IT Staff Dashboard Metrics)**:
  - Scoped across the global service queue with staff-specific rollups.
  - `unassignedCount`: Tickets where `ownerId === null` AND status IN (`NEW`, `OPEN`, `IN_PROGRESS`, `REOPENED`).
  - `assignedToMeCount`: Tickets where `ownerId === req.session.userId` AND status IN (`OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `REOPENED`).
  - `urgentPriorityCount`: Tickets where `itPriority === 'URGENT'` AND status NOT IN (`RESOLVED`, `CLOSED`, `CANCELLED`).
  - `inProgressCount`: All tickets across the system with status === `IN_PROGRESS`.
  - `waitingRequesterCount`: All tickets across the system with status === `WAITING_FOR_REQUESTER`.
  - `resolvedTodayCount`: Tickets with status === `RESOLVED` updated on the current calendar date (`>= startOfDay`).
  - `recentTickets`: Up to 5 tickets requiring immediate attention (ordered by `itPriority` DESC, `updatedAt` DESC).
- **BR-14 (Administrator Dashboard Metrics)**:
  - Inherits all IT Staff operational metrics.
  - Includes user governance summaries: `activeRequestersCount`, `activeStaffCount`, `totalUsersCount`.

### 5.4. Role-Based Access Control (RBAC) Matrix

| Endpoint / Operation | HTTP Method | Requester | IT Staff | Administrator |
| :--- | :---: | :---: | :---: | :---: |
| List Actions Taken for Ticket | `GET /api/tickets/:id/actions-taken` | ✅ (Owned Only) | ✅ (All) | ✅ (All) |
| Create Action Taken | `POST /api/tickets/:id/actions-taken` | ❌ (403) | ✅ | ✅ |
| Update Action Taken | `PUT /api/actions-taken/:actionId` | ❌ (403) | ✅ | ✅ |
| Requester Dashboard | `GET /api/dashboards/requester` | ✅ | ✅ | ✅ |
| IT Staff Dashboard | `GET /api/dashboards/staff` | ❌ (403) | ✅ | ✅ |
| Ticket Status Update (with Gate) | `PATCH /api/tickets/:id/status` | ❌ (403) | ✅ | ✅ |

---

## 6. UI Specification Summary

*(Full layout, component hierarchy, and design token details are located in `docs/lab-04/ui-spec.md`)*

1. **Zen Green Design System Continuity**:
   - Primary: `#006B3C` (Zen Green), Hover: `#0B7A46`, Pale Background: `#EAF6EF`.
   - Read-only Background: `#F0F4F1`, Neutral Dark: `#1A1A1A`, Muted: `#6C757D`.
   - Result Badges: `SUCCESS` (Emerald green), `PARTIAL` (Sky blue), `PENDING` (Amber yellow), `FAILED` (Rose red).
2. **Actions Taken on Ticket Detail (`/staff/tickets/:id`)**:
   - Sub-tab alongside Public Comments and Internal Notes: `"Actions Taken (N)"`.
   - **List View**: Displays chronological timeline cards/rows with `actionDateTime`, performer badge, result badge, description, follow-up callout (if required), and attachment notes.
   - **Create / Edit Modal**: Form inputs for `description` (textarea, required), `result` (dropdown), `followUpRequired` (toggle switch), `followUpNote` (conditional textarea), and `attachmentNotes` (input text).
3. **IT Staff Dashboard (`/staff/dashboard`)**:
   - Welcome banner: "Welcome back, [Name]! Here's what's happening with your queue today."
   - 5 KPI Metric Cards: `Unassigned`, `Assigned to Me`, `In Progress`, `Waiting on Requester`, `Urgent Priority`.
   - Each card displays large numeric counter, micro-label, and clickable drill-down linking to `/staff/queue` with active query params.
   - Quick Actions panel: "Create Ticket", "Search Tickets", "My Queue".
   - Recent Urgent Tickets list table.
4. **Requester Dashboard (`/requester/dashboard`)**:
   - Welcome banner: "Welcome, [Name]! Here's the latest on your requests."
   - 4 KPI Metric Cards: `My Open Tickets`, `In Progress`, `Waiting for My Reply`, `Resolved`.
   - Quick Actions: "Create Ticket", "View All Tickets".
   - Recent Tickets list with status and priority badges.
5. **Responsive Breakpoints**:
   - Desktop (`>= 1280px`): Full multi-column grid, expanded KPI cards, wide data tables.
   - Tablet (`768px - 1024px`): 2-to-3 column wrapped metric cards, responsive tables with horizontal scroll wrapper.
   - Mobile (`< 768px`): Single-column stacked cards, compact action lists, no horizontal viewport clipping.

---

## 7. Data Changes & Migration Decisions

### 7.1. Prisma Schema Evolution
The PostgreSQL schema evolves by adding the `ActionTaken` model and updating relationships on `Ticket` and `User`:

```prisma
enum ActionResult {
  PENDING
  SUCCESS
  PARTIAL
  FAILED
}

model ActionTaken {
  id               String       @id @default(cuid())
  ticketId         String
  ticket           Ticket       @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  performedById    String
  performedBy      User         @relation(fields: [performedById], references: [id])
  actionDateTime   DateTime     @default(now())
  description      String       @db.VarChar(1000)
  result           ActionResult @default(SUCCESS)
  followUpRequired Boolean      @default(false)
  followUpNote     String?      @db.VarChar(1000)
  attachmentNotes  String?      @db.VarChar(500)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  @@index([ticketId])
  @@index([performedById])
  @@index([actionDateTime])
}
```

### 7.2. Database Design Decisions (Justification)
1. **Decision 1: Direct Foreign Key to `User` for `performedById`**:
   - *Rationale*: Guarantees relational integrity so that actions cannot be attributed to non-existent users. Enables eager-loading of performer name, email, and role for UI display without secondary queries.
2. **Decision 2: Indexed `ticketId` and `actionDateTime`**:
   - *Rationale*: Speeds up chronological timeline queries on ticket detail views and allows fast aggregation for dashboard calculations.
3. **Decision 3: Non-destructive Zero-Backfill for Legacy Tickets**:
   - *Rationale*: Legacy tickets created in Labs 1-3 without actions taken remain valid in read mode. However, if an IT Staff attempts to advance a legacy ticket to `RESOLVED`, the Resolution Gate will actively enforce adding an Action Taken, preserving backward compatibility while ensuring forward integrity.

---

## 8. API Specification Summary

*(Full request/response bodies, headers, and schemas are detailed in `docs/lab-04/api-spec.md`)*

- `GET /api/tickets/:id/actions-taken`: Retrieve all actions taken for a ticket (chronological order).
- `POST /api/tickets/:id/actions-taken`: Record a new action taken. Validates payload, verifies ticket existence, and auto-derives performer.
- `PUT /api/actions-taken/:actionId`: Update an existing action taken record.
- `GET /api/dashboards/requester`: Calculate and return Requester personal dashboard summary metrics.
- `GET /api/dashboards/staff`: Calculate and return IT Staff queue and workload dashboard summary metrics.

---

## 9. Acceptance Criteria (AC)

- **AC-01**: Given an authenticated IT Staff user, when posting valid action data to `POST /api/tickets/:id/actions-taken`, then an `ActionTaken` record is created with `performedById` matching the session user, returning HTTP 201 Created.
- **AC-02**: Given `followUpRequired` is set to `true`, when `followUpNote` is missing or blank, then the API returns HTTP 400 Bad Request with field validation errors.
- **AC-03**: Given an authenticated Requester, when attempting to create an Action Taken, then the API rejects the request with HTTP 403 Forbidden.
- **AC-04**: Given an authenticated Requester, when accessing `GET /api/tickets/:id/actions-taken` for an owned ticket, then the actions list is returned with HTTP 200 OK.
- **AC-05**: Given an authenticated Requester, when accessing actions for a ticket owned by another user, then the API returns HTTP 403 Forbidden.
- **AC-06**: Given a ticket with zero Action Taken records, when IT Staff attempts to change status to `RESOLVED` or `CLOSED`, then the API rejects the transition with HTTP 422 Unprocessable Entity (Resolution Gate).
- **AC-07**: Given a ticket with at least one Action Taken record and a valid resolution summary, when IT Staff transitions status to `RESOLVED`, then the transition succeeds with HTTP 200 OK.
- **AC-08**: Given an authenticated Requester, when querying `GET /api/dashboards/requester`, then all counts and recent tickets reflect only tickets where `requesterId === session.userId`.
- **AC-09**: Given an authenticated IT Staff user, when querying `GET /api/dashboards/staff`, then accurate counts for unassigned tickets, tickets assigned to me, urgent tickets, and queue status distributions are returned.
- **AC-10**: Given the frontend IT Staff dashboard, when clicking a KPI metric card (e.g., Unassigned), then the user is redirected to `/staff/queue` filtered by the appropriate parameter.

---

## 10. Definition of Done (DoD)

### 10.1. Product Completion Checklist
- [ ] Prisma schema updated with `ActionTaken` model, migrated, and seeded with sample actions.
- [ ] `actions-taken.api.test.ts` covering validation, RBAC, performer derivation, and list/create/update endpoints passing.
- [ ] `ticket-workflow.api.test.ts` verifying the Resolution Gate and status transition matrix passing.
- [ ] `requester-dashboard.api.test.ts` and `staff-dashboard.api.test.ts` validating metric calculations passing.
- [ ] Frontend UI components for Actions Taken (list & form) integrated into Ticket Detail view.
- [ ] Frontend UI components for Requester Dashboard and IT Staff Dashboard implemented with Zen Green styling.
- [ ] Interactive drill-down navigation linking dashboard cards to filtered queue views operational.
- [ ] All client Vitest component tests passing.
- [ ] All Playwright E2E specs for Actions Taken, Resolution Gate, and Dashboards passing across desktop, tablet, and mobile.
- [ ] Complete regression check: All Lab 1, Lab 2, and Lab 3 automated tests passing with zero regressions.

### 10.2. Engineering Process & Deliverables
- [ ] Sprint 4 engineering contracts (`specification.md`, `ui-spec.md`, `api-spec.md`, `tests.md`) completed and reviewed prior to code PRs.
- [ ] Feature branches merged into `lab4-staging` and then into `main`.
- [ ] Peer review records documented in `docs/lab-04/reviewer.md`.
- [ ] AI prompt history and engineering reflection documented in `docs/lab-04/ai-use.md`.
- [ ] Responsive visual review screenshots captured and organized in `artifacts/lab-04/screenshots/`.
