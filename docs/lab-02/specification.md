# Lab 2 Sprint Engineering Specification
## TokTickIT Requester Ticketing MVP with UI Foundation

---

## 1. Sprint Goal
Deliver a production-ready Requester-facing IT support ticketing experience featuring a temporary Development Requester Identity Context ("Login Simulator"), Zen Green Theme UI foundation, ticket creation with attachment uploads, ownership-isolated My Tickets paginated list, read-only ticket detail inspection, and attachment soft removal with strict audit trails.

---

## 2. Stakeholder Request Interpretation
The IT department requires an end-user-facing ticketing web application that enables Requesters to submit support tickets with supporting files, track their submitted tickets without seeing tickets of other users, inspect ticket status and details, and soft-remove attachments when needed. 

Because full authentication is scheduled for Lab 3, Lab 2 introduces a temporary Development Requester selection mechanism to simulate multi-user ownership during development and testing. Selecting a Requester establishes the active context for creating tickets, viewing "My Tickets", inspecting ticket details, and managing attachments.

---

## 3. Scope

### Included
- **Development Requester Context**: Active requester API (`GET /api/dev-requesters`), `localStorage` persistence, selector screen, header identity badge with "Change Requester" action, and instant data re-fetching upon requester switch.
- **Ticket Creation**: `POST /api/tickets` with backend ticket number generation (`TKT-2026-XXXXXX`), default status "NEW", mandatory fields, inline validation, Zen Green styling (`#F0F4F1` for read-only fields), submit busy states, and form state preservation on 500 server errors.
- **Attachment Management**: Attachment upload during ticket creation or on detail view (MIME types: JPG/JPEG, PNG, WEBP, PDF; max size 5 MB per file; max 5 active attachments per ticket).
- **My Tickets List**: Server-side pagination, search by summary/ticket number, filtering by category/priority/status, clear filters action, desktop responsive table / mobile card view, and strict ownership filtering (`requesterId`).
- **Ticket Detail View**: Read-only detail view (`GET /api/tickets/:id`) with ownership enforcement (`403 Forbidden` for non-owner access).
- **Attachment Soft Removal**: `DELETE /api/attachments/:id` requiring `removalReason`, setting `isRemoved = true`, recording `removedAt`, retaining visible metadata while disabling download/preview. Soft-removed attachments do NOT count toward the 5-active-files quota.
- **Zen Green Design System**: Applied design tokens (Primary `#006B3C`, Secondary `#0B7A46`, Pale Surface `#EAF6EF`, Background `#F5F7F6`, Read-Only `#F0F4F1`).

### Excluded
- Real authentication (passwords, JWT tokens, sessions, OAuth, password reset).
- IT Staff workflow (triage queue, claiming tickets, reassigning tickets, changing IT Priority).
- Ticket collaboration (Public Comments, Internal Notes, Actions Taken).
- Ticket status lifecycle transitions beyond initial "NEW" state.
- Administration functionality (managing users, categories, systems, or global settings).

---

## 4. Functional Requirements

