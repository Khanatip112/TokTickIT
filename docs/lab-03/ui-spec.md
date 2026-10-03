# Lab 3 Zen Green Theme & UI Specification
## TokTickIT Users, Roles, IT Staff Ticketing, and Admin Screens

---

## 1. Zen Green Design System Tokens

The application strictly inherits and extends the **Zen Green** design token palette established in Lab 2. All screens, interactive states, modals, forms, and cards must maintain visual coherence.

### 1.1. Core Color Palette Tokens

| Token Variable | Hex Code | Semantic Role & UI Application |
| :--- | :--- | :--- |
| `--zen-primary` | `#006B3C` | App header, primary CTA buttons ("Sign In", "Save User", "Post Comment"), active navigation links. |
| `--zen-hover` | `#0B7A46` | Button hover states, interactive link hovers, active focus outline rings. |
| `--zen-active` | `#085E35` | Pressed/active button states. |
| `--zen-pale` | `#EAF6EF` | Selected table row background, success callout panels, active filter pills, active tab accents. |
| `--zen-background` | `#F6FAF8` | Clean, subtle cool-tinted page background across all screens. |
| `--zen-card` | `#FFFFFF` | Surface containers, card panels, modals, dropdown menus, table bodies. |
| `--zen-readonly` | `#F0F4F1` | Soft tinted background for read-only fields (Ticket No, Requester, System, disabled inputs). |
| `--zen-border` | `rgba(0, 107, 60, 0.15)` | Subtle card borders, dividers, neutral container strokes. |
| `--zen-border-light`| `#E0ECE6` | Light input field borders, table header separator lines. |
| `--zen-text` | `#1A1A1A` | Primary typography color (high contrast, WCAG AAA compliant, never pure `#000000`). |
| `--zen-muted` | `#6C757D` | Secondary text, helper labels, timestamps, placeholder text. |
| `--zen-destructive` | `#DC2626` | Destructive action buttons ("Deactivate User", "Remove Attachment"), error alerts, invalid input borders. |
| `--zen-destructive-bg`| `#FEE2E2` | Light red surface for error banners and inactive status pills. |
| `--zen-warning` | `#D97706` | Amber highlight for Medium priority and Pending/Waiting status. |
| `--zen-warning-bg`| `#FEF3C7` | Soft amber surface for warning callouts and status pills. |
| `--zen-info` | `#0284C7` | Informational callouts and Open status indicators. |
| `--zen-info-bg` | `#E0F2FE` | Soft blue surface for IT Staff role badge and Open status pill. |

---

## 2. Typography, Form Conventions & Button Styles

### 2.1. Typography
- **Font Family**: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif.
- **Headings**:
  - `h1`: `1.75rem` (`28px`), font-weight `700`, line-height `1.3`, color `var(--zen-text)`.
  - `h2`: `1.35rem` (`22px`), font-weight `600`, line-height `1.35`.
  - `h3`: `1.15rem` (`18px`), font-weight `600`.
- **Body & Controls**:
  - Regular Text: `0.9375rem` (`15px`), font-weight `400`, line-height `1.5`.
  - Small / Metadata: `0.8125rem` (`13px`), font-weight `400`, color `var(--zen-muted)`.
  - Labels: `0.875rem` (`14px`), font-weight `600`, margin-bottom `6px`.

### 2.2. Form Control Conventions
- **Required Indicator**: Red asterisk (`*` in `#DC2626`) placed directly after mandatory field labels.
- **Editable Inputs**: Background `#FFFFFF`, border `1px solid var(--zen-border-light)`, border-radius `0.5rem` (`8px`), padding `10px 14px`. On focus: border becomes `var(--zen-primary)`, box-shadow `0 0 0 3px rgba(0, 107, 60, 0.15)`.
- **Read-Only Fields**: Shaded background `var(--zen-readonly)` (`#F0F4F1`), border `1px solid #CBD5E1`, text color `#475569`, cursor `not-allowed`.
- **Validation Messages**: Placed directly below the field in `#DC2626`, font size `0.8125rem` (`13px`), accompanied by a small error icon.
- **Password Visibility Toggle**: Interactive eye icon button positioned inside the right boundary of the password input field.

### 2.3. Button Styles

