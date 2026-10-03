# Lab 3 Sprint Engineering Specification
## TokTickIT Users, Roles, IT Staff Ticketing, and Admin Screens

---

## 1. Sprint Goal
Deliver an enterprise-grade role-based IT ticketing foundation by replacing the temporary Development Requester identity selector with secure authentication and first-login password enforcement, introducing an operational IT Staff Ticket Queue with triage, assignment, priority, status transition workflows, and segregated Public Comments and Internal Notes, alongside a minimalist Administrator User Management console with robust safety safeguards—while ensuring 100% data preservation and backward compatibility for all Lab 2 ticket and attachment operations.

---

## 2. Stakeholder Request Interpretation
The TokTickIT platform must transition from a developer-simulated prototype to an operational, multi-role IT service management system. The temporary Development Requester dropdown simulator must be decommissioned in favor of genuine credential-based authentication (email and password) supporting three distinct system roles: **Requester**, **IT Staff**, and **Administrator**.

Key stakeholder expectations include:
- **Authentication & Security Lifecycle**: Users authenticate with email and password. Any user provisioned with an initial/temporary password must be forced to set a new password before accessing application functions. Sessions must be securely maintained, with clean logout and strict server-side authorization enforcement (hidden frontend buttons are not security).
- **Requester Continuity & Ownership**: Requesters retain all Lab 2 capabilities (creating tickets, uploading attachments, viewing owned tickets, soft-removing attachments), but user identity is strictly derived from the authenticated session. Requesters can post Public Comments and indicate that their reported issue appears resolved, but they cannot formally resolve or close tickets.
- **IT Staff Queue & Ticket Triage**: IT Staff require a dedicated, high-efficiency Ticket Queue featuring search, category/priority/status filters, sorting, and pagination. On the Ticket Detail view, IT Staff can claim ownership, reassign tickets, adjust IT Priority independently of the Requester's requested priority, progress tickets through a strict status lifecycle, publish Public Comments, and record confidential Internal Notes hidden from Requesters.
- **Administrator User Management**: Administrators require a clean, responsive management console to view users, filter by role, search by name/email, create accounts with temporary credentials, edit basic account details, toggle active/inactive status, and issue password resets. Critical safety rules must prevent administrative self-lockout or leaving the system with zero active administrators.
- **Design Consistency**: All screens must strictly adhere to the established Zen Green design system (primary `#006B3C`, hover `#0B7A46`, pale `#EAF6EF`, read-only `#F0F4F1`) and maintain full responsiveness across desktop, tablet, and mobile form factors.

---

## 3. Scope

### 3.1. Included in Sprint 3
- **Authentication & Session Management**:
  - Secure credential-based login (`POST /api/auth/login`) with email and hashed password.
  - Mandatory first-login password change wall (`POST /api/auth/change-password`) blocking application navigation until resolved.
  - Authenticated session verification (`GET /api/auth/me`) and secure logout (`POST /api/auth/logout`).
  - Removal of the Lab 2 Dev Requester selector and localStorage identity simulation.
- **Role-Based Access Control (RBAC)**:
  - Three distinct roles: `REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`.
  - Dynamic application navigation shell displaying only role-permitted routes and actions.
  - Server-side role and ownership enforcement on every API endpoint.
- **Requester Workflow Evolution**:
  - Automatic attribution of ticket creation to the authenticated Requester.
  - Strict ownership-isolated My Tickets list and Ticket Detail inspection.
  - Public Comment authoring and timeline viewing.
  - "Problem Appears Resolved" indication workflow.
  - Continuation of attachment upload, download, and soft removal with audit reasons.