- **FR-01 (Dev Requester Selection)**: The application must provide a Dev Requester Selection screen allowing users to choose an active Development Requester loaded from PostgreSQL (`GET /api/dev-requesters`). The choice must be persisted in `localStorage`. Inactive requesters (`isActive = false`) must not be selectable.
- **FR-02 (Dev Identity Display & Switching)**: The application header must display the active Development Requester identity and a "Change Requester" action. Changing requesters must immediately clear state and re-fetch requester-scoped data.
- **FR-03 (Ticket Submission)**: Requesters can create a new support ticket by providing Category, Related System, Requested Priority, Ticket Summary, Description, and optional initial file attachments.
- **FR-04 (Auto Ticket Number Generation)**: Upon ticket creation, the backend must generate a unique Ticket Number formatted as `TKT-2026-XXXXXX` where XXXXXX is a sequential 6-digit zero-padded integer.
- **FR-05 (Default Ticket Values)**: Newly created tickets must default to `currentStatus = "NEW"` and have `requesterId` set to the active Development Requester.
- **FR-06 (Form Validation & State Preservation)**: Frontend and backend must enforce field validation. If submission fails due to validation errors (400) or server error (500), all user-entered inputs and attached files must remain intact.
- **FR-07 (My Tickets List Retrieval)**: Requesters can view a list of tickets owned strictly by the active Development Requester context (`GET /api/tickets?requesterId=X`).
- **FR-08 (Search & Filtering)**: The My Tickets list must support real-time search by Ticket Number or Summary, filter by Category, Requested Priority, and Current Status, and include a "Clear Filters" action.
- **FR-09 (Pagination & Sorting)**: The ticket list must support server-side pagination (page number, page size) and default descending sort by creation timestamp.
- **FR-10 (Ownership Data Isolation)**: Direct access via API or UI to tickets or attachments belonging to a different Requester must be strictly rejected with HTTP 403 Forbidden.
- **FR-11 (Ticket Detail Inspection)**: Requesters can open an owned ticket to view read-only detail fields and attachment information.
- **FR-12 (Attachment Soft Removal)**: Requesters can soft-remove an attachment from an owned ticket by providing a non-empty `removalReason`. Soft removal sets `isRemoved = true` and `removedAt = current timestamp`.
- **FR-13 (Soft Removal Metadata & Download Block)**: Soft-removed attachments remain visually listed in detail view with a "Soft Removed" badge and removal metadata, but download and preview links are disabled.
- **FR-14 (Attachment Quota Exclusion)**: A ticket allows up to 5 active (`isRemoved = false`) attachments. Soft-removed attachments do not count toward this 5-active-file limit.

---

## 5. Business Rules

- **BR-01 (Backend Ticket Number Format)**: The official Ticket Number is auto-generated strictly by the backend using format `TKT-2026-XXXXXX`. Frontend input of Ticket Number is disabled/read-only.
- **BR-02 (Initial Ticket Status)**: Every newly created ticket MUST begin with `currentStatus = "NEW"`.
- **BR-03 (Dev Identity Testing Context)**: The Development Requester selector is strictly a testing context simulator for Lab 2. It must not be treated as a secure authentication system.
- **BR-04 (Attachment Constraints & Soft Removal Rules)**:
  - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
  - Max single file size: 5 MB (5,242,880 bytes).
  - Max active attachments per ticket: 5 files.
  - Soft removal is mandatory (`isRemoved = true`, `removedAt` set, `removalReason` required). Soft-removed files cannot be downloaded (`403 Forbidden` / `404 Not Found`).
- **BR-05 (Strict Ownership Data Isolation)**: All ticket and attachment retrieval, listing, upload, and soft-removal requests MUST verify `requesterId`. If requested resource `requesterId` does not match the active context `requesterId`, return `HTTP 403 Forbidden`.
- **BR-06 (Inactive Requester Guard)**: Inactive requesters (`isActive = false`) cannot be selected in the Dev Selector, cannot submit tickets, and cannot access API endpoints.
- **BR-07 (Field Validation & Trimming)**:
  - `summary`: Required, trimmed, minimum 5 characters, maximum 150 characters.
  - `description`: Required, trimmed, minimum 10 characters, maximum 3000 characters.
  - `categoryId`: Required, must exist and be active in database.
  - `relatedSystemId`: Required, must exist and be active in database.
  - `requestedPriority`: Required, must be one of `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
- **BR-08 (Error State & Form Retention)**: If ticket creation fails (HTTP 400, 422, or 500), all submitted text fields, dropdown selections, and attached files must remain intact in the UI form.
- **BR-09 (Empty & No-Results States)**: The My Tickets screen must clearly differentiate between "No Tickets Created Yet" (empty state with CTA to "Create Ticket") and "No Tickets Match Search/Filter Criteria" (no-results state with CTA to "Clear Filters").
- **BR-10 (Soft Removal Reason Requirement)**: Attachment soft removal without a non-empty string `removalReason` (minimum 3 characters) MUST be rejected with `HTTP 400 Bad Request`.

---

## 6. UI Specification Summary

- **Zen Green Design Tokens**:
  - Primary Green (`#006B3C`): App Header, Primary Submit buttons, primary actions.
  - Secondary Green (`#0B7A46`): Active tabs, focus accents, interactive links, hover states.
  - Pale Green Surface (`#EAF6EF`): Selected items, success callouts, subtle section emphasis.
  - Page Background (`#F5F7F6`): Near-white clean page background.
  - Read-Only Field BG (`#F0F4F1`): Soft gray-green shading for read-only fields.
  - Surface Cards (`#FFFFFF`): White cards with subtle border (`#E2E8F0`) and shadow.
  - Text Color (`#1C2826`): Dark charcoal-green for optimal contrast and readability.
  - Error Color (`#DC2626`): Dark red text and field borders for validation errors.
  - Warning Color (`#D97706`): Amber callouts and status badges.
