# TokTickIT - IT Service Desk (Lab 1, Lab 2 & Lab 3)

TokTickIT is a full-stack IT service desk web application designed to handle IT support requests across Account and Access, Hardware, Software, and Network domains. It is engineered with strict role-based access control, resilient backend authorization, and the **Zen Green** design language.

- **Lab 1**: Established the foundational full-stack vertical slice connecting React, Express, Prisma ORM, and PostgreSQL with master category lookup endpoints and health check diagnostics.
- **Lab 2**: Delivered the Requester-facing IT Ticketing MVP featuring a Development Identity Switcher, ticket creation with auto-generated sequential numbers, attachment uploads with soft-removal audit trails, searchable and paginated "My Tickets" workspace, and server-enforced requester data isolation.
- **Lab 3**: Replaced the temporary Development Requester switcher with secure credential-based authentication and role-based authorization (RBAC). Introduced mandatory first-login password change workflows, the IT Staff Ticket Queue with server-side queries, operational Ticket Detail panels with ownership claim/reassignment, independent IT Priority, permitted status transitions (BR-15), append-only Public Comments and role-restricted Internal Notes (amber styling), and minimalist Administrator User Management with account safety guards.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Bootstrap 5.3, custom Zen Green design tokens
- **Backend**: Node.js, Express, TypeScript (`tsx` runtime)
- **Database & ORM**: PostgreSQL, Prisma ORM (with database migrations & idempotent seeds)
- **Security & Session**: `bcryptjs` for salted password hashing, express-session / cookie-based authentication, server-side role & ownership authorization
- **Testing & Quality Assurance**: Vitest, Supertest, React Testing Library, and Playwright E2E browser automation

---

## 👥 Roles & Authorization Model (Lab 3 §4.3)

TokTickIT enforces strict server-side authorization across three distinct roles:

| Role | Permissions & Operational Scope |
| :--- | :--- |
| **Requester** | Authenticates with email and password; creates and manages owned tickets and active attachments; posts Public Comments; indicates when a reported problem appears resolved. Cannot view internal notes or access admin screens. |
| **IT Staff** | Views the shared IT Staff Ticket Queue with search, filters, sorting, and pagination; opens Ticket Detail; claims unassigned tickets or reassigns ownership; independently adjusts IT Priority; transitions tickets through permitted statuses; posts Public Comments; writes confidential Internal Notes. |
| **Administrator** | Manages user accounts via the minimalist User Management console; creates user accounts with initial temporary passwords; edits name, email, role, and activation status; sets or resets initial passwords; subject to safety guards (cannot self-deactivate, cannot deactivate the last active Administrator). |

---

## 🚀 Key Features by Sprint

### Lab 1 Increment: Foundation & Health Diagnostics
- **Full-Stack Vertical Slice**: End-to-end integration between Vite React client, Express API server, and PostgreSQL via Prisma ORM.
- **Health Check Endpoint**: `GET /api/health` monitoring system uptime, timestamp, and database connectivity.
- **Master Category Lookup**: `GET /api/categories` serving IT support classifications (Account & Access, Hardware, Software, Network).

### Lab 2 Increment: Requester Ticketing & Attachments
- **Ticket Creation**: Sequential ticket numbers (`TKT-2026-XXXXXX`), category/related-system selection, requested priority, inline field validation, and form retention.
- **Attachment Upload & Soft-Removal**: Supporting JPG, PNG, WEBP, and PDF files (<= 5 MB, max 5 active files per ticket) with soft-removal audit trails (`isRemoved = true`, timestamp, and reason logging).
- **My Tickets Workspace**: Real-time search across ticket number/summary, category/priority/status filters, pagination, and responsive desktop table vs. mobile cards.
- **Data Isolation**: Server-enforced requester ownership validation returning `403 Forbidden` for unauthorized cross-requester resource access.
- **Zen Green Design System**: Brand tokens (`#006B3C`, `#0B7A46`, `#EAF6EF`, `#F6FAF8`, `#1A1A1A`) applied across all cards, badges, buttons, and tables.

### Lab 3 Increment: Users, Roles, IT Staff Ticketing & Admin Screens
- **Secure Authentication (`/login`)**:
  - Email and password authentication with `bcryptjs` password verification.
  - Safe, uniform failure feedback ("Invalid email or password. Please try again.") preventing account enumeration.
  - Deactivated accounts blocked from system entry.
  - Session invalidation upon logout (`POST /api/auth/logout`).
- **Mandatory First-Login Password Change (`/change-password`)**:
  - Enforced password change wall for accounts marked `mustChangePassword = true` (BR-02).
  - Password complexity policy: minimum 8 characters, uppercase and lowercase letters, number, and special character.
  - Live password-strength checklist component with real-time rule fulfillment indicators.
