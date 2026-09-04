# Lab 2 Test Plan, Traceability Matrix & Verification Specification
## TokTickIT Requester Ticketing Automated Test Suite

---

## 1. Test Strategy & Architectural Levels

The test plan employs a multi-tiered testing strategy to guarantee security, data isolation, UI presentation, and full-stack workflow integrity.

- **Backend Unit Tests**: Utility functions (Ticket Number generator, file size/MIME validators).
- **Backend API Integration Tests**: API endpoints using Vitest & Supertest (`server/tests/lab-02/`).
- **Frontend Component Tests**: React components using Vitest & React Testing Library (`client/src/__tests__/lab-02/`).
- **Playwright E2E Tests**: End-to-end browser user flows across responsive viewports (`e2e/lab-02/`).

---

## 2. Planned Test Scenarios & Test Suite Table

| Test ID | Level / Type | Target AC / Req | Test Description & Scenario | Expected Result | Automated Test File Path | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **UNIT-01** | Unit | BR-01 | Ticket Number generator utility. | Formats string as `TKT-2026-XXXXXX` with 6 zero-padded digits. | `server/tests/lab-02/utils.test.ts` | Planned |
| **UNIT-02** | Unit | BR-04 | Attachment file validator helper. | Accepts `.pdf`, `.png`, `.jpg`, `.webp` <= 5 MB; rejects `.exe` or > 5 MB. | `server/tests/lab-02/utils.test.ts` | Planned |
| **API-01** | API | AC-01 | `GET /api/dev-requesters` listing. | Returns 200 OK with list of active requesters (`isActive = true`). | `server/tests/lab-02/dev-requesters.api.test.ts` | Planned |
| **API-02** | API | AC-03 | `POST /api/tickets` valid creation. | Creates ticket record, returns 201 Created with auto ticket number. | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| **API-03** | API | AC-04 | `POST /api/tickets` validation error. | Rejects short summary (<5 chars) with 400 Bad Request and field error details. | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| **API-04** | API | AC-02, AC-08 | `GET /api/tickets` owned list isolation. | Returns 200 OK containing only tickets matching `x-dev-requester-id`. | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| **API-05** | API | AC-09 | `GET /api/tickets` pagination & search. | Filters tickets by `search` and returns correct `pagination` metadata. | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| **API-06** | API | AC-10 | `GET /api/tickets/:id` cross-user check. | Accessing another requester's ticket returns HTTP 403 Forbidden. | `server/tests/lab-02/ticket-detail.api.test.ts` | Planned |
| **API-07** | API | AC-06, AC-07 | `POST /api/tickets/:id/attachments`. | Uploads file <= 5MB; 6th active attachment returns 422 Unprocessable. | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| **API-08** | API | AC-11 | `DELETE /api/attachments/:id` soft removal.| Sets `isRemoved = true`, stores `removalReason`, returns 200 OK. | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| **API-09** | API | AC-12 | `GET /api/attachments/:id/download`. | Active file streams 200 OK; soft-removed file returns 403 Forbidden. | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| **UI-01** | Component | AC-01 | Dev Requester Selector rendering. | Renders dropdown, stores selection in `localStorage`, updates identity context. | `client/src/__tests__/lab-02/DevSelector.test.tsx` | Planned |
| **UI-02** | Component | AC-04 | Create Ticket Form inline errors. | Submitting empty form displays red asterisks and field validation messages. | `client/src/__tests__/lab-02/CreateTicket.test.tsx` | Planned |
| **UI-03** | Component | AC-05 | Form state preservation on 500 error. | Form preserves typed inputs and attached files when API returns 500. | `client/src/__tests__/lab-02/CreateTicket.test.tsx` | Planned |
| **UI-04** | Component | AC-08, AC-09 | My Tickets table & pagination. | Renders data table, applies status filters, and switches pagination pages. | `client/src/__tests__/lab-02/MyTickets.test.tsx` | Planned |
| **UI-05** | Component | AC-11 | Attachment soft removal modal. | Confirmation modal opens, requires reason input, triggers deletion handler. | `client/src/__tests__/lab-02/AttachmentSection.test.tsx` | Planned |
| **E2E-01** | Playwright | AC-01, AC-03 | End-to-end ticket submission flow. | Selects Requester A, fills form, submits ticket, verifies Ticket Number. | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| **E2E-02** | Playwright | AC-02, AC-10 | Multi-user isolation verification. | Switch from Requester A to Requester B; verify Requester A's tickets disappear. | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| **E2E-03** | Playwright | AC-11, AC-12 | Attachment upload & soft removal. | Uploads PDF, verifies active download, soft-removes with reason, verifies blocked link. | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| **E2E-04** | Playwright | AC-08, AC-09 | Responsive table & mobile card view. | Captures screenshots at 1200px (Desktop), 800px (Tablet), 375px (Mobile). | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |

---

## 3. Acceptance Criterion Traceability Matrix

| Acceptance Criterion ID | Description Summary | Covering Test IDs | Target Test File Paths |
| :--- | :--- | :--- | :--- |
| **AC-01** | Dev Requester selection & `localStorage` context. | `API-01`, `UI-01`, `E2E-01` | `server/tests/lab-02/dev-requesters.api.test.ts`, `client/src/__tests__/lab-02/DevSelector.test.tsx`, `e2e/lab-02/requester-ticket-flow.spec.ts` |
| **AC-02** | Multi-requester data isolation. | `API-04`, `E2E-02` | `server/tests/lab-02/my-tickets.api.test.ts`, `e2e/lab-02/requester-ticket-flow.spec.ts` |
| **AC-03** | Ticket submission success & Ticket Number generation. | `UNIT-01`, `API-02`, `E2E-01` | `server/tests/lab-02/utils.test.ts`, `server/tests/lab-02/create-ticket.api.test.ts`, `e2e/lab-02/requester-ticket-flow.spec.ts` |
| **AC-04** | Form field validation errors & inline display. | `API-03`, `UI-02` | `server/tests/lab-02/create-ticket.api.test.ts`, `client/src/__tests__/lab-02/CreateTicket.test.tsx` |
| **AC-05** | Form input preservation on server failure (500). | `UI-03` | `client/src/__tests__/lab-02/CreateTicket.test.tsx` |
| **AC-06** | Attachment MIME type & size limits (5 MB). | `UNIT-02`, `API-07` | `server/tests/lab-02/utils.test.ts`, `server/tests/lab-02/attachments.api.test.ts` |
| **AC-07** | Active attachment quota enforcement (max 5). | `API-07` | `server/tests/lab-02/attachments.api.test.ts` |
| **AC-08** | My Tickets search & filtering. | `API-05`, `UI-04`, `E2E-04` | `server/tests/lab-02/my-tickets.api.test.ts`, `client/src/__tests__/lab-02/MyTickets.test.tsx`, `e2e/lab-02/requester-ticket-flow.spec.ts` |
| **AC-09** | My Tickets server-side pagination. | `API-05`, `UI-04`, `E2E-04` | `server/tests/lab-02/my-tickets.api.test.ts`, `client/src/__tests__/lab-02/MyTickets.test.tsx`, `e2e/lab-02/requester-ticket-flow.spec.ts` |
| **AC-10** | Unauthorized cross-requester detail access (403). | `API-06`, `E2E-02` | `server/tests/lab-02/ticket-detail.api.test.ts`, `e2e/lab-02/requester-ticket-flow.spec.ts` |
| **AC-11** | Attachment soft removal flow & reason audit. | `API-08`, `UI-05`, `E2E-03` | `server/tests/lab-02/attachments.api.test.ts`, `client/src/__tests__/lab-02/AttachmentSection.test.tsx`, `e2e/lab-02/requester-ticket-flow.spec.ts` |
| **AC-12** | Soft-removed attachment download block (403). | `API-09`, `E2E-03` | `server/tests/lab-02/attachments.api.test.ts`, `e2e/lab-02/requester-ticket-flow.spec.ts` |

---

## 4. Responsive & Visual Verification Checklist

| Viewport | Dimensions | Verification Items |
| :--- | :--- | :--- |
| **Desktop** | `1200 x 900` | Full multi-column form, table layout with all columns, pagination bar, identity badge in top right. |
| **Tablet** | `800 x 1024` | 2-column form layout, table horizontally scrollable or compressed, touch-friendly dropdown targets. |
| **Mobile** | `375 x 812` | Single-column form, table converts to card list view, full-width submit buttons, zero horizontal page overflow. |

---

## 5. Test Execution Commands

```bash
# Run server API integration & unit tests
npm --prefix server test -- lab-02

# Run client React component tests
npm --prefix client test -- lab-02

# Run Playwright E2E tests & capture screenshots
npx playwright test e2e/lab-02/
```

---

## 6. DoD Verification Checklist

- [ ] All 12 Acceptance Criteria (AC-01 to AC-12) mapped to passing automated tests.
- [ ] 0 failing tests and 0 skipped tests across Vitest and Playwright suites.
- [ ] Viewport screenshots captured for Desktop, Tablet, Mobile and saved in `artifacts/lab-02/screenshots/`.