- **Responsive Layout Rules**:
  - Desktop (`>= 992px`): Multi-column grid, maximum layout width centered at 1200px.
  - Tablet (`768px - 991px`): Two-column layout where practical; full width for Summary and Description.
  - Mobile (`< 768px`): Form fields stack vertically, buttons full width/touch-friendly, table converts to card view, zero horizontal scrolling.

---

## 7. Data Changes

### Database Schema Models (`prisma/schema.prisma`)
- **`RequesterUser`**: `id` (Int, PK), `name` (String), `email` (String, Unique), `department` (String), `isActive` (Boolean, default true), `createdAt`, `updatedAt`.
- **`Category`**: `id` (Int, PK), `name` (String, Unique), `description` (String?), `isActive` (Boolean, default true), `createdAt`, `updatedAt`.
- **`RelatedSystem`**: `id` (Int, PK), `name` (String), `code` (String, Unique), `isActive` (Boolean, default true), `createdAt`, `updatedAt`.
- **`Ticket`**: `id` (Int, PK), `ticketNumber` (String, Unique), `requesterId` (Int, FK to `RequesterUser`), `categoryId` (Int, FK to `Category`), `relatedSystemId` (Int, FK to `RelatedSystem`), `summary` (String), `description` (String), `requestedPriority` (Enum: `LOW`, `MEDIUM`, `HIGH`, `URGENT`), `itPriority` (Enum: `LOW`, `MEDIUM`, `HIGH`, `URGENT`, default `MEDIUM`), `currentStatus` (Enum: `NEW`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, default `NEW`), `createdAt`, `updatedAt`.
- **`Attachment`**: `id` (Int, PK), `ticketId` (Int, FK to `Ticket`), `filename` (String), `originalName` (String), `mimeType` (String), `sizeBytes` (Int), `filePath` (String), `isRemoved` (Boolean, default false), `removedAt` (DateTime?), `removalReason` (String?), `createdAt`.

### Database Indexes & Migration
- Migration Name: `init_lab2`
- Indexes: `[requesterId]`, `[ticketNumber]`, `[categoryId]`, `[requestedPriority]`, `[currentStatus]`, `[ticketId]`.

---

## 8. API Contract Summary
- `GET /api/dev-requesters`: Fetch active Development Requesters (200 OK).
- `GET /api/categories`: Fetch active Ticket Categories (200 OK).
- `GET /api/related-systems`: Fetch active Related Systems (200 OK).
- `POST /api/tickets`: Create Ticket for active requester (201 Created / 400 / 403 / 500).
- `GET /api/tickets`: List owned tickets with search, filter, pagination (200 OK / 400 / 403).
- `GET /api/tickets/:id`: Fetch detail of owned ticket (200 OK / 403 / 404).
- `POST /api/tickets/:id/attachments`: Upload attachment to owned ticket (201 Created / 400 / 403 / 413).
- `GET /api/attachments/:id/download`: Download active attachment (200 OK / 403 / 404).
- `DELETE /api/attachments/:id`: Soft-remove attachment with reason (200 OK / 400 / 403 / 404).

---

## 9. Acceptance Criteria