- **IT Staff Ticket Queue (`/staff/queue`)**:
  - Triage console with server-side search (debounced across ticket number, summary, description).
  - Multi-parameter filters: category, status, IT priority, and ticket owner ("Assigned to Me", "Unassigned", or specific staff member).
  - Multi-column sortable headers (ticket number, created date, updated date, IT priority) with direction toggles.
  - Server-driven pagination metadata (`page`, `pageSize`, `totalCount`, `totalPages`).
  - Responsive presentation: desktop data table (>= 768px) and mobile card list (< 768px).
- **IT Staff Ticket Detail Operations (`/staff/tickets/:id`)**:
  - Read-only operational context (Ticket No, Category, System, Requester, Summary, Description, Requested Priority).
  - Interactive Ticket Owner select with one-click "Claim Ticket" or "Assign to Me" action.
  - Independent IT Priority selector distinct from Requester's Requested Priority.
  - Permitted Status Transition engine (BR-15): New, Open, In Progress, Waiting for Requester, Resolved, Closed, Reopened, Cancelled.
  - Resolution Summary enforcement (BR-17): minimum 5, maximum 1,000 characters required when transitioning to `RESOLVED` or `CLOSED`.
- **Public Comments & Confidential Internal Notes**:
  - Tabbed activity stream on Ticket Detail.
  - **Public Comments (FR-20)**: Visible to Requester, IT Staff, and Administrator; append-only (editing and deletion prohibited).
  - **Internal Notes (FR-21)**: Visible strictly to IT Staff and Administrator; styled in confidential pale-amber (`#FFFBEB` with `#F59E0B` border and lock badge); Requesters are strictly forbidden from viewing or querying notes.
  - Requester "Problem Appears Resolved" indication affordance on requester ticket detail.
- **Administrator User Management (`/admin/users`)**:
  - Directory listing showing Name, Email, Role, Status, and Edit / Reset actions.
  - Client-side search by name/email and role filter.
  - Create User modal with name, email, role, department, active switch, and auto-generated temporary password.
  - Edit User modal with role reassignment and activation/deactivation controls.
  - Administrative password reset modal generating compliant temporary passwords.
  - **BR-22 Self-Deactivation Guard**: Logged-in Administrator cannot deactivate their own account.
  - **BR-23 Last-Admin Guard**: Backend and UI block deactivation or role demotion of the final active Administrator.

---

## 🔑 Default Seed Credentials (Lab 3 §5.3)

All seed accounts are initialized via `server/prisma/seed.ts` with the default development password:
```text
Password123!
```

| Role | Full Name | Email Address | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Administrator** | System Administrator | `admin@toktickit.com` | Active | Primary administrator account |
| **Administrator** | John Smith | `john.smith@toktickit.com` | Active | Secondary admin for multi-admin tests |
| **IT Staff** | Michael Brown | `michael.brown@toktickit.com` | Active | IT Support Tier 2 / queue operator |
| **IT Staff** | Lisa Martinez | `lisa.martinez@toktickit.com` | Active | IT Operations staff member |
| **IT Staff** | James Wilson | `james.wilson@toktickit.com` | Active | `mustChangePassword = true` (test user) |
| **IT Staff** | Kevin Patel | `kevin.patel@toktickit.com` | Inactive | Deactivated IT Staff test account |
| **Requester** | Jennifer Anderson | `jennifer.anderson@kmutt.ac.th` | Active | Default requester identity |
| **Requester** | David Lee | `david.lee@kmutt.ac.th` | Active | Requester with existing tickets |
| **Requester** | Sarah Johnson | `sarah.johnson@kmutt.ac.th` | Active | Requester with existing tickets |
| **Requester** | Emily Davis | `emily.davis@toktickit.com` | Active | `mustChangePassword = true` (test user) |
| **Requester** | Inactive Test User | `inactive.test@kmutt.ac.th` | Inactive | Deactivated requester test account |

---

## 📁 Repository Structure