- **IT Staff Operational Workflow**:
  - Shared IT Staff Ticket Queue with search (ticket number, summary), filters (category, priority, status, ownership), sorting, and pagination.
  - IT Staff Ticket Detail interface with clear distinction between read-only and editable fields.
  - Ticket claiming ("Assign to Me") and reassignment across active IT Staff.
  - Independent IT Priority management (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
  - Permitted ticket status transitions (`NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`).
  - Resolution summary capture upon resolving or closing tickets.
  - Segregated Public Comments (visible to all parties) and Internal Notes (restricted to IT Staff and Admins).
- **Administrator User Management**:
  - User listing with name/email search, role filtering, and status badges.
  - Account creation with single role assignment and initial password generation.
  - Account editing (name, email, role, active status).
  - Administrative password reset issuing a new temporary password with mandatory change flag.
  - Critical safety barriers: Self-deactivation prevention and last active Administrator guard.
- **Database & Migration**:
  - Evolution of Prisma schema from `RequesterUser` to a unified `User` model with password hashing, role enums, and state flags.
  - Preservation of all existing Lab 2 Tickets, Attachments, Categories, and Systems.
  - Idempotent seed data for all roles, sample tickets across statuses, comments, and notes.

### 3.2. Explicitly Excluded from Sprint 3 (as per Handout Section 4.2)
- Email invitations, password-reset emails, multi-factor authentication (MFA), social login, and single sign-on (SSO).
- Self-registration and Requester-created accounts.
- "Actions Taken" by IT Staff (deferred to Lab 4).
- Formal SLA calculations, automated escalation rules, and email/SMS/webhook notification services.
- Reporting dashboards and KPI analytics beyond simple queue counter metrics.
- Multi-tenant organizations, department hierarchy trees, and customer administration.
- Multiple roles assigned to a single user (strictly 1 user = 1 role).
- User deletion (hard deletion), bulk user operations, user import/export, and account history audit screens.
- Extended user profiles (profile photos, phone numbers, custom metadata).
- Email delivery of initial passwords or reset links (passwords displayed or communicated via local lab behavior).
- Account lockout policies, administrator approval workflows, and advanced identity-management features.
- Advanced user-list features such as mandatory pagination, multi-column sorting, and multiple simultaneous complex filters on the Administrator screen.
- Production-grade cloud deployment or container orchestration changes.

---

## 4. Functional Requirements

### 4.1. Authentication & Session Management
- **FR-01 (Credential Authentication)**: The system must allow registered users to authenticate using their email address and password. Successful authentication returns the user's profile and establishes an authenticated session.
- **FR-02 (Inactive Account Guard)**: The authentication service must reject login attempts from deactivated accounts (`isActive = false`) with a generic, safe error message without leaking sensitive account metadata.
- **FR-03 (Mandatory First-Login Password Change)**: Any authenticated user marked with `requiresPasswordChange = true` must be immediately intercepted by a password change screen. Normal application screens, routes, and operational APIs must remain inaccessible until a valid new password is saved.
- **FR-04 (Password Validation Criteria)**: Password updates must enforce strong complexity rules: minimum 8 characters, at least one uppercase letter, one lowercase letter, one numeric digit, and one special character.
- **FR-05 (Current User Profile Retrieval)**: The frontend must retrieve the authenticated user's profile (`GET /api/auth/me`) upon application initialization to determine active session status, identity, role, and password-change requirement.
- **FR-06 (Secure Logout)**: Users must be able to log out from any screen. Logging out invalidates the server session, purges client-side authentication state, and redirects the user to the login screen.

### 4.2. Role-Based Navigation & Access Control
- **FR-07 (Role-Filtered Navigation Shell)**: The application navigation bar must dynamically render links permitted strictly for the active user's role:
  - **Requester**: "My Tickets", "Create Ticket", Profile dropdown.
  - **IT Staff**: "My Queue", "Create Ticket", Profile dropdown.
  - **Administrator**: "Admin" (User Management), Profile dropdown.
- **FR-08 (Server-Side Authorization Enforcement)**: Every API endpoint must enforce role and resource authorization on the server. Unauthorized access attempts must respond with `401 Unauthorized` (if unauthenticated) or `403 Forbidden` (if role/ownership is unauthorized).

### 4.3. Requester Ticketing & Ownership Continuity
- **FR-09 (Authenticated Ticket Submission)**: When a Requester submits a ticket, the backend must assign ownership (`requesterId`) strictly from the authenticated session, completely ignoring any client-supplied ID parameters.
- **FR-10 (Requester Data Isolation)**: Requesters must only be able to retrieve, view, and interact with tickets they own. Direct access to tickets or attachments belonging to other users must be blocked with `403 Forbidden` or `404 Not Found`.
- **FR-11 (Decommissioning Dev Selector)**: The Lab 2 Dev Requester selection screen, header switch button, and localStorage mock identity must be completely removed from production workflows.
- **FR-12 (Problem Appears Resolved Indication)**: A Requester viewing an owned active ticket must be provided with an action to indicate that "The problem appears resolved". This records an event and public message but does not directly set the ticket status to `RESOLVED` or `CLOSED`.

### 4.4. IT Staff Ticket Queue & Management
- **FR-13 (Shared Ticket Queue Retrieval)**: IT Staff and Administrators must be able to view a paginated list of all system tickets (`GET /api/staff/tickets`).
- **FR-14 (Queue Search & Filtering)**: The IT Staff Ticket Queue must support real-time search by Ticket Number or Summary, and filtering by Category, Status, Requested Priority, IT Priority, and Ticket Owner (including "Unassigned").
- **FR-15 (Queue Sorting & Pagination)**: The queue must support sorting by Created Date, Updated Date, IT Priority, and Ticket Number, with server-side pagination metadata (current page, total pages, total count).
- **FR-16 (Operational Ticket Detail Inspection)**: IT Staff must be able to open any ticket from the queue to view full ticket metadata, Requester details, attachments, public comments, and internal notes.
- **FR-17 (Ticket Claim & Reassignment)**: IT Staff must be able to claim unassigned tickets ("Assign to Me") or reassign tickets to any active IT Staff member or Administrator.
- **FR-18 (IT Priority Management)**: IT Staff must be able to update the ticket's `itPriority` independently of the Requester's original `requestedPriority`.
- **FR-19 (Permitted Status Transitions)**: IT Staff must be able to advance ticket statuses according to the defined lifecycle state machine. Transitioning to `RESOLVED` or `CLOSED` requires an accompanying resolution summary.

### 4.5. Comments & Operational Notes
- **FR-20 (Public Comments Stream)**: Requesters, IT Staff, and Administrators can read and post append-only Public Comments on a ticket. Comments display author name, role badge, timestamp, and content.
- **FR-21 (Internal Notes Stream)**: IT Staff and Administrators can read and post append-only Internal Notes on a ticket. Internal Notes are strictly confidential and must never be exposed or returned to Requesters.
- **FR-22 (Comment & Note Validation)**: Comments and Internal Notes must reject empty or whitespace-only strings and must be constrained between 1 and 2,000 characters.

### 4.6. Administrator User Management
- **FR-23 (User Directory Listing)**: Administrators can view a directory of all registered users displaying Name, Email, Role, Status (`Active`/`Inactive`), and an Edit action.
- **FR-24 (User Search & Filter)**: The user directory must support search by name or email, and filtering by role (`REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`).
- **FR-25 (User Account Creation)**: Administrators can create new user accounts specifying Full Name, Email Address, Role (exactly one), Active status, and an Initial Password (marked as requiring password change on first login).
- **FR-26 (User Account Editing)**: Administrators can update a user's Full Name, Email Address, Role, and Active status.
- **FR-27 (Administrative Password Reset)**: Administrators can set a new initial password for any user account, immediately flagging the account as requiring a password change upon next login.
- **FR-28 (Administrator Self-Protection Guard)**: An Administrator cannot deactivate their own account or demote their own role.
- **FR-29 (Last Administrator Protection Guard)**: The system must block any update that would deactivate or demote the last remaining active Administrator in the system.
- **FR-30 (Prohibition of Hard Deletion)**: User accounts cannot be permanently deleted from the database; account revocation is managed strictly via deactivation (`isActive = false`).

---

## 5. Business Rules

### 5.1. Authentication & Credentials Rules
- **BR-01 (Active User Authentication)**: Only an active user (`isActive = true`) with valid credentials may authenticate. Inactive accounts receive `401 Unauthorized` with a generic message: `"Invalid email or password."`
- **BR-02 (First-Login Password Wall)**: A user marked with `requiresPasswordChange = true` cannot access normal application screens, data queries, or mutation endpoints until a new valid password is saved. Any operational API call made with this flag set returns `403 Forbidden` with error code `PASSWORD_CHANGE_REQUIRED`.
- **BR-03 (Password Complexity Standards)**: All passwords (both initial and changed) must meet the following criteria:
  - Minimum length of 8 characters, maximum 100 characters.
  - At least one uppercase English letter (`A-Z`).
  - At least one lowercase English letter (`a-z`).
  - At least one numeric digit (`0-9`).
  - At least one special character (e.g. `!@#$%^&*()_+-=[]{}|;:,.<>?`).
- **BR-04 (Cryptographic Password Hashing)**: Passwords must never be stored in plaintext. Passwords must be hashed using `bcrypt` (salt rounds >= 10) or `argon2id`.
- **BR-05 (Session Invalidation & Expiration)**: Authenticated sessions must expire after a configurable duration (default: 8 hours). Logout immediately destroys the session or clears the HTTP-only authentication cookie.

### 5.2. Role, Ownership & Authorization Rules
- **BR-06 (Single Role Invariant)**: Each user account must be assigned exactly one role from the permitted enum: `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`. Multiple roles per user are strictly forbidden.
- **BR-07 (Server-Determined Requester Ownership)**: The authenticated user's ID, and never a client-supplied parameter, establishes ownership of Requester operations. Any attempt to spoof `requesterId` in request bodies or query params is ignored or rejected.
- **BR-08 (Requester Data Privacy & IDOR Prevention)**: A Requester can only read and modify tickets and attachments that they own (`ticket.requesterId == session.userId`). Accessing resources owned by another user returns `403 Forbidden` or `404 Not Found`.
- **BR-09 (Internal Notes Confidentiality)**: Internal Notes are strictly confidential to IT Staff and Administrators. Any request from a Requester attempting to fetch or write Internal Notes must be rejected with `403 Forbidden` without revealing note count or existence.
- **BR-10 (Administrator Ticket Boundary)**: In Lab 3, Administrator and IT Staff responsibilities are conceptually segregated. Administrators manage user accounts; IT Staff manage tickets. Administrators have read access to tickets and comments for governance, but ticket queue triage is primarily an IT Staff workflow.

### 5.3. Ticket Queue, Triage & Ownership Rules
- **BR-11 (Eligible Ticket Owners)**: A ticket may have zero or one primary Ticket Owner (`ownerId`). The assigned owner must be an active user with role `IT_STAFF` or `ADMINISTRATOR`. Requesters can never own ticket resolution.
- **BR-12 (Independent Priority Evolution)**: `requestedPriority` is set by the Requester at ticket creation and is immutable. `itPriority` is initialized to match `requestedPriority` at creation, but may subsequently be updated only by IT Staff or Administrators.
- **BR-13 (Unassigned Ticket State)**: New tickets are created unassigned (`ownerId = null`). IT Staff can claim ownership ("Assign to Me") or reassign ownership to another active IT Staff member. Reassigning to `null` is permitted if a ticket needs to be returned to the general pool.

### 5.4. Ticket Status Lifecycle & Transitions
- **BR-14 (Permitted Ticket Statuses)**: Tickets must strictly use one of the 8 defined lifecycle statuses:
  1. `NEW`: Initial status upon submission by Requester.
  2. `OPEN`: Ticket has been reviewed/acknowledged by IT Staff or assigned an owner.
  3. `IN_PROGRESS`: IT Staff is actively working on the ticket.
  4. `WAITING_FOR_REQUESTER`: IT Staff is blocked waiting for additional information from the Requester.
  5. `RESOLVED`: IT Staff has implemented a fix/solution.
  6. `CLOSED`: Ticket is formally completed and archived.
  7. `REOPENED`: A previously resolved ticket requires further attention due to recurring issue.
  8. `CANCELLED`: Ticket was withdrawn by Requester or declared invalid/duplicate by IT Staff.
- **BR-15 (Status Transition Enforcement Matrix)**:
  Any status transition not explicitly allowed in the matrix below MUST be rejected by the backend with `422 Unprocessable Entity`:

| Current Status | Permitted Target Statuses | Permitted Roles | Notes / Conditions |
| :--- | :--- | :--- | :--- |
| `NEW` | `OPEN`, `IN_PROGRESS`, `CANCELLED` | IT Staff, Administrator | Auto-moves to `OPEN` on claim. |
| `OPEN` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | IT Staff, Administrator | Normal triage progression. |
| `IN_PROGRESS` | `WAITING_FOR_REQUESTER`, `RESOLVED`, `OPEN`, `CANCELLED` | IT Staff, Administrator | Active work flow. |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS`, `OPEN`, `RESOLVED`, `CANCELLED` | IT Staff, Administrator | Auto-transitions or prompts on Requester comment. |
| `RESOLVED` | `CLOSED`, `REOPENED` | IT Staff, Administrator | Resolution summary required. |
| `REOPENED` | `IN_PROGRESS`, `OPEN`, `RESOLVED`, `CANCELLED` | IT Staff, Administrator | Treated as urgent active work. |
| `CLOSED` | `REOPENED` (Admin only) | Administrator | Terminal state; reopen restricted. |
| `CANCELLED` | None (Terminal) | — | No further transitions allowed. |

- **BR-16 (Requester Resolution Limitation)**: Requesters may indicate via an action that the "Problem Appears Resolved", but CANNOT directly change the ticket status to `RESOLVED` or `CLOSED`. This action creates a Public Comment / notification for IT Staff to formally verify and resolve.
- **BR-17 (Mandatory Resolution Summary)**: When moving a ticket to `RESOLVED` or `CLOSED`, IT Staff must provide a non-empty `resolutionSummary` (minimum 5 characters, maximum 1,000 characters) documenting the fix.

### 5.5. Comments and Internal Notes Rules
- **BR-18 (Append-Only Invariant)**: Comments and Internal Notes are strictly append-only. Editing, modifying, or deleting existing entries is excluded in Lab 3.
- **BR-19 (Backend Attribution)**: The author (`authorId`) and timestamp (`createdAt`) of every comment and note must be determined exclusively by the backend from the authenticated session.
- **BR-20 (Content Sanitization & Limits)**: Comment and note text must be trimmed of leading/trailing whitespace. Content must be between 1 and 2,000 characters. Blank or whitespace-only submissions must be rejected with `400 Bad Request`.

### 5.6. Administrator User Management & Safety Rules
- **BR-21 (Unique Email Constraint)**: Every user account must have a globally unique email address. Duplicate email addresses (compared case-insensitively) must be rejected with `409 Conflict`.
- **BR-22 (Admin Self-Deactivation Prohibition)**: An Administrator is strictly prohibited from deactivating their own account. Any attempt to update their own `isActive` to `false` must be rejected with `422 Unprocessable Entity`.
- **BR-23 (Last Administrator Invariant)**: The system must enforce that at least one active Administrator exists at all times. Any action (deactivation or role change) that would result in zero active Administrators must be blocked with `422 Unprocessable Entity` and a descriptive safety error message.
- **BR-24 (Soft Deactivation Over Deletion)**: Hard deletion of user records is strictly prohibited (`DELETE /api/admin/users/:id` does not exist). Accounts must be deactivated via `isActive = false`, preserving all associated historical tickets, comments, and audit links.
- **BR-25 (Temporary Password Reset Lifecycle)**: When an Administrator creates a user or resets an initial password, the account must be flagged with `requiresPasswordChange = true`.

---

## 6. UI Specification Summary
*(Refer to `docs/lab-03/ui-spec.md` for comprehensive design tokens, wireframes, and responsive specifications).*

- **Zen Green Design System**:
  - Primary Green: `#006B3C` (Header, Primary buttons, active highlights).
  - Hover Green: `#0B7A46` (Button hover, active tab rings).
  - Pale Surface: `#EAF6EF` (Success alerts, active filters, selected pills).
  - Background: `#F5F7F6` / `#F6FAF8` (Clean, modern canvas).
  - Read-Only Field BG: `#F0F4F1` (Non-editable system fields, disabled inputs).
  - Surface Cards: `#FFFFFF` (Borders: `#E2E8F0` or `rgba(0, 107, 60, 0.15)`).
  - Dark Charcoal Text: `#1C2826` / `#1A1A1A`.
  - Destructive / Error: `#DC2626` (Error banners, inactive badges, deactivation action).
  - Warning Accent: `#D97706` (Medium priority, pending status).
- **Core Screens & Navigation Modes**:
  1. **Login Screen**: Centered Zen card with brand header, email and password inputs with password visibility toggle, inline validation, and busy submit state.
  2. **First-Login Password Change Screen**: Intercept modal/screen requiring current temporary password, new password, confirm password, and visual password strength validation checklist.
  3. **Role-Aware Navigation Shell**: Displays TokTickIT brand logo, role-filtered menu items ("My Tickets", "Create Ticket", "My Queue", "Admin"), and right-aligned user badge with role pill and dropdown menu (Change Password, Logout).
  4. **IT Staff Ticket Queue**: Table view with search bar, filter triggers, status/priority badges, ownership attribution, pagination controls, and responsive card conversion for mobile.
  5. **IT Staff Ticket Detail**: Grouped sections for Ticket Details (read-only vs editable operational fields), claim/reassign controls, IT Priority picker, permitted status dropdown, resolution summary input, and tabbed activity feeds for Public Comments, Internal Notes, and Attachments.
  6. **Administrator User Management**: Directory table with search by name/email, role filter, active/inactive badges, "+ Create User" modal/drawer, account edit drawer, and password reset trigger with safety confirmation modals.
- **Accessibility & Feedback**:
  - WCAG 2.1 AA compliant contrast ratios across all text and interactive badges.
  - Visible focus indicators (`2px solid #0B7A46`) on all interactive controls.
  - Clear state rendering for Loading (skeletons/spinners), Empty, No-Results, Forbidden (403), and Server Error (500).

---

## 7. Data Changes & Migration

### 7.1. Database Schema Evolution (`server/prisma/schema.prisma`)
The Lab 2 schema is expanded to support genuine authentication, RBAC, ticket ownership, comments, and internal notes without discarding any existing data.

#### Updated & New Enums
```prisma
enum Role {
  REQUESTER
  IT_STAFF
  ADMINISTRATOR
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum TicketStatus {
  NEW
  OPEN
  IN_PROGRESS
  WAITING_FOR_REQUESTER
  RESOLVED
  CLOSED
  REOPENED
  CANCELLED
}
```

#### Evolved `User` Model (Replaces & Extends `RequesterUser`)
```prisma
model User {
  id                     String    @id @default(cuid())
  email                  String    @unique
  passwordHash           String
  name                   String
  role                   Role      @default(REQUESTER)
  department             String?
  isActive               Boolean   @default(true)
  requiresPasswordChange Boolean   @default(false)
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt

  // Relationships
  requestedTickets       Ticket[]       @relation("RequesterTickets")
  assignedTickets        Ticket[]       @relation("AssignedTickets")
  comments               Comment[]
  internalNotes          InternalNote[]

  @@index([email])
  @@index([role])
  @@index([isActive])
}
```

#### Evolved `Ticket` Model
```prisma
model Ticket {
  id                String       @id @default(cuid())
  ticketNumber      String       @unique
  requesterId       String
  ownerId           String?      // Primary IT Staff or Admin owner (nullable)
  categoryId        String
  relatedSystemId   String
  requestedPriority Priority
  itPriority        Priority     @default(MEDIUM)
  currentStatus     TicketStatus @default(NEW)
  summary           String
  description       String
  resolutionSummary String?      // Recorded when resolved/closed
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt

  requester         User          @relation("RequesterTickets", fields: [requesterId], references: [id])
  owner             User?         @relation("AssignedTickets", fields: [ownerId], references: [id])
  category          Category      @relation(fields: [categoryId], references: [id])
  relatedSystem     RelatedSystem @relation(fields: [relatedSystemId], references: [id])
  attachments       Attachment[]
  comments          Comment[]
  internalNotes     InternalNote[]

  @@index([requesterId])
  @@index([ownerId])
  @@index([categoryId])
  @@index([currentStatus])
  @@index([ticketNumber])
  @@index([itPriority])
  @@index([requestedPriority])
}
```

#### New `Comment` Model (Public Comments)
```prisma
model Comment {
  id        String   @id @default(cuid())
  ticketId  String
  authorId  String
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  ticket    Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  author    User     @relation(fields: [authorId], references: [id])

  @@index([ticketId])
  @@index([authorId])
}
```

#### New `InternalNote` Model (Confidential Operational Notes)
```prisma
model InternalNote {
  id        String   @id @default(cuid())
  ticketId  String
  authorId  String
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  ticket    Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  author    User     @relation(fields: [authorId], references: [id])

  @@index([ticketId])
  @@index([authorId])
}
```

#### Existing Models Preserved
- `Category`: `id`, `name`, `description`, `isActive`, `createdAt`, `updatedAt` (Preserved intact).
- `RelatedSystem`: `id`, `name`, `code`, `description`, `isActive`, `createdAt`, `updatedAt` (Preserved intact).
- `Attachment`: `id`, `ticketId`, `fileName`, `originalName`, `filePath`, `sizeBytes`, `mimeType`, `isRemoved`, `removedAt`, `removalReason`, `createdAt`, `updatedAt` (Preserved intact).

---

### 7.2. Data Migration Strategy from Lab 2
To migrate the database without data loss:
1. **Migration Script Execution**:
   - Create a Prisma migration (e.g. `20261004_lab3_auth_roles`).
   - Create the `Role` enum and update the `TicketStatus` enum with new values (`WAITING_FOR_REQUESTER`, `REOPENED`, `CANCELLED`).
   - Create table `User` with columns `id`, `email`, `passwordHash`, `name`, `role`, `department`, `isActive`, `requiresPasswordChange`, `createdAt`, `updatedAt`.
   - Copy all records from `RequesterUser` into `User` with:
     - `role = 'REQUESTER'`
     - `passwordHash = '<bcrypt-hash-of-InitialPass123!>'`
     - `requiresPasswordChange = true`
   - Alter table `Ticket`: add column `ownerId` (nullable, foreign key to `User(id)`), add column `resolutionSummary` (nullable text).
   - Re-link foreign key `Ticket.requesterId` from `RequesterUser.id` to `User.id`.
   - Create tables `Comment` and `InternalNote` with appropriate indexes and foreign keys.
   - Drop old `RequesterUser` table only after verifying data integrity and foreign key satisfaction.
2. **Backward Compatibility & Verification**:
   - All existing Lab 2 tickets remain attached to their original requesters.
   - All existing attachments remain intact on disk and in the database.
   - Lab 2 Requester IDs match the migrated User IDs, ensuring zero broken relationships.

---

### 7.3. Seed Data Specification
The seed script (`server/prisma/seed.ts`) must be completely idempotent and safe to run multiple times:
- **Requester Accounts (at least 4 active, 1 inactive)**:
  1. `jennifer.anderson@toktickit.com` (Marketing, Active, `requiresPasswordChange = false`, password: `Password123!`)
  2. `david.lee@toktickit.com` (Finance, Active, `requiresPasswordChange = false`, password: `Password123!`)
  3. `sarah.johnson@toktickit.com` (HR, Active, `requiresPasswordChange = false`, password: `Password123!`)
  4. `emily.davis@toktickit.com` (Sales, Active, `requiresPasswordChange = true`, password: `InitialPass123!`)
  5. `alex.inactive@toktickit.com` (Operations, **Inactive**, password: `Password123!`)
- **IT Staff Accounts (at least 3 active, 1 inactive)**:
  1. `michael.brown@toktickit.com` (IT Support Tier 2, Active, `requiresPasswordChange = false`, password: `Password123!`)
  2. `lisa.martinez@toktickit.com` (IT Support Tier 1, Active, `requiresPasswordChange = false`, password: `Password123!`)
  3. `james.wilson@toktickit.com` (Systems Engineering, Active, `requiresPasswordChange = true`, password: `InitialPass123!`)
  4. `kevin.patel@toktickit.com` (IT Support, **Inactive**, password: `Password123!`)
- **Administrator Accounts (at least 1 active, plus 1 backup)**:
  1. `admin@toktickit.com` (System Administrator, Active, `requiresPasswordChange = false`, password: `AdminPass123!`)
  2. `john.smith@toktickit.com` (IT Operations Lead, Active, `requiresPasswordChange = false`, password: `Password123!`)
- **Sample Tickets**:
  - Minimum 10 tickets distributed across Requesters, Categories (Hardware, Software, Network, Access), Priorities (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), and Statuses (`NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`).
  - Combination of assigned tickets (owned by `michael.brown` or `lisa.martinez`) and unassigned tickets (`ownerId = null`).
  - Realistic sample Public Comments and Internal Notes on selected tickets.

---

## 8. API Contract Summary
*(Refer to `docs/lab-03/api-spec.md` for full request/response schemas, parameter validations, and status codes).*

### Authentication Endpoints
- `POST /api/auth/login`: Authenticate with email/password; returns user identity and sets session cookie / token.
- `POST /api/auth/logout`: Clears session / invalidates credentials.
- `GET /api/auth/me`: Retrieves current authenticated user context and role.
- `POST /api/auth/change-password`: Validates current temporary password, verifies complexity, updates password, and clears `requiresPasswordChange` flag.

### IT Staff Queue & Operational Endpoints
- `GET /api/staff/tickets`: Retrieves ticket queue with search, category, status, priority, and owner filters, plus sorting and pagination metadata.
- `GET /api/staff/tickets/:id`: Retrieves complete operational ticket details for IT Staff / Admins.
- `PATCH /api/staff/tickets/:id/claim`: Assigns active IT Staff user as ticket owner.
- `PATCH /api/staff/tickets/:id/assign`: Assigns or reassigns ticket to specified active IT Staff member (or `null` to unassign).
- `PATCH /api/staff/tickets/:id/priority`: Updates `itPriority` (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
- `PATCH /api/staff/tickets/:id/status`: Advances ticket status according to transition rules (requires `resolutionSummary` if resolving/closing).

### Comments & Internal Notes Endpoints
- `GET /api/tickets/:id/comments`: Retrieves public comments stream (accessible by Requester, IT Staff, Admin).
- `POST /api/tickets/:id/comments`: Posts a new public comment authored by authenticated user.
- `GET /api/tickets/:id/notes`: Retrieves confidential internal notes (accessible strictly by IT Staff and Admin; `403` for Requesters).
- `POST /api/tickets/:id/notes`: Posts an internal note (restricted to IT Staff and Admin).

### Requester Endpoints (Authenticated Lab 2 Continuation)
- `GET /api/tickets`: Lists tickets owned strictly by the authenticated Requester.
- `POST /api/tickets`: Creates a ticket owned by the authenticated Requester.
- `GET /api/tickets/:id`: Retrieves ticket details owned by the authenticated Requester.
- `POST /api/tickets/:id/attachments`: Uploads an attachment to an owned ticket.
- `GET /api/attachments/:id/download`: Downloads an active attachment.
- `DELETE /api/attachments/:id`: Soft-removes an attachment with mandatory audit reason.
- `POST /api/tickets/:id/resolve-indication`: Signals Requester's indication that the problem appears resolved.

### Administrator User Management Endpoints
- `GET /api/admin/users`: Lists users with search (name, email) and optional role filter.
- `POST /api/admin/users`: Creates user account with one permitted role and initial password.
- `GET /api/admin/users/:id`: Retrieves single user details.
- `PATCH /api/admin/users/:id`: Updates name, email, role, or active status (enforcing self-deactivation and last admin safety guards).
- `POST /api/admin/users/:id/reset-password`: Sets new initial password and forces `requiresPasswordChange = true`.
- `GET /api/staff/users`: Utility lookup endpoint returning active IT Staff users for assignment dropdowns.

---

## 9. Acceptance Criteria (Given-When-Then Format)

- **AC-01 (Valid User Login)**:
  - **Given** an active user account with valid email and password credentials,
  - **When** the user submits the login form (`POST /api/auth/login`),
  - **Then** the backend establishes an authenticated session, returns HTTP 200 with safe user details (id, name, email, role, requiresPasswordChange), and the frontend redirects to the role's default landing page.

- **AC-02 (Mandatory First-Login Password Change)**:
  - **Given** an authenticated user whose account has `requiresPasswordChange = true`,
  - **When** login succeeds or any application route is loaded,
  - **Then** the application intercepts and presents the Change Password screen, and normal application features remain completely inaccessible until a valid new password meeting complexity criteria is submitted and saved.

- **AC-03 (Invalid Credentials Rejection)**:
  - **Given** an unauthenticated visitor,
  - **When** they attempt to log in with an incorrect password or unregistered email,
  - **Then** the backend responds with HTTP 401 Unauthorized, and the login form displays the safe error message `"Invalid email or password. Please try again."` without clearing the email input.

- **AC-04 (Inactive Account Login Block)**:
  - **Given** a user account with `isActive = false`,
  - **When** valid email and password credentials are submitted for that account,
  - **Then** the backend rejects the request with HTTP 401 Unauthorized and displays the generic message `"Invalid email or password. Please try again."` without revealing the account's inactive state.

- **AC-05 (Authenticated Requester Ownership Enforcement)**:
  - **Given** an authenticated Requester,
  - **When** the client submits a ticket creation request or queries the ticket list with a foreign `requesterId` parameter,
  - **Then** the backend enforces ownership using the authenticated session ID, completely ignoring the foreign parameter, and associates the ticket with the authenticated user.

- **AC-06 (Cross-User Requester Isolation)**:
  - **Given** Requester A is authenticated,
  - **When** Requester A attempts to fetch (`GET /api/tickets/:id`), upload attachments to, or soft-remove attachments from a ticket owned by Requester B,
  - **Then** the backend rejects the request with HTTP 403 Forbidden, and the UI displays an Access Denied error screen.

- **AC-07 (Internal Note Secrecy for Requesters)**:
  - **Given** an authenticated Requester,
  - **When** they attempt to query `GET /api/tickets/:id/notes` or submit `POST /api/tickets/:id/notes`,
  - **Then** the backend rejects the request with HTTP 403 Forbidden without disclosing note existence, and the Requester UI does not render any Internal Notes tab or content.

- **AC-08 (IT Staff Queue Retrieval & Filtering)**:
  - **Given** an authenticated IT Staff member viewing the Ticket Queue,
  - **When** they search for `"laptop"` and select status filter `"In Progress"`,
  - **Then** the table displays only tickets matching both criteria, updates the counter to `"Showing 1 to X of Y tickets"`, and provides a clear filter option.

- **AC-09 (IT Staff Ticket Claiming)**:
  - **Given** an unassigned ticket in status `NEW`,
  - **When** an IT Staff member clicks "Claim Ticket" (or selects themselves as owner),
  - **Then** the ticket's `ownerId` is updated to that IT Staff member, status automatically transitions to `OPEN` (if configured) or updates owner badge, and the change is immediately reflected in the UI and database.

- **AC-10 (Independent IT Priority Update)**:
  - **Given** an open ticket with `requestedPriority = MEDIUM` and `itPriority = MEDIUM`,
  - **When** an IT Staff member selects `HIGH` in the IT Priority dropdown and saves,
  - **Then** `itPriority` updates to `HIGH` while `requestedPriority` remains strictly unchanged at `MEDIUM`.

- **AC-11 (Permitted Status Transition & Resolution Summary)**:
  - **Given** an active ticket in status `IN_PROGRESS`,
  - **When** IT Staff updates the status to `RESOLVED` with a resolution summary of at least 5 characters,
  - **Then** the status transitions to `RESOLVED`, the resolution summary is persisted, and the status badge updates to green/teal.

- **AC-12 (Invalid Status Transition Rejection)**:
  - **Given** a ticket currently in status `NEW`,
  - **When** an IT Staff member attempts an invalid direct transition (e.g. from `NEW` directly to `RESOLVED` without triage),
  - **Then** the backend rejects the request with HTTP 422 Unprocessable Entity, and the UI displays an error indicating that the transition is not permitted.

- **AC-13 (Requester Problem Appears Resolved Indication)**:
  - **Given** an authenticated Requester viewing an owned open ticket,
  - **When** they click "Problem Appears Resolved",
  - **Then** a system-generated Public Comment is recorded indicating the Requester's confirmation, while the formal status remains unchanged until confirmed by IT Staff.

- **AC-14 (Public Comment Authoring & Multi-Role Visibility)**:
  - **Given** any authenticated participant (Requester owner, IT Staff, or Admin),
  - **When** they post a valid Public Comment,
  - **Then** the comment is saved with backend-stamped author and timestamp, and is rendered visibly in the Public Comments timeline for all permitted viewers.

- **AC-15 (Internal Note Authoring & Role Restriction)**:
  - **Given** an authenticated IT Staff member on Ticket Detail,
  - **When** they submit a valid Internal Note,
  - **Then** the note is saved with author details and rendered in the Internal Notes tab with distinct confidential styling, while remaining completely hidden from the ticket Requester.

- **AC-16 (Administrator User Listing & Search)**:
  - **Given** an authenticated Administrator on the User Management screen,
  - **When** they search by email `"jennifer"` or select role filter `"IT Staff"`,
  - **Then** the user table dynamically renders only accounts satisfying the criteria, displaying Name, Email, Role badge, Status badge, and Edit button.

- **AC-17 (Administrator Account Creation with Temporary Password)**:
  - **Given** an Administrator completing the Create User form with unique email and single role,
  - **When** they submit the form,
  - **Then** a new user is created in PostgreSQL with `requiresPasswordChange = true`, the initial password is safely communicated/displayed, and the user appears in the active directory.

- **AC-18 (Duplicate Email Rejection)**:
  - **Given** an Administrator attempting to create or edit a user with an email already assigned to another account,
  - **When** the form is submitted,
  - **Then** the backend responds with HTTP 409 Conflict, and the UI displays an inline validation error `"Email address is already in use"`.

- **AC-19 (Administrator Self-Deactivation Prevention)**:
  - **Given** an authenticated Administrator editing their own account on the User Management screen,
  - **When** they attempt to toggle their status to Inactive or call `PATCH /api/admin/users/:id` with `isActive: false`,
  - **Then** the action is blocked in the UI (Deactivate button disabled/hidden) and rejected by the backend with HTTP 422 Unprocessable Entity (`"Cannot deactivate your own administrator account"`).

- **AC-20 (Last Active Administrator Guard)**:
  - **Given** a system with exactly one active Administrator,
  - **When** an attempt is made to deactivate or change the role of that Administrator,
  - **Then** the backend rejects the request with HTTP 422 Unprocessable Entity (`"Cannot deactivate or demote the last active Administrator"`).

- **AC-21 (Non-Admin User Management Forbidden)**:
  - **Given** an authenticated Requester or IT Staff member,
  - **When** they attempt to access `GET /api/admin/users` or any user management API directly,
  - **Then** the backend responds with HTTP 403 Forbidden, and the UI presents an Access Denied message without rendering user records.

- **AC-22 (Data Migration Integrity & Attachment Continuity)**:
  - **Given** pre-existing Lab 2 database records (categories, systems, tickets, attachments),
  - **When** the Lab 3 schema migration and seed scripts are executed,
  - **Then** 100% of tickets, attachments, categories, and systems remain intact, all previous attachments remain downloadable, and existing tickets correctly link to migrated user accounts.

---

## 10. Product Definition of Done (DoD) Checklist

### Specification & Architecture
- [ ] Sprint Goal, Stakeholder Request, and Scope clearly defined and approved.
- [ ] Functional Requirements (FR-01 to FR-30) and Business Rules (BR-01 to BR-25) fully documented.
- [ ] UI Specification (`ui-spec.md`) and REST API Specification (`api-spec.md`) complete and aligned.
- [ ] Test Plan (`tests.md`) constructed with 100% Acceptance Criteria traceability.

### Security & Access Control
- [ ] Passwords stored using robust cryptographic hashing (`bcrypt`, >= 10 rounds).
- [ ] Mandatory password change barrier strictly enforced on backend and frontend.
- [ ] Role-based authorization enforced on all server routes (no hidden-button security).
- [ ] IDOR protection enforced for all Requester ticket and attachment queries.
- [ ] Internal Notes strictly inaccessible to Requesters via API and UI.
- [ ] Administrator self-deactivation and last-admin guards verified.

### Data & Migration
- [ ] Prisma schema evolved with `User`, `Role`, `TicketStatus`, `Comment`, and `InternalNote`.
- [ ] Migration preserves all existing Lab 2 tickets, categories, systems, and attachments.
- [ ] Seed script is idempotent and provides required accounts (4+ active requesters, 1 inactive requester, 3+ active IT staff, 1 inactive IT staff, 1+ active admin).

### User Experience & Design
- [ ] Zen Green design tokens applied across all new and existing views.
- [ ] Color-coded status and priority badges matching approved UI specs.
- [ ] Public Comments and Internal Notes visually segregated with clear confidence indicators.
- [ ] Full responsiveness across Desktop (1200px), Tablet (800px), and Mobile (375px) with zero horizontal overflow.
- [ ] All forms provide inline validation, busy states, and safe error banners.

### Quality Assurance & Automated Testing
- [ ] All planned automated test files in place across server, client, and E2E suites.
- [ ] 0 failing tests and 0 skipped tests on final branch.
- [ ] Visual verification screenshots captured across Desktop, Tablet, and Mobile viewports.

---

## 11. Architectural Assumptions and Decisions

1. **Authentication Session Mechanism**:
   - **Decision**: Use HTTP-only, secure, SameSite=Lax session cookies (or standard JWT Bearer tokens with client storage abstraction). HTTP-only cookies are preferred for web browser security against XSS.
   - **Rationale**: Prevents client-side scripts from reading raw auth credentials while enabling automatic credential exchange on requests.
2. **Password Change Enforcement Architecture**:
   - **Decision**: Server middleware inspects `user.requiresPasswordChange` on every authenticated API request. If `true`, the middleware permits requests only to `/api/auth/me`, `/api/auth/change-password`, and `/api/auth/logout`, returning `403 Forbidden` (`PASSWORD_CHANGE_REQUIRED`) for all other endpoints.
   - **Rationale**: Guarantees that client-side route tampering cannot bypass the password change wall.
3. **Internal Notes Security Boundary**:
   - **Decision**: Endpoints for Internal Notes (`/api/tickets/:id/notes`) are completely distinct from Public Comments (`/api/tickets/:id/comments`). The controller immediately checks `req.user.role !== 'REQUESTER'`.
   - **Rationale**: Complete separation of controller handlers prevents accidental parameter pollution or data leakage of operational notes in public comment payloads.
4. **Ticket Owner Assignment Capability**:
   - **Decision**: While Administrators have read access and governance oversight, ticket assignment dropdowns list only active users with role `IT_STAFF` (and optionally `ADMINISTRATOR`), keeping IT operations cleanly scoped.
5. **Initial Password Communication**:
   - **Decision**: In alignment with the local laboratory constraints (no SMTP/email delivery), when an Administrator creates a user or resets a password, the system generates/accepts an initial password that is displayed to the Administrator in a confirmation toast/modal with copy capability.