```css
/* Primary Button (Zen Green) */
.btn-zen-primary {
  background-color: #006B3C;
  color: #FFFFFF;
  border: 1px solid #006B3C;
  border-radius: 0.5rem;
  padding: 0.55rem 1.25rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.18s ease-in-out;
}
.btn-zen-primary:hover:not(:disabled) {
  background-color: #0B7A46;
  border-color: #0B7A46;
}
.btn-zen-primary:active:not(:disabled) {
  background-color: #085E35;
}

/* Secondary Button (Outlined) */
.btn-zen-secondary {
  background-color: #FFFFFF;
  color: #006B3C;
  border: 1px solid #006B3C;
  border-radius: 0.5rem;
  padding: 0.55rem 1.25rem;
  font-weight: 600;
}
.btn-zen-secondary:hover:not(:disabled) {
  background-color: #EAF6EF;
}

/* Destructive Button (Outlined Red) */
.btn-zen-destructive-outline {
  background-color: #FFFFFF;
  color: #DC2626;
  border: 1px solid #DC2626;
  border-radius: 0.5rem;
  padding: 0.55rem 1.25rem;
  font-weight: 600;
}
.btn-zen-destructive-outline:hover:not(:disabled) {
  background-color: #FEE2E2;
}

/* Busy / Loading State */
.btn-busy {
  cursor: wait !important;
  opacity: 0.85;
  pointer-events: none;
}
```

---

## 3. Badge Rules & Styling

Badges communicate status, priority, role, and account states using standardized rounded pill tags (`border-radius: 9999px`, padding `4px 10px`, font size `12px`, font-weight `600`).

### 3.1. Ticket Status Badges

| Status Key | Display Text | Background Color | Text Color | Border Color | Semantic Meaning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NEW` | `New` | `#F1F5F9` | `#475569` | `#CBD5E1` | Newly created by requester, un-triaged. |
| `OPEN` | `Open` | `#E0F2FE` | `#0369A1` | `#BAE6FD` | Acknowledged by IT Staff / assigned. |
| `IN_PROGRESS` | `In Progress` | `#EAF6EF` | `#006B3C` | `#A7F3D0` | Under active investigation/work. |
| `WAITING_FOR_REQUESTER`| `Waiting for Requester`| `#FEF3C7`| `#B45309` | `#FDE68A` | Blocked on requester response. |
| `RESOLVED` | `Resolved` | `#D1FAE5` | `#047857` | `#6EE7B7` | Fix applied; awaiting closure confirmation. |
| `CLOSED` | `Closed` | `#F1F5F9` | `#64748B` | `#E2E8F0` | Formally completed and archived. |
| `REOPENED` | `Reopened` | `#FFEDD5` | `#C2410C` | `#FDBA74` | Problem recurred; re-triaged as urgent. |
| `CANCELLED` | `Cancelled` | `#FFE4E6` | `#BE123C` | `#FECDD3` | Withdrawn or declared invalid/duplicate. |

### 3.2. Priority Badges (Requested Priority & IT Priority)

| Priority Key | Display Text | Background Color | Text Color | Border Color | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `LOW` | `Low` | `#F0FDF4` | `#15803D` | `#BBF7D0` | Minor inconvenience, no work stoppage. |
| `MEDIUM` | `Medium` | `#FEF3C7` | `#B45309` | `#FDE68A` | Standard business issue with workaround. |
| `HIGH` | `High` | `#FFEDD5` | `#C2410C` | `#FDBA74` | Significant operational impairment. |
| `URGENT` | `Urgent` | `#FEE2E2` | `#B91C1C` | `#FCA5A5` | Critical system failure or severe outage. |

### 3.3. User Role Badges

| Role Key | Display Text | Background Color | Text Color | Border Color |
| :--- | :--- | :--- | :--- | :--- |
| `REQUESTER` | `Requester` | `#F1F5F9` | `#475569` | `#CBD5E1` |
| `IT_STAFF` | `IT Staff` | `#E0F2FE` | `#0369A1` | `#BAE6FD` |
| `ADMINISTRATOR` | `Administrator` | `#F3E8FF` | `#6B21A8` | `#DDD6FE` |

### 3.4. Account Activation Badges

| State | Display Text | Background Color | Text Color | Border Color |
| :--- | :--- | :--- | :--- | :--- |
| `isActive = true` | `Active` | `#EAF6EF` | `#006B3C` | `#A7F3D0` |
| `isActive = false` | `Inactive` | `#FEE2E2` | `#B91C1C` | `#FCA5A5` |

---

## 4. Screen Wireframe Specifications

