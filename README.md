# TokTickIT - IT Service Desk (Lab 1 & Lab 2)

TokTickIT is a full-stack IT service desk web application designed to handle IT support requests across Account and Access, Hardware, Software, and Network domains.

- **Lab 1**: Established the core full-stack vertical slice, connecting React, Express, Prisma ORM, and PostgreSQL with master category endpoints and health check diagnostics.
- **Lab 2**: Delivered the complete Requester-facing IT Ticketing MVP built with the **Zen Green** design system, featuring a Development Identity Switcher, ticket creation with auto-generated ticket numbers, attachment management with soft-removal audit trails, searchable/paginated "My Tickets" views, and strict backend data isolation.

---

## 🛠️ Technology Stack

- **Frontend**: React + TypeScript + Vite + Bootstrap 5
- **Backend**: Node.js + Express + TypeScript (`tsx`)
- **Database & ORM**: PostgreSQL + Prisma ORM
- **Testing & Automation**: Vitest, Supertest, React Testing Library, and Playwright E2E

---

## 🚀 Key Features

### Lab 1 Features
- **Full-Stack Vertical Slice**: End-to-end integration between Vite React client, Express API server, and PostgreSQL via Prisma ORM.
- **Health Check Endpoint**: `GET /api/health` monitoring system uptime and database connectivity.
- **Master Category Lookup**: `GET /api/categories` serving IT support classifications (Account & Access, Hardware, Software, Network).

### Lab 2 Features
- **Dev Requester Identity Simulator**: Multi-user context switching with header badge display, `x-dev-requester-id` header injection, and `localStorage` persistence.
- **Ticket Creation**: Ticket submission with auto-generated sequential ticket numbers (`TKT-2026-XXXXXX`), category/system selection, inline field validation, and form input retention on 500 server errors.
- **Attachment Upload & Soft Removal**: Supporting JPG, PNG, WEBP, and PDF files (<= 5 MB, max 5 active files per ticket) with soft-removal audit records (`isRemoved = true`, timestamp, and reason logging).
- **My Tickets Workspace**: Server-side pagination, real-time search across ticket number/summary, category/priority/status filters, and mobile-responsive card layout.
- **Strict Data Isolation**: Backend-enforced ownership validation returning `403 Forbidden` for unauthorized cross-requester resource access.
- **Zen Green Design System**: Standardized design token palette (`#006B3C`, `#0B7A46`, `#EAF6EF`, `#F5F7F6`, `#F0F4F1`) applied across forms, tables, cards, and modals.

---

## 📁 Repository Structure

```
toktickit/
├── artifacts/              # Visual test artifacts & Playwright viewport screenshots
│   └── lab-02/
├── client/                 # React + TypeScript + Vite + Bootstrap frontend
│   ├── src/                # Application source code & identity context
│   └── tests/              # Frontend Vitest UI tests
│       ├── lab-01/         # Lab 1 App & Health check tests
│       └── lab-02/         # Lab 2 Form, Table, and Attachment component tests
├── docs/                   # Specifications, API contracts, test matrices, and reflections
│   ├── lab-01/             # Lab 1 docs (ai_use.md, reviewer.md, tests.md)
│   └── lab-02/             # Lab 2 specs (api-spec.md, specification.md, tests.md, ui-spec.md, ai_use.md, reviewer.md)
├── e2e/                    # Playwright end-to-end automation test suites
│   └── lab-02/             # E2E Requester flow & responsive screenshot tests
├── server/                 # Express + Node.js + TypeScript backend
│   ├── prisma/             # Schema definitions, migrations, and seed scripts
│   ├── src/                # Express routes, controllers, and middleware
│   ├── uploads/            # Local attachment binary storage
│   └── tests/              # Backend Supertest API integration tests
│       ├── lab-01/         # Lab 1 Health & Category API tests
│       └── lab-02/         # Lab 2 Ticket & Attachment API tests
├── .gitignore              # Git ignore configuration
├── ai-use.md               # Root AI use log & reflection
├── reviewer.md             # Definition of Done (DoD) audit checklist
└── README.md               # Unified project documentation
```

---

## 🚀 Setup & Installation Instructions

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **PostgreSQL**: Running instance on local machine or Docker container

---

### Step 1: Install Dependencies

1. **Frontend Dependencies:**
   ```bash
   cd client
   npm install
   ```

2. **Backend Dependencies:**
   ```bash
   cd server
   npm install
   ```

3. **Playwright Automation Browsers:**
   ```bash
   npx playwright install
   ```

---

### Step 2: Environment Setup

1. **Frontend Environment (`client/.env`):**
   ```bash
   cp client/.env.example client/.env
   ```
   *Default:* `VITE_API_URL="http://localhost:3000"`

2. **Backend Environment (`server/.env`):**
   ```bash
   cp server/.env.example server/.env
   ```
   *Default:* `DATABASE_URL="postgresql://postgres:postgres@localhost:15432/toktickit?schema=public"`

---

### Step 3: Database Migration & Seeding

Run Prisma schema synchronization and populate initial master data for both Lab 1 and Lab 2:

```bash
cd server
npx prisma generate
npx prisma db push --force-reset
npx prisma db seed
```

---

### Step 4: Running the Application

1. **Start Express API Backend (Port 3000):**
   ```bash
   cd server
   npm run dev
   ```

2. **Start React Frontend (Port 5173):**
   ```bash
   cd client
   npm run dev
   ```
   Access the application at `http://localhost:5173`.

---

## 🧪 Running Automated Test Suites

### Complete Backend API Integration Tests (Lab 1 & Lab 2)
```bash
cd server
npm test
```
*To run specific lab tests:*
- Lab 1: `npm test -- lab-01`
- Lab 2: `npm test -- lab-02`

### Complete Frontend Component Tests (Lab 1 & Lab 2)
```bash
cd client
npm test
```
*To run specific lab tests:*
- Lab 1: `npm test -- lab-01`
- Lab 2: `npm test -- lab-02`

### Playwright End-to-End Automation Tests
```bash
npx playwright test e2e/lab-02/
```

---

## 📑 Course Documentation References

### Lab 1 Documentation (`docs/lab-01/`)
- `docs/lab-01/ai_use.md`: Lab 1 AI Prompts & Reflection Log
- `docs/lab-01/reviewer.md`: Lab 1 Peer Review & DoD Checklist
- `docs/lab-01/tests.md`: Lab 1 Initial Test Plan

### Lab 2 Documentation (`docs/lab-02/`)
- `docs/lab-02/api-spec.md`: REST API Contracts, Headers & Error Specifications
- `docs/lab-02/specification.md`: Functional Requirements & Business Rules
- `docs/lab-02/tests.md`: Test Plan & Acceptance Criteria Traceability Matrix
- `docs/lab-02/ui-spec.md`: Zen Green Design System Tokens & Responsive Breakpoints
- `ai-use.md`: Root Generative AI Usage Log & Personal Reflection
- `reviewer.md`: Final Release DoD Audit & Verification Checklist