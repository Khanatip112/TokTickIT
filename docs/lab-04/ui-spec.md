# Lab 4 Zen Green Theme & UI Specification
## TokTickIT Actions Taken, Dashboards, and Final Regression

---

## 1. Zen Green Design System Tokens

Lab 4 maintains visual, token, and accessibility continuity with the established **Zen Green** design language from Labs 2 and 3. All newly introduced surfaces—Actions Taken timelines, Action Composers, and Role Dashboards—strictly adhere to these tokens.

### 1.1. Core Palette Tokens

| Token Variable | Hex Code | Semantic Role & UI Application |
| :--- | :--- | :--- |
| `--zen-primary` | `#006B3C` | Primary branding, header bar, main CTAs ("Record Action", "Create Ticket"), active dashboard indicator. |
| `--zen-hover` | `#0B7A46` | Interactive button hover states, interactive table row hovers, metric card hover shadows. |
| `--zen-active` | `#085E35` | Pressed button states, active navigation tabs. |
| `--zen-pale` | `#EAF6EF` | Accent background, active tab pill, selected filter badges, success notice backgrounds. |
| `--zen-background` | `#F6FAF8` | Neutral cool-tinted page background across all desktop and mobile views. |
| `--zen-card` | `#FFFFFF` | Metric card containers, modal dialogue surfaces, list item wrappers. |
| `--zen-readonly` | `#F0F4F1` | Shaded read-only inputs, auto-derived performer input, disabled fields. |
| `--zen-border` | `rgba(0, 107, 60, 0.15)` | Card boundaries, dividers, neutral container strokes. |
| `--zen-border-light` | `#E0ECE6` | Input borders, modal header dividers, table horizontal rules. |
| `--zen-text` | `#1A1A1A` | High-contrast body and heading text (WCAG AAA compliant). |
| `--zen-muted` | `#6C757D` | Timestamps, subtitle metadata, input placeholder text, secondary labels. |
| `--zen-destructive` | `#DC2626` | Failed action result badge, cancellation buttons, error alert borders. |
| `--zen-destructive-bg` | `#FEE2E2` | Soft red background for failed results and validation error banners. |
| `--zen-warning` | `#D97706` | Pending action result badge, follow-up required callouts, urgent indicators. |
| `--zen-warning-bg` | `#FEF3C7` | Soft amber background for follow-up callouts and pending badges. |
| `--zen-info` | `#0284C7` | Partial action result badge, informational notifications. |
| `--zen-info-bg` | `#E0F2FE` | Soft blue background for partial progress indicators. |

### 1.2. Action Result Badge Tokens

| Result Enum | Background | Text Color | Border | Meaning |
| :--- | :--- | :--- | :--- | :--- |
| `SUCCESS` | `#D1FAE5` | `#065F46` | `#A7F3D0` | Task fully resolved the objective or impediment. |
| `PARTIAL` | `#E0F2FE` | `#0369A1` | `#BAE6FD` | Progress made, but further operational steps required. |
| `PENDING` | `#FEF3C7` | `#92400E` | `#FDE68A` | Work started; awaiting external testing, vendor, or background job. |
| `FAILED` | `#FEE2E2` | `#991B1B` | `#FCA5A5` | Action attempted but encountered failure or was rolled back. |

---

## 2. Component Specifications

### 2.1. Actions Taken on Ticket Detail (`/staff/tickets/:id`)

The existing Tabbed Activity Section on the Ticket Detail screen is extended with a new primary tab: **"Actions Taken (N)"**.

```
+-----------------------------------------------------------------------------------------+
| [● Public Comments (3)]  [🔒 Internal Notes (1)]  [⚡ Actions Taken (2)]  [Attachments]  |
+-----------------------------------------------------------------------------------------+
| Actions Taken                                                   [ + Record Action Taken ]|
| Chronological technical actions performed on this ticket.                                |
|-----------------------------------------------------------------------------------------|
| [2026-10-15 10:30 AM]  [SUCCESS]  Performed by: Michael Brown (IT Staff)                 |
| Ran remote battery calibration utility and cleared battery memory cache.                 |
| ⚠️ Follow-Up Required: Monitor laptop drain overnight on test bench                      |
| 📎 Attachment Notes: Diagnostics export saved as battery-report-01.html                   |
| [Edit Action] (Staff/Admin only)                                                         |
|-----------------------------------------------------------------------------------------|
| [2026-10-15 09:15 AM]  [PARTIAL]  Performed by: Lisa Martinez (IT Staff)                 |
| Inspected corporate power profile; updated BIOS ACPI driver to version 2.4.              |
+-----------------------------------------------------------------------------------------+
```