### 4.1. Screen 1: Login Screen (`/login`)
*(Direct reference: Handout Page 8, Image 1)*

```
+-----------------------------------------------------------------------+
|  [Logo] TokTickIT                                                     |
+-----------------------------------------------------------------------+
|                                                                       |
|                     +-----------------------------+                   |
|                     | Sign in to your account     |                   |
|                     |                             |                   |
|                     | Email address               |                   |
|                     | [ janderson@toktickit.com ] |                   |
|                     |                             |                   |
|                     | Password                    |                   |
|                     | [ *************           O]|                   |
|                     |                             |                   |
|                     |  [!] Invalid email or       |                   |
|                     |      password. Please try   |                   |
|                     |      again.                 |                   |
|                     |                             |                   |
|                     | [       Sign In           ] |                   |
|                     |                             |                   |
|                     |     Forgot your password?   |                   |
|                     +-----------------------------+                   |
|                                                                       |
+-----------------------------------------------------------------------+
```

- **Container**: Centered card (`max-width: 420px`), background `#FFFFFF`, border-radius `12px`, padding `32px`, elevation shadow `0 4px 20px rgba(0, 107, 60, 0.08)`.
- **Header**: Top banner with Zen Green background (`#006B3C`), TokTickIT white logo and title.
- **Fields**:
  - Email Address: Standard input, type `email`, autofocus.
  - Password: Password input with eye icon toggle (show/hide plaintext).
- **Error Feedback**: If credentials fail, render a soft red alert banner (`#FEE2E2` background, `#B91C1C` text, warning icon) stating: `"Invalid email or password. Please try again."`. Email input retains the entered value; password input is cleared and refocused.
- **Primary Action**: Full-width Zen Green button `"Sign In"`. During authentication, displays a spinner and changes text to `"Signing In..."`.
- **Secondary Helper**: Text link `"Forgot your password?"` which displays an informational popover/modal: `"Please contact your TokTickIT Administrator to reset your temporary password."`

---

### 4.2. Screen 2: Mandatory First-Login Password Change Screen (`/change-password`)
*(Direct reference: Handout Page 8, Image 1 bottom)*

```
+-----------------------------------------------------------------------+
|  [Logo] TokTickIT                                                     |
+-----------------------------------------------------------------------+
|                                                                       |
|                     +-----------------------------+                   |
|                     | Change Your Password        |                   |
|                     | You must change your        |                   |
|                     | password to continue.       |                   |
|                     |                             |                   |
|                     | Current (temporary) password|                   |
|                     | [ *******                 O]|                   |
|                     |                             |                   |
|                     | New password                |                   |
|                     | [ *************           O]|                   |
|                     |                             |                   |
|                     | Confirm new password        |                   |
|                     | [ *************           O]|                   |
|                     |                             |                   |
|                     | Password must:              |                   |
|                     |  [v] Be at least 8 chars    |                   |
|                     |  [v] Include upper & lower  |                   |
|                     |  [v] Include number & symbol|                   |
|                     |                             |                   |
|                     | [       Continue          ] |                   |
|                     +-----------------------------+                   |
|                                                                       |
+-----------------------------------------------------------------------+
```

- **Trigger**: Displayed automatically when an authenticated user has `requiresPasswordChange = true`. All other routes and navigation links are locked/hidden until completed.
- **Header Prompt**: `"Change Your Password"`, sub-label `"You must change your password to continue."` in muted text.
- **Fields**:
  - Current (temporary) Password: Input with visibility toggle.
  - New Password: Input with visibility toggle.
  - Confirm New Password: Input with visibility toggle.
- **Validation Checklist Card**: Live interactive checklist box (`#F6FAF8` background, `#E0ECE6` border, padding `12px`):
  - `[v] Be at least 8 characters`
  - `[v] Include upper and lower case letters`
  - `[v] Include a number and a special character`
  - Items dynamically transition from gray bullet to green checkmark as user types.
- **Action**: Full-width Primary Zen Green button `"Continue"`. Submits `POST /api/auth/change-password`. On success, redirects to the user's role-specific landing page.

---

### 4.3. Navigation Shell & Role Switching

```
+---------------------------------------------------------------------------------------------------+
| [Logo] TokTickIT    [My Queue]    [Create Ticket]                             [Profile v: MB (IT)]|
+---------------------------------------------------------------------------------------------------+
```

