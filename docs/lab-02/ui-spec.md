# Lab 2 Zen Green Theme & Responsive UI Specification
## TokTickIT Requester Ticketing Design System

---

## 1. Zen Green Color System Tokens

The application interface adheres strictly to the **Zen Green** design token palette.

| Token / Element | Color Code | Purpose & Usage |
| :--- | :--- | :--- |
| **Primary Green** | `#006B3C` | App header background, primary CTA buttons ("Create Ticket", "Submit Ticket"), active navigation items. |
| **Secondary / Hover Green**| `#0B7A46` | Active tab indicators, hover states for buttons and links, focus outline rings. |
| **Pale Green Surface** | `#EAF6EF` | Selected table row highlight, success alerts, subtle section headers, soft container backgrounds. |
| **Light Page Background** | `#F5F7F6` | Near-white soft background across all views. |
| **Read-Only Field BG** | `#F0F4F1` | Soft gray-green shading that clearly distinguishes non-editable/system-generated input fields. |
| **Surface / Card BG** | `#FFFFFF` | Card containers, modal boxes, dropdown menus, table background. |
| **Text Primary** | `#1C2826` | Dark charcoal-green for high contrast typography (never pure `#000000`). |
| **Text Muted** | `#64748B` | Labels, metadata text, placeholder text, secondary helper hints. |
| **Border Color** | `#E2E8F0` | Subtle neutral card borders, divider lines, un-focused input borders. |
| **Error / Destructive** | `#DC2626` | Red text, field error borders, destructive action buttons ("Remove Attachment"). |
| **Warning Accent** | `#D97706` | Amber status callouts and priority badges (`MEDIUM` / `HIGH`). |
| **Success Callout** | `#166534` | Dark green text inside `#EAF6EF` success callout boxes. |

---

## 2. Typography & Form Layout Rules

- **Font Family**: Inter, system-ui, -apple-system, sans-serif.
- **Form Labels**: Positioned above controls, font weight `600` (semi-bold), margin-bottom `6px`.
- **Required Indicator**: Red asterisk (`*` in `#DC2626`) placed immediately after required label text.
- **Editable Inputs**: White background (`#FFFFFF`), 1px neutral border (`#E2E8F0`), padding `10px 14px`, rounded border `6px`.
- **Read-Only Inputs**: Shaded background (`#F0F4F1`), text color `#475569`, border `#CBD5E1`, cursor `not-allowed`.
- **Validation Messages**: Displayed directly below the affected input field in red (`#DC2626`), font size `0.875rem` (`14px`), with subtle slide-down animation.
- **Button States**:
  - Primary: `#006B3C` background, white text. Hover: `#0B7A46`. Active: `#085E35`.
  - Secondary: White background, `#006B3C` text, `#006B3C` border.
  - Busy State: Primary button displays inline spinning loader icon, text changes to "Submitting...", and button is `disabled`.

---

## 3. Responsive Breakpoints & Viewport Rules

| Viewport Category | Width Range | Layout Behavior Requirements |
| :--- | :--- | :--- |
| **Desktop** | `>= 992px` | Multi-column grid layout, centered content container with max-width `1200px`. Data presented in full responsive table. |
| **Tablet** | `768px - 991px` | Two-column layout where practical; form fields adjust to 50% width; Summary and Description take full width. |
| **Mobile** | `< 768px` | Single-column vertical stacking; inputs and buttons take full width (touch-friendly targets >= 44px); table transforms into responsive card list; 0 horizontal page overflow. |

---

## 4. Detailed Screen Specifications

### 4.1. Development Requester Selector Screen
- **Path**: `/dev-selector` (or modal overlay when no identity is set in `localStorage`).
- **Header**: Zen Green header banner with TokTickIT logo.
- **Card Container**: White centered card with subtle shadow and rounded corners (`12px`).
- **Content**:
  - Icon: User switch icon in Pale Green circle (`#EAF6EF`).
  - Title: "Select Development Requester" (Font size `1.5rem`, weight `700`).
  - Explanatory Notice: Callout box explaining "Select a Development Requester to test requester-specific ticket behavior. This is not a login screen. Authentication will be introduced in Lab 3."
  - Dropdown Control: Active Development Requesters dropdown loaded from PostgreSQL (`GET /api/dev-requesters`). Displays Requester Name, Email, and Department.
  - Action Button: Primary Green "Continue" button.
  - States: Loading skeleton while loading requesters; error banner if API fails.