#### 2.1.1. Actions Taken List Items
- **Card Wrapper**: Border `1px solid var(--zen-border-light)`, border-radius `0.5rem`, padding `1rem`, background `#FFFFFF`.
- **Header Row**:
  - `actionDateTime`: Formatted `MMM d, yyyy h:mm a` in `var(--zen-muted)`, small (`0.8125rem`).
  - Result Badge: Pill badge displaying `SUCCESS`, `PARTIAL`, `PENDING`, or `FAILED` per the table above.
  - Performer Display: Formatted `"Performed by: [Name] ([Role])"` with a user initial avatar circle.
- **Body**: `description` rendered with `white-space: pre-wrap`, color `var(--zen-text)`.
- **Follow-up Callout**: If `followUpRequired === true`, render an alert box with amber border (`#F59E0B`), background `#FEF3C7`, icon `⚠️`, label `"Follow-Up Required"`, and the `followUpNote` text.
- **Attachment Reference**: If `attachmentNotes` is present, display small paperclip icon (`📎`), label `"Attachment Notes:"`, and the reference text in italicized `#475569`.
- **Action Edit Button**: Outlined button (`btn btn-sm btn-outline-secondary`) visible only to authorized IT Staff and Administrators.

#### 2.1.2. Actions Taken Form Modal / Drawer
- **Trigger**: Click `"+ Record Action Taken"` button on the tab panel.
- **Header**: `"Record Action Taken"` (or `"Edit Action Taken"` when updating).
- **Form Controls**:
  1. **Performed By** (Read-Only): Auto-populated with the current user's name and role (`#F0F4F1` background, disabled input).
  2. **Action Date/Time** (Read-Only): Auto-defaults to current system timestamp (`actionDateTime`).
  3. **Action Description** (Mandatory): Multiline textarea, min 5 chars, max 1,000 chars. Character counter displayed below input.
  4. **Result** (Mandatory): Select dropdown populated with `SUCCESS`, `PARTIAL`, `PENDING`, `FAILED`. Default: `SUCCESS`.
  5. **Follow-Up Required Switch**: Toggle switch (`form-check-input`). Default: `false`.
  6. **Follow-Up Note** (Conditional): Textarea (1-1000 chars) displayed immediately below the toggle.
     - *UI Gate*: If `followUpRequired` is ON, the input is marked required with red asterisk `*`. If toggle is OFF, the input is hidden or disabled.
  7. **Attachment Notes** (Optional): Single-line text input (max 500 chars) with placeholder `"e.g., screenshot-01.png or error log ref"`.
- **Modal Footer**:
  - Cancel button: Closes modal without mutation.
  - Save button: Primary Zen Green button with busy state (`"Saving..."` + spinner).

---

### 2.2. Dashboard Metric Cards

Dashboards utilize responsive grid containers featuring standardized **Zen Green Metric Cards**.

```
+--------------------------------------------------------------------------------+
|  +-------------------+  +-------------------+  +-------------------+           |
|  | MY OPEN TICKETS   |  | IN PROGRESS       |  | RESOLVED          |           |
|  |        3          |  |        2          |  |        5          |           |
|  | View all ›        |  | View all ›        |  | View all ›        |           |
|  +-------------------+  +-------------------+  +-------------------+           |
+--------------------------------------------------------------------------------+
```

#### 2.2.1. Metric Card Structure
- **Container**: Card with `border: 1px solid var(--zen-border)`, border-radius `0.75rem`, background `#FFFFFF`, box-shadow `0 2px 8px rgba(0, 107, 60, 0.06)`, padding `1.25rem`.
- **Top Micro-Label**: Uppercase letter-spaced title (`0.75rem`, font-weight `600`, color `var(--zen-muted)`), e.g., `"UNASSIGNED TICKETS"`.
- **Primary Value**: Huge typography (`2.25rem` / `36px`, font-weight `800`, color `var(--zen-primary)` or role-specific neutral `#1A1A1A`).
- **Trend / Context Subtitle**: Small contextual text (`0.8125rem`), e.g., `"Requires triage"`, `"Assigned to your queue"`.
- **Action Link / Drill-Down**: Footer link `"View in Queue ›"` or `"View all ›"` styled in `var(--zen-primary)` with hover underline. Clicking navigates to the target queue or ticket list with query filters pre-applied.

#### 2.2.2. IT Staff Dashboard Layout (`/staff/dashboard`)
1. **Welcome Header**:
   - Greeting: `"Welcome back, [Full Name]!"`
   - Subtitle: `"Operational overview of the IT service desk queue."`
   - Refresh button with timestamp: `"Last updated: 10:32 AM 🔄"`.
2. **KPI Metric Card Row** (5 Cards):
   - Card 1: **Unassigned Tickets** (`unassignedCount`) → Drill-down: `/staff/queue?ownerId=unassigned`
   - Card 2: **Assigned to Me** (`assignedToMeCount`) → Drill-down: `/staff/queue?ownerId=me`
   - Card 3: **In Progress** (`inProgressCount`) → Drill-down: `/staff/queue?status=IN_PROGRESS`
   - Card 4: **Waiting on Requester** (`waitingRequesterCount`) → Drill-down: `/staff/queue?status=WAITING_FOR_REQUESTER`
   - Card 5: **Urgent Priority** (`urgentPriorityCount`) → Drill-down: `/staff/queue?itPriority=URGENT`
3. **Operational Activity Split**:
   - **Left Panel (65%)**: Recent Urgent Tickets Table (Ticket No, Summary, IT Priority, Status, Last Updated, Open Detail action).
   - **Right Panel (35%)**: Quick Actions Card:
     * `+ Create Ticket`
     * `🔍 Search Tickets`
     * `📋 Open Shared Queue`

#### 2.2.3. Requester Dashboard Layout (`/requester/dashboard`)
1. **Welcome Header**:
   - Greeting: `"Welcome, [Full Name]!"`
   - Subtitle: `"Here's the current status of your submitted support tickets."`
2. **KPI Metric Card Row** (4 Cards):
   - Card 1: **My Open Tickets** (`totalOpenTickets`) → Drill-down: `/my-tickets`
   - Card 2: **In Progress** (`inProgressCount`) → Drill-down: `/my-tickets?status=IN_PROGRESS`
   - Card 3: **Waiting for My Reply** (`waitingForRequesterCount`) → Drill-down: `/my-tickets?status=WAITING_FOR_REQUESTER` (highlighted in soft amber)
   - Card 4: **Resolved** (`recentlyResolvedCount`) → Drill-down: `/my-tickets?status=RESOLVED`
3. **Recent Tickets & Quick Actions**:
   - Recent Tickets List displaying ticket summary, status badge, and `"View Ticket ›"`.
   - Quick Action Card with `+ Submit New Ticket` CTA in Zen Green.

---

## 3. Responsive Layout Specifications

### 3.1. Desktop Viewport (`>= 1280px`)
- **Dashboard Grid**: 5-column metric card grid for IT Staff (`grid-template-columns: repeat(5, 1fr)`); 4-column metric card grid for Requester (`grid-template-columns: repeat(4, 1fr)`).
- **Split View**: 2-column layout (70% main operational table / 30% quick action sidebar).
- **Actions Taken**: Full horizontal timeline card layout with inline badges and action buttons aligned to the right.

### 3.2. Tablet Viewport (`768px - 1024px`)
- **Dashboard Grid**: Metric cards wrap into 2 or 3 columns (`grid-template-columns: repeat(2, 1fr)` or `repeat(3, 1fr)`).
- **Split View**: Tables and quick action panels stack vertically with `gap-4`.
- **Tables**: Wrap in `<div class="table-responsive">` to ensure smooth horizontal swipe with zero text clipping.

### 3.3. Mobile Viewport (`< 768px`)
- **Dashboard Grid**: Single-column stacked cards (`grid-template-columns: 1fr`).
- **Metric Cards**: Height compressed, large numbers maintained at `1.75rem`, drill-down links enlarged to full-width tap targets (min height `44px`).
- **Actions Taken**: Stack metadata above description:
  - Top row: Date/Time + Result Badge.
  - Second row: Performer name + role.
  - Body: Description.
  - Bottom: Follow-up warning box and attachment notes.
- **Horizontal Overflow**: `overflow-x: hidden` enforced on page root to prevent horizontal scrollbars.

---

## 4. Accessibility & Interaction Polish

1. **Color Contrast (WCAG AA & AAA)**:
   - All text against `#FFFFFF` or `#F6FAF8` maintains a minimum contrast ratio of `4.5:1` (regular) and `7:1` (headings).
   - Zen Green `#006B3C` against white achieves `5.8:1` (AA compliant).
   - Neutral text `#1A1A1A` against `#FFFFFF` achieves `16.1:1` (AAA compliant).
2. **Focus Visibility**:
   - Custom focus ring on all interactive elements: `outline: 2px solid var(--zen-primary); outline-offset: 2px;`.
3. **Non-Color Status Indicators**:
   - Status badges and action result badges include text labels alongside colors (`SUCCESS`, `PARTIAL`, `PENDING`, `FAILED`).
   - Follow-up warnings include standard warning glyphs (`⚠️`).
4. **Keyboard Operability**:
   - Modals trap focus during interaction and close upon pressing `Escape`.
   - Metric card drill-downs are semantic `<a>` or `<button>` elements accessible via `Tab` and triggered via `Enter`/`Space`.