- **Header Bar**: Fixed height `64px`, background `#006B3C`, text white, responsive container.
- **Role Navigation Matrix**:
  - **Requester View**: `[Logo] TokTickIT` | `My Tickets` | `Create Ticket` | `[Profile v]`
  - **IT Staff View**: `[Logo] TokTickIT` | `My Queue` | `Create Ticket` | `[Profile v]`
  - **Administrator View**: `[Logo] TokTickIT` | `Admin` | `[Profile v]`
- **Right Profile Dropdown (`Profile v`)**:
  - Trigger: User initials circle avatar (e.g. `[MB]`), user name, role pill, downward caret.
  - Menu Items:
    - User Header: Full name & email address.
    - Role Indicator: Role badge pill.
    - Menu Item 1: `"Change Password"` (Navigates to voluntary password change modal).
    - Menu Item 2: `"Sign Out"` (Executes `POST /api/auth/logout` and redirects to `/login`).

---

### 4.4. Screen 3: IT Staff Ticket Queue (`/staff/queue`)
*(Direct reference: Handout Page 9)*

```
+---------------------------------------------------------------------------------------------------+
| [Logo] TokTickIT    [My Queue]    [Create Ticket]                             [Profile v: MB (IT)]|
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [ Q Search by ticket number or summary...              ]                     [ [::] Filters ]   |
|                                                                                                   |
|  Showing 1 to 10 of 87 tickets                                                                    |
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  | Ticket No ^  Created Date   Summary               Category  Req. Prio IT Prio Status  Owner |  |
|  +---------------------------------------------------------------------------------------------+  |
|  | TKT-2025-001 May 12,09:14AM Laptop battery drains Hardware  [Medium]  [Medium][In Prog]MB   |  |
|  | TKT-2025-002 May 12,08:02AM Cannot connect to VPN  Network   [High]    [High]  [Open]   SJ   |  |
|  | TKT-2025-003 May 11,04:45PM Email not syncing     Software  [Medium]  [Low]   [In Prog]DL   |  |
|  | TKT-2025-004 May 11, 11:30AM New employee request  Access    [Low]     [Low]   [Resolv] JA   |  |
|  | TKT-2025-005 May 10,02:10PM Printer keeps offline  Hardware  [Medium]  [Low]   [Open]   MB   |  |
|  | TKT-2025-006 May 10, 10:08AM Request SharePoint   Access    [Low]     [Low]   [Pending]SJ   |  |
|  | TKT-2025-007 May 9, 01:22PM Outlook freezing       Software  [High]    [Medium][In Prog]DL   |  |
|  | TKT-2025-008 May 9, 09:15AM Docking station fail  Hardware  [Medium]  [Medium][Resolved]MB  |  |
|  | TKT-2025-009 May 8, 04:30PM Software install req   Software  [Low]     [Low]   [Closed] KP   |  |
|  | TKT-2025-010 May 8, 09:02AM Multi-monitor not det Hardware  [Medium]  [Low]   [In Prog]ED   |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                                                                   |
|                                      [< Previous] [1] [2] [3] [4] [5] ... [9] [Next >]            |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

- **Search Bar**: Full-width or flex search input with magnifying glass icon. Placeholder: `"Search by ticket number or summary..."`.
- **Filters Trigger Button**: Outlined button `"[::] Filters"` opening a popover/drawer containing:
  - Category Dropdown (All, Hardware, Software, Network, Access)
  - Status Dropdown (All, New, Open, In Progress, Waiting for Requester, Resolved, Closed)
  - IT Priority Dropdown (All, Low, Medium, High, Urgent)
  - Ownership Filter (All, Assigned to Me, Unassigned, Specific Staff)
  - `"Reset Filters"` link.
- **Results Counter**: `"Showing 1 to 10 of 87 tickets"` in muted typography.
- **Queue Table Columns**:
  1. `Ticket No`: Monospace clickable link (e.g. `TKT-2025-001234`), hovering shows underline. Clicking opens Ticket Detail.
  2. `Created Date`: Compact formatted date/time (e.g. `May 12, 09:14 AM`).
  3. `Summary`: Trimmed text with ellipsis on overflow; tooltip on hover.
  4. `Category`: Name pill or text.
  5. `Req. Priority`: Color-coded priority pill.
  6. `IT Priority`: Color-coded priority pill.
  7. `Status`: Color-coded status badge.
  8. `Owner`: Staff name or unassigned pill (`Unassigned` in gray italic).
- **Pagination Bar**: Centered pagination controls with `< Previous`, active page number in Zen Green square, surrounding pages, ellipsis, and `Next >`.

---

### 4.5. Screen 4: IT Staff Ticket Detail Screen (`/staff/tickets/:id`)
*(Direct reference: Handout Page 10)*

```
+---------------------------------------------------------------------------------------------------+
| [Logo] TokTickIT    [My Queue]    [Create Ticket]                             [Profile v: MB (IT)]|
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  My Queue > Ticket Detail                                                      [ <- Back to Queue]|
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  | Ticket No                    Category                     Related System                    |  |
|  | [ TKT-2025-001234 (R/O) ]     [ Hardware              v ]  [ Corporate Laptop (R/O) ]        |  |
|  |                                                                                             |  |
|  | Requester                    Requested Priority           Current Status                    |  |
|  | [ Jennifer Anderson (R/O) ]  [ [Medium] (R/O) ]           [ In Progress                   v]|  |
|  |                                                                                             |  |
|  | Ticket Owner                 IT Priority                                                    |  |
|  | [ Michael Brown (IT Support)v] [ Medium                v ]                                  |  |
|  |                                                                                             |  |
|  | Summary                                                                                     |  |
|  | [ Laptop battery drains quickly                                                          ]  |  |
|  |                                                                                             |  |
|  | Description                                                                                 |  |
|  | [ My laptop battery is draining much faster than usual even when the system is idle.       ]  |  |
|  | [ This started happening after last week's Windows update.                                 ]  |  |
|  |                                                                                             |  |
|  | Resolution Summary                                                                          |  |
|  | [ Add resolution summary (visible to requester)...                                        ]  |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                                                                   |
|  [v Public Comments (3)]  [ Internal Notes (2) ]  [ Attachments (2) ]  [ Service Actions (0) ]    |
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  | Add Public Comment                                                                          |  |
|  | [ Type your comment here...                                                               ]  |  |
|  |                                                                        [ > Post Comment ]   |  |
|  |                                                                                             |  |
|  | [JA] Jennifer Anderson [Requester]                                   May 13, 2025 11:45 AM  |  |
|  |      Thank you for the update. Please let me know if you need any additional information.   |  |
|  | ------------------------------------------------------------------------------------------- |  |
|  | [MB] Michael Brown [IT Support]                                     May 13, 2025 10:30 AM  |  |
|  |      We are investigating the issue on your device. We'll update you shortly.               |  |
|  | ------------------------------------------------------------------------------------------- |  |
|  | [JA] Jennifer Anderson [Requester]                                   May 12, 2025 09:20 AM  |  |
|  |      Just adding that this issue occurs even when I close all applications.                 |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

- **Top Bar**: Breadcrumb `My Queue > Ticket Detail` on left; secondary button `<- Back to Queue` on right.
- **Operational Information Card**:
  - Two/Three-Column layout:
    - `Ticket No`: Read-only, `#F0F4F1` background, monospace font.
    - `Category`: Dropdown select (Hardware, Software, Network, Access).
    - `Related System`: Read-only, `#F0F4F1` background.
    - `Requester`: Read-only, `#F0F4F1` background, showing requester name and email.
    - `Requested Priority`: Read-only badge displaying Requester's initial priority.
    - `Current Status`: Interactive dropdown select presenting ONLY permitted status transitions according to the transition matrix.
    - `Ticket Owner`: Interactive dropdown select containing active IT Staff (and option for Unassigned), with a quick `"Assign to Me"` action.
    - `IT Priority`: Interactive dropdown select (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
    - `Summary`: Read-only / editable text field.
    - `Description`: Read-only multiline display box.
    - `Resolution Summary`: Visible textarea for capturing root cause and solution (mandatory when setting status to `RESOLVED` or `CLOSED`).
- **Tabbed Activity Section**:
  - `Public Comments (X)`: Green accent indicator. Accessible to all users.
  - `Internal Notes (Y)`: Shield/lock icon, amber/gray badge. **Visible only to IT Staff and Administrators**.
  - `Attachments (Z)`: Displays uploaded files, download triggers, and soft-removal statuses.
  - `Service Actions (0)`: Visual tab placeholder disabled/marked for Lab 4 as per handout.
- **Public Comments Tab Content**:
  - Textarea: `"Type your comment here..."` (min 1, max 2,000 characters).
  - Submit Button: Primary Zen Green button `Post Comment`.
  - Timeline Stream: Reverse chronological list. Each card shows:
    - Author Initials circle (e.g. `[JA]`, `[MB]`).
    - Author Name and Role Badge (e.g. `Jennifer Anderson [Requester]`).
    - Timestamp formatted as `May 13, 2025 11:45 AM`.
    - Comment text body.
- **Internal Notes Tab Content**:
  - Banner: Yellow/amber confidential banner: `"🔒 Internal Note — Visible strictly to IT Staff and Administrators"`.
  - Textarea: `"Type internal note here..."`.
  - Submit Button: Primary button `Post Internal Note`.
  - Stream: Internal note cards with distinct pale amber border and background (`#FFFBEB`) to prevent confusion with public messages.

---

### 4.6. Screen 5: Administrator User Management Screen (`/admin/users`)
*(Direct reference: Handout Page 12)*

```
+---------------------------------------------------------------------------------------------------+
| [Logo] TokTickIT    [Admin]                                                   [Profile v: Admin]  |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  Users                                                                       [ + Create User ]    |
|                                                                                                   |
|  [ Q Search users...                            ]   [ [::] Filters ]                              |
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  | Name                   Role            Status              Action                           |  |
|  +---------------------------------------------------------------------------------------------+  |
|  | Jennifer Anderson      [Requester]     [Active]            [ Edit ]                         |  |
|  | Michael Brown          [IT Staff]      [Active]            [ Edit ]                         |  |
|  | Sarah Johnson          [IT Staff]      [Active]            [ Edit ]                         |  |
|  | David Lee              [Requester]     [Active]            [ Edit ]                         |  |
|  | Kevin Patel            [IT Staff]      [Inactive]          [ Edit ]                         |  |
|  | Emily Davis            [Requester]     [Active]            [ Edit ]                         |  |
|  | John Smith             [Administrator] [Active]            [ Edit ]                         |  |
|  | Lisa Martinez          [IT Staff]      [Active]            [ Edit ]                         |  |
|  | Robert Wilson          [IT Staff]      [Inactive]          [ Edit ]                         |  |
|  | Amanda Clark           [Requester]     [Active]            [ Edit ]                         |  |
|  +---------------------------------------------------------------------------------------------+  |
|                                                                                                   |
|                                      [< Prev] [1] [2] [3] ... [6] [Next >]                        |
|                                                                                                   |
+---------------------------------------------------------------------------------------------------+
```

#### Create New User / Edit User Modal / Drawer:
*(Direct reference: Handout Page 12, right overlay)*

```
+---------------------------------------------------+
| Create New User / Edit User                    [X]|
+---------------------------------------------------+
|                                                   |
| Full Name *                                       |
| [ Alex Thompson                                 ] |
|                                                   |
| Email Address *                                   |
| [ alex.thompson@toktickit.com                   ] |
|                                                   |
| Role *                                            |
| [ IT Staff                                    v ] |
|                                                   |
| Active                                            |
| [ ( ) No  (o) Yes ] (Green switch toggle)         |
|                                                   |
| Initial Password                                  |
| [v] User will set password on first login         |
|                                                   |
| [              Save User                        ] |
|                                                   |
| [            Deactivate User                    ] |
|                                                   |
|                  Cancel                           |
+---------------------------------------------------+
```

- **Header Section**: Page Title `"Users"`, primary CTA button `"+ Create User"`.
- **Search & Filter Bar**:
  - Search Input: `"Search users..."` (filters real-time across name and email).
  - Filter: Role dropdown filter (`All`, `Requester`, `IT Staff`, `Administrator`).
- **User Directory Table**:
  - `Name`: Full name of user.
  - `Email`: Contact email address.
  - `Role`: Color-coded role pill (`Requester`, `IT Staff`, `Administrator`).
  - `Status`: Green pill (`Active`) or red pill (`Inactive`).
  - `Action`: Link / button `Edit` opening the user details drawer.
- **Create / Edit Drawer Details**:
  - Modal/Slide-over drawer on right side.
  - `Full Name *`: Required text input.
  - `Email Address *`: Required email input, validates uniqueness.
  - `Role *`: Dropdown selecting exactly one role.
  - `Active Toggle`: Green toggle switch (`Yes` / `No`). Disabled for Administrator's own account to enforce **BR-22** (no self-deactivation).
  - `Initial Password / Reset`: In create mode, defaults to system-generated temporary password marked for first-login change. In edit mode, provides button `"Reset Initial Password"`.
  - Actions:
    - Primary Green button: `"Save User"`.
    - Destructive outline button: `"Deactivate User"` (Hidden or disabled if editing own account or if user is the last active Administrator).
    - Neutral text button: `"Cancel"`.

---

### 4.7. Requester Ticket Detail Screen Enhancements
*(Retaining Lab 2 base layout with Sprint 3 additions)*

- **Identity Display**: Shows authenticated Requester name and email in the top header. Development Requester selector and switch actions are completely removed.
- **Public Comments Feed**: Requesters can view the Public Comments timeline and submit new comments via `"Post Comment"`. (Internal Notes tab is strictly omitted).
- **"Problem Appears Resolved" Action**:
  - For active tickets (`IN_PROGRESS`, `OPEN`, `WAITING_FOR_REQUESTER`), an informational card appears above comments:
    ```
    +-----------------------------------------------------------------------------------+
    | [i] Has your issue been resolved?                                                 |
    | If your issue has been fixed, click below to notify IT Staff.                      |
    |                                                 [ Problem Appears Resolved ]      |
    +-----------------------------------------------------------------------------------+
    ```
  - Clicking opens a confirmation modal: `"Confirm that your issue has been resolved. This will notify IT Staff to formally close your ticket."`.
  - On confirmation, records a public comment indicating resolution and alerts IT Staff. The ticket status itself is not changed directly to `RESOLVED` or `CLOSED` (enforcing **BR-05** and **BR-16**).

---

## 5. Responsive Rules & Viewport Breakpoints

| Viewport Category | Width Range | Layout Transformations & UI Adaptations |
| :--- | :--- | :--- |
| **Desktop** | `>= 992px` | Multi-column grid layout with centered max-width container (`1200px`). Full tabular layout for IT Queue and User Directory. Side-by-side forms and drawers. |
| **Tablet** | `768px - 991px` | Two-column forms collapse where necessary. Queue table remains tabular with horizontal scrolling or compressed column spacing. User drawer occupies 60% viewport width. |
| **Mobile** | `< 768px` | Single-column vertical flow. Queue table converts to mobile Card List view. All input controls and action buttons expand to 100% width with touch targets `>= 44px`. Zero horizontal overflow. Modals become full-screen overlays. |

### Mobile Card List Transformation (IT Staff Queue)
On viewports `< 768px`, each row of the Ticket Queue table transforms into a compact card:

```
+-------------------------------------------------------------+
| TKT-2025-001234                           [ In Progress ]   |
| Laptop battery drains quickly                               |
| Category: Hardware  •  IT Priority: [Medium]                |
| Requester: Jennifer Anderson  •  Owner: Michael Brown       |
| Created: May 12, 09:14 AM                                   |
|                                              [ View Detail >|
+-------------------------------------------------------------+
```

---

## 6. Accessibility & State Indicators

### 6.1. Accessible Interaction & Standards
- **Contrast**: Text elements meet WCAG 2.1 AA standards (contrast ratio >= 4.5:1 for normal text, >= 3:1 for large text and UI components).
- **Focus Rings**: All interactive elements (inputs, links, buttons, select menus) exhibit a 2px visible focus ring:
  ```css
  :focus-visible {
    outline: 2px solid #0B7A46;
    outline-offset: 2px;
  }
  ```
- **ARIA Attributes**:
  - Navigation elements labeled with `aria-label="Main Navigation"`.
  - Modals and drawers include `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
  - Error messages linked to input fields via `aria-describedby`.
  - Interactive toggles use `role="switch"` and `aria-checked`.

### 6.2. Feedback States
- **Loading State**: Form buttons display inline spinning indicators and disabled states during submission. Tables render shimmering skeleton placeholder rows during data fetch.
- **Empty State**: Rendered when no records exist (e.g. `"No tickets in queue"`), accompanied by an icon and helpful CTA.
- **No-Results State**: Rendered when search/filter criteria match 0 records (e.g. `"No tickets match your search filters"`), accompanied by a `"Clear Filters"` button.
- **Forbidden / Access Denied State (403)**: Clean Zen Green error container displaying a shield icon, `"Access Denied"`, and explanation: `"You do not have permission to access this page or resource."` with a link to return to the user's dashboard.
- **Server Failure State (500)**: Soft red warning banner with option to retry without losing user input.