### 4.2. Application Navigation Shell
- **Header Container**: Background `#006B3C`, text white, height `64px`.
- **Left Brand**: TokTickIT logo & name with clock/ticket icon.
- **Center Links**: "My Tickets" and "Create Ticket" navigation links with active line indicator.
- **Right Identity Badge**:
  - Pill badge displaying active requester identity: `[Icon] Jennifer Anderson (Marketing)`.
  - Action: "Change Requester" button (Secondary outlined button or text link). Clicking opens the Dev Selector Screen.

### 4.3. Create Ticket Screen Layout
- **Header Bar**: Title "Create Support Ticket" with breadcrumb `My Tickets > Create Ticket`.
- **System-Generated & Read-Only Group**:
  - Ticket Number: Displayed as `(Auto-generated upon submission)` with `#F0F4F1` background.
  - Ticket Date: Current date/time pre-filled, read-only (`#F0F4F1`).
  - Requester: Active Dev Requester Name & Email pre-filled, read-only (`#F0F4F1`).
- **Editable Classification Group**:
  - Category `*`: Dropdown populated from `GET /api/categories`.
  - Related System `*`: Dropdown populated from `GET /api/related-systems`.
  - Requested Priority `*`: Dropdown (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
- **Content Fields**:
  - Ticket Summary `*`: Input field (5-150 chars). Character counter indicator.
  - Problem Description `*`: Textarea (10-3000 chars, min-height `120px`).
- **Attachment Section**:
  - Dropzone container with border dashed `#CBD5E1`.
  - Instructions: "Drag & drop files here or click to browse. Max 5 MB per file. Formats: JPG, PNG, WEBP, PDF. Max 5 files."
  - Uploaded File List: File chips displaying file name, size, type icon, and "Remove" chip action.
- **Actions Bar**:
  - "Cancel" button (Secondary) -> returns to My Tickets.
  - "Submit Ticket" button (Primary Green `#006B3C`). Displays busy state spinner during POST request.
- **Error Preservation**: If API returns 500 or validation failure, a prominent top alert appears while all typed input values and chosen attachments remain intact.

### 4.4. My Tickets List Screen Layout
- **Header**: Title "My Tickets" with right CTA "+ Create Ticket".
- **Filter & Search Bar**:
  - Search Input: Text search box with search icon ("Search by ticket number or summary...").
  - Category Filter: Dropdown ("All Categories", "Hardware", "Software", etc.).
  - Priority Filter: Dropdown ("All Priorities", "Low", "Medium", "High", "Urgent").
  - Status Filter: Dropdown ("All Statuses", "New", "In Progress", "Resolved", "Closed").
  - "Clear Filters" Button: Appears when search or filters are active.
- **Desktop Data Table (`>= 992px`)**:
  - Columns: Ticket No, Created Date, Summary, Category, Requested Priority, Status, Actions.
  - Row Hover: Background `#F8FAFC`. Selected row: `#EAF6EF`.
  - Priority Badges:
    - `LOW`: Soft Gray (`#F1F5F9` text `#475569`)
    - `MEDIUM`: Amber (`#FEF3C7` text `#D97706`)
    - `HIGH`: Orange (`#FFEDD5` text `#C2410C`)
    - `URGENT`: Red (`#FEE2E2` text `#DC2626`)
  - Status Badges:
    - `NEW`: Pale Green (`#EAF6EF` text `#006B3C`)
    - `IN_PROGRESS`: Soft Blue (`#E0F2FE` text `#0284C7`)
    - `RESOLVED`: Gray-Green (`#F0FDF4` text `#15803D`)
- **Mobile Card View (`< 768px`)**:
  - Table transforms into stacked card items.
  - Card Layout: Top row displays Ticket No & Status Badge. Middle displays Summary in bold. Bottom row displays Category, Priority Badge, and Created Date. Entire card is clickable to open detail view.
- **Pagination Controls**:
  - Summary text: "Showing 1-5 of 15 tickets".
  - Controls: "Previous" button, page number pills (`1`, `2`, `3`), "Next" button.
- **List States**:
  - Loading State: 5 animated skeleton rows.
  - Empty State (0 tickets created): Graphic icon, title "No Support Tickets Yet", text "You haven't submitted any IT support tickets.", CTA button "Create Your First Ticket".
  - No-Results State (filters active): Title "No Matching Tickets", text "No tickets matched your search criteria.", CTA button "Clear Filters".

### 4.5. Ticket Detail View & Soft Removal Modal
- **Header**: Breadcrumb `My Tickets > Ticket Details`, Back button "<- Back to My Tickets".
- **Ticket Summary Banner**: Ticket Number in large text, Status Badge, Created Date.
- **Read-Only Detail Grid**:
  - All ticket fields rendered inside read-only cards (`#F0F4F1` field shading).
  - Fields: Ticket No, Ticket Date, Category, Related System, Requester Name & Email, Requested Priority, IT Priority, Current Status, Summary, Description.
- **Attachments Card**:
  - Header: "Attachments" with active count pill (e.g. `Attachments (2/5)`).
  - Add Attachment Dropzone / File Picker button (disabled if 5 active attachments reached).
  - Active File Row: Displays filename, file size, MIME type icon, "Download" button, and red "Soft Remove" button.
  - Soft-Removed File Row: Muted opacity (`60%`), gray background (`#F8FAFC`), badge "Soft Removed" (`#F1F5F9` text `#64748B`), download button disabled/removed, removal metadata callout: `Removed on [Date] by Requester. Reason: [removalReason]`.
- **Soft Removal Confirmation Modal**:
  - Modal Overlay: Darkened backdrop (`rgba(0,0,0,0.5)`).
  - Dialog Box: White container, title "Confirm Attachment Soft Removal".
  - Warning Text: "This will soft-remove '[filename]'. The file will remain recorded for compliance audit, but download access will be disabled."
  - Input Field `*`: Label "Reason for Removal", required text input (min 3 chars), placeholder "e.g., File contained sensitive info / uploaded wrong version".
  - Actions: Secondary "Cancel" button, Destructive Red "Soft Remove Attachment" button.

---

## 5. UI Visual Inspection Checklist & Screenshot Directory

### Screenshot Directory Structure (`artifacts/lab-02/screenshots/`)
```
artifacts/lab-02/screenshots/
├── create-ticket/
│   ├── desktop-initial.png
│   ├── desktop-validation-errors.png
│   ├── desktop-success-modal.png
│   ├── mobile-form-stacked.png
│   └── server-error-preserved.png
├── my-tickets/
│   ├── desktop-table-view.png
│   ├── desktop-search-filtered.png
│   ├── mobile-card-view.png
│   ├── empty-state.png
│   └── no-results-state.png
└── ticket-detail/
    ├── desktop-detail-view.png
    ├── attachment-soft-removal-modal.png
    ├── soft-removed-file-display.png
    └── mobile-detail-view.png
```

### Visual Inspection Checklist
- [ ] Primary Green `#006B3C` applied to app header, primary CTAs, and active navigation.
- [ ] Hover Green `#0B7A46` active on button hovers and focus rings.
- [ ] Read-only fields visually shaded with `#F0F4F1`.
- [ ] Required fields display a red asterisk (`*`).
- [ ] Validation errors appear directly beneath invalid input fields in red.
- [ ] Desktop layout centers at max width `1200px`; mobile single-column stacks vertically without horizontal scroll.
- [ ] Soft-removed attachment items show "Soft Removed" badge and removal reason while download links are disabled.