- **AC-01 (Dev Requester Selection)**: Given a user on the Dev Selector Screen, when they select an active Development Requester and click "Continue", then the selection is saved in `localStorage`, the top header displays their name and email, and the user is navigated to "My Tickets".
- **AC-02 (Dev Requester Data Isolation)**: Given Requester A is selected, when Requester A views "My Tickets", then only tickets belonging to Requester A are returned; changing context to Requester B re-fetches tickets and displays only Requester B's tickets.
- **AC-03 (Ticket Submission Success)**: Given valid Category, System, Priority, Summary, and Description inputs, when the requester submits the ticket form, then a new ticket is saved in PostgreSQL with status "NEW", a unique Ticket Number `TKT-2026-XXXXXX` is generated, and a success view displays the Ticket Number.
- **AC-04 (Ticket Creation Validation Error)**: Given invalid inputs (e.g. summary < 5 characters), when the requester submits the form, then red validation messages appear below invalid fields, API submission is blocked or returns 400, and user input is preserved.
- **AC-05 (Server Error Form Preservation)**: Given the backend server encounters a 500 error during submission, when submission fails, then a global red error alert appears while all entered form fields and selected file attachments remain intact in the UI.
- **AC-06 (Attachment Validation & Limits)**: Given a file attachment attempt, when the file is an unpermitted type (e.g. `.exe`) or exceeds 5 MB, then an inline file error message appears and the invalid file is rejected before submission.
- **AC-07 (Active Attachment Quota)**: Given a ticket with 5 active attachments, when the user attempts to upload a 6th attachment, then the upload is blocked with message "Maximum 5 active attachments allowed per ticket".
- **AC-08 (My Tickets Search & Filter)**: Given a list of owned tickets, when the user enters search text or selects Category/Priority/Status filters, then the list updates dynamically; clicking "Clear Filters" restores the full list.
- **AC-09 (My Tickets Pagination)**: Given 15 owned tickets and a page size of 5, when navigating between pages 1, 2, and 3, then the correct 5 tickets are rendered per page along with pagination summary text "Showing 1-5 of 15".
- **AC-10 (Unauthorized Ticket Access)**: Given Requester B attempts to access `GET /api/tickets/:id` or open the UI detail page of a ticket owned by Requester A, then the backend responds with HTTP 403 Forbidden and the UI renders an "Access Denied" state.
- **AC-11 (Attachment Soft Removal Flow)**: Given an owned ticket detail page, when the owner clicks "Remove" on an active attachment, enters a valid removal reason in the modal, and confirms, then `isRemoved` becomes `true`, `removedAt` is recorded, the badge updates to "Soft Removed", and download links become disabled.
- **AC-12 (Blocked Download of Soft-Removed Attachment)**: Given a soft-removed attachment ID, when any request calls `GET /api/attachments/:id/download`, then the backend responds with HTTP 403 Forbidden or 404 Not Found with message "File soft-removed and unavailable for download".

---

## 10. Definition of Done

### Product Completion DoD
- [ ] All Functional Requirements (FR-01 through FR-14) implemented and verified.
- [ ] All Business Rules (BR-01 through BR-10) enforced across backend and frontend.
- [ ] Prisma schema updated and migration `init_lab2` applied.
- [ ] Idempotent seed script populating 4 Categories, 6 Systems, 4 Active requesters, and 1 Inactive requester.
- [ ] Dev Requester Identity Context operational with `localStorage` persistence and header switching.
- [ ] Zen Green design tokens consistently applied across shell, forms, tables, cards, and modals.
- [ ] All automated unit, API integration, UI component, and Playwright E2E tests passing.
- [ ] Responsive Playwright screenshots saved in `artifacts/lab-02/screenshots/`.

### Course Delivery DoD
- [ ] Feature branch `feature/lab2-spec-docs` opened via PR targeting `lab2-staging` with "Closes #1".
- [ ] Reviewer records updated in `docs/lab-02/reviewer.md`.
- [ ] AI prompt log and reflection documented in `docs/lab-02/ai-use.md`.
- [ ] Final integration PR from `lab2-staging` merged into `main` after all DoD requirements pass.

---

## 11. Assumptions and Decisions
- **Dev Requester Context Storage**: Key `toktickit_dev_requester_id` stored in browser `localStorage`.
- **Sequential Ticket Numbers**: Backend sequence or atomic query generates 6-digit zero-padded numbers prefixed with `TKT-2026-` (e.g. `TKT-2026-000001`).
- **File Storage**: Development uploads saved in `server/uploads/` using sanitized UUID filenames (`[uuid]-[original-name]`).
- **Soft Removal Retention**: Files remain on server storage for compliance audit but API strictly blocks download/preview when `isRemoved = true`.