```
toktickit/
├── artifacts/                           # Playwright test results & review screenshots
│   ├── lab-02/                          # Lab 2 visual review captures
│   └── lab-03/                          # Lab 3 visual review captures
│       └── screenshots/
│           ├── authentication/          # Login, forced password change, invalid/inactive banners
│           ├── staff-queue/             # Desktop/mobile queues, search results, my-tickets
│           ├── staff-ticket-detail/     # Operations panel, amber internal notes, comments
│           └── user-management/         # Admin directory, create modal, safety guards
├── client/                              # React 18 + TypeScript + Vite frontend
│   ├── src/
│   │   ├── components/                  # Header, Badges, Modals, PasswordField, CommentItem
│   │   ├── context/                     # AuthContext (session, login, logout, password change)
│   │   ├── pages/                       # Login, ChangePassword, StaffTicketQueue, StaffTicketDetail, UserManagement
│   │   ├── api.ts                       # Typed client API client for all REST endpoints
│   │   ├── index.css                    # Zen Green design tokens and responsive utilities
│   │   └── router.tsx                   # Role-based route guard and URL router
│   └── tests/                           # Vitest + React Testing Library component tests
│       ├── lab-01/                      # Lab 1 client tests
│       ├── lab-02/                      # Lab 2 Requester UI tests
│       └── lab-03/                      # Lab 3 Login, Password, Queue, Detail, Admin tests
├── docs/                                # Specification by Deliberate Discovery documentation
│   ├── lab-01/                          # Lab 1 docs (ai-use.md, reviewer.md, tests.md)
│   ├── lab-02/                          # Lab 2 docs (specification.md, ui-spec.md, api-spec.md, tests.md, ai-use.md, reviewer.md)
│   └── lab-03/                          # Lab 3 docs
│       ├── specification.md             # Functional requirements, business rules & RBAC matrix
│       ├── ui-spec.md                   # Zen Green screens, states, tokens & responsive rules
│       ├── api-spec.md                  # REST endpoints, request/response schemas & error codes
│       ├── tests.md                     # Comprehensive test plan & AC traceability matrix
│       ├── ai-use.md                    # AI prompting log, prompt engineering & reflections
│       └── reviewer.md                  # Peer review record & Product Definition of Done
├── e2e/                                 # Playwright E2E automation test suites
│   ├── lab-02/                          # Lab 2 E2E requester flow tests
│   └── lab-03/                          # Lab 3 E2E test suites
│       ├── auth.spec.ts                 # Login, inactive accounts, password change wall
│       ├── staff-flow.spec.ts           # Queue triage, claim, priority, status, notes
│       ├── admin-flow.spec.ts           # User creation, editing, reset, self-deactivation guard
│       └── support.ts                   # E2E test helpers, fixtures & seed credentials
├── scripts/                             # Utility & automation scripts
│   └── capture-lab3-screenshots.mjs     # Playwright screenshot generator (21 review captures)
├── server/                              # Node.js + Express + TypeScript backend
│   ├── prisma/                          # Prisma schema, migrations & seed scripts
│   │   ├── migrations/                  # Versioned PostgreSQL database migrations
│   │   ├── schema.prisma                # Data model (User, Ticket, Attachment, Comment, Note)
│   │   └── seed.ts                      # Idempotent database seeder with realistic test fixtures
│   ├── src/                             # Express application code
│   │   ├── controllers/                 # Auth, Users, StaffQueue, TicketDetail, Comments controllers
│   │   ├── middleware/                  # Authentication, role-guard & error handling middleware
│   │   ├── routes/                      # Route declarations (/api/auth, /api/tickets, /api/admin)
│   │   └── index.ts                     # Express server bootstrap & database connection
│   └── tests/                           # Supertest API integration tests
│       ├── lab-01/                      # Lab 1 API tests
│       ├── lab-02/                      # Lab 2 API tests
│       └── lab-03/                      # Lab 3 API test suites (auth, queue, detail, notes, admin)
├── playwright.config.ts                 # Playwright E2E test configuration
├── package.json                         # Root package workspace scripts
└── README.md                            # Central project documentation
```

---

## 🚀 Setup & Installation Instructions

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **PostgreSQL**: Running instance on local machine or Docker container

---

### Step 1: Install Dependencies

From the project root:

1. **Install Frontend Dependencies:**
   ```bash
   cd client
   npm install
   cd ..
   ```

2. **Install Backend Dependencies:**
   ```bash
   cd server
   npm install
   cd ..
   ```

3. **Install Playwright Browsers (for E2E tests):**
   ```bash
   npx playwright install
   ```

---

### Step 2: Environment Configuration

1. **Frontend Environment (`client/.env`):**
   ```bash
   cp client/.env.example client/.env
   ```
   *Default value:* `VITE_API_URL="http://localhost:3000"`

2. **Backend Environment (`server/.env`):**
   ```bash
   cp server/.env.example server/.env
   ```
   *Default value:* `DATABASE_URL="postgresql://postgres:postgres@localhost:15432/toktickit?schema=public"`

---

### Step 3: Database Migration & Seeding

Synchronize the Prisma schema with your PostgreSQL database and populate the idempotent seed data (master categories, related systems, users across all 3 roles, and realistic tickets):

```bash
cd server
npx prisma generate
npx prisma migrate dev
# Or for a clean reset:
# npx prisma db push --force-reset
npm run prisma:seed
cd ..
```

---

### Step 4: Running the Application

1. **Start Express API Backend (Port 3000):**
   ```bash
   cd server
   npm run dev
   ```
   *Health endpoint:* `http://localhost:3000/api/health`

2. **Start React Frontend (Port 5173):**
   ```bash
   cd client
   npm run dev
   ```
   *Application entry:* `http://localhost:5173`

---

## 🧪 Running Automated Test Suites

TokTickIT features extensive automated test coverage across unit, component, API integration, and end-to-end levels.

### 1. Backend API Integration Tests (Vitest + Supertest)
```bash
cd server
npm test
```
*Run Lab 3 API tests only:*
```bash
cd server
npx vitest run tests/lab-03/
```
Covers:
- `auth.api.test.ts`: Login, logout, current user, session cookie handling, password change validation
- `staff-queue.api.test.ts`: Search queries, category/status/priority/owner filtering, sorting, pagination
- `staff-ticket-detail.api.test.ts`: Ticket claiming, owner reassignment, IT priority updates, BR-15 status transitions, resolution summary enforcement
- `comments-notes.api.test.ts`: Public comments visibility, append-only rules, internal notes staff-only restriction, requester 403 blocking
- `users-admin.api.test.ts`: Admin directory listing, user creation, duplicate email rejection, role editing, self-deactivation blocking, last-admin guard

### 2. Frontend Component & UI Tests (Vitest + React Testing Library)
```bash
cd client
npm test
```
*Run Lab 3 UI tests only:*
```bash
cd client
npx vitest run tests/lab-03/
```
Covers:
- `Login.test.tsx`: Email/password inputs, validation errors, invalid credentials alert, disabled account feedback
- `ChangePassword.test.tsx`: Password wall interception, real-time checklist policy rules, mismatch validation, successful change
- `StaffTicketQueue.test.tsx`: Desktop table rendering, debounced search, filter selections, responsive card layout
- `StaffTicketDetail.test.tsx`: Operational info cards, claim/assign actions, status transition options, comments and internal notes tabs
- `UserManagement.test.tsx`: Admin directory table, create user modal, role filter, self-deactivation guard, last-admin error banner

### 3. Playwright End-to-End Automation Tests
Ensure both backend and frontend servers are running, or allow Playwright's webServer config to auto-start them:
```bash
# Run all Lab 3 E2E test specs:
npx playwright test e2e/lab-03/
```

### 4. Automated Visual Review Screenshot Capture
Execute the automated Playwright script to capture all 21 review screenshots across desktop, tablet, and mobile viewports:
```bash
node scripts/capture-lab3-screenshots.mjs
```
All outputs are organized under `artifacts/lab-03/screenshots/` across four subdirectories: `authentication/`, `staff-queue/`, `staff-ticket-detail/`, and `user-management/`.

---

## 📑 Lab 3 Course Documentation References

All design specifications and engineering artifacts strictly follow the course Spec DD, Test DD, and AI-assisted workflow:

| Document | File Path | Description |
| :--- | :--- | :--- |
| **Engineering Specification** | [docs/lab-03/specification.md](docs/lab-03/specification.md) | Sprint 3 goal, scope, numbered Functional Requirements (FR-01 to FR-25), Business Rules (BR-01 to BR-24), RBAC matrix, and Definition of Done. |
| **UI Specification** | [docs/lab-03/ui-spec.md](docs/lab-03/ui-spec.md) | Zen Green design tokens, badge styles, screen structures (Screens 1 to 5), modal specs, and responsive viewport rules. |
| **REST API Specification** | [docs/lab-03/api-spec.md](docs/lab-03/api-spec.md) | Endpoint contracts, request/response bodies, HTTP status codes, authentication mechanism, and safe error handling rules. |
| **Test Plan & Traceability** | [docs/lab-03/tests.md](docs/lab-03/tests.md) | Comprehensive test matrix mapping Acceptance Criteria (AC-01 to AC-18) to automated unit, API, UI, and E2E test files. |
| **AI Prompting & Reflection** | [docs/lab-03/ai-use.md](docs/lab-03/ai-use.md) | Complete log of AI prompts, model reflection, prompt engineering techniques, and specification/coding agent evaluation. |
| **Peer Review Record** | [docs/lab-03/reviewer.md](docs/lab-03/reviewer.md) | Peer review audit trails, pull request links, review comments, responses, and Product Definition of Done verification checklist. |