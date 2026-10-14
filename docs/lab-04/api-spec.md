# Lab 4 REST API Specification
## TokTickIT Actions Taken, Dashboards, and Workflow Gate APIs

---

## 1. Architectural Overview & Conventions

- **Base URL**: `/api`
- **Protocol**: HTTP/1.1 over TLS (HTTPS in production; HTTP in local development)
- **Data Exchange Format**:
  - Request Bodies: `application/json`
  - Response Bodies: `application/json`
- **Character Encoding**: UTF-8
- **Authentication Scheme**:
  - Cookie-based session (`toktickit_session`) with `HttpOnly`, `SameSite=Lax`, and `Path=/`.
  - Alternatively supported: `Authorization: Bearer <token>` header for automated integration tests and REST clients.
  - All Lab 4 endpoints require an authenticated session unless otherwise specified.
- **First-Login Barrier**: If `user.mustChangePassword === true`, server middleware intercepts all requests except password-change and auth endpoints, returning `403 Forbidden` with `PASSWORD_CHANGE_REQUIRED`.

---

## 2. Global Error Structure

All error responses adhere to the consistent JSON envelope established in Lab 3:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Human-readable description of error",
    "details": [
      {
        "field": "description",
        "message": "Description is required and must be between 1 and 1000 characters."
      }
    ]
  }
}
```

### Standard HTTP Status Codes (Lab 4 additions)

| Status Code | Code String | Condition & Semantic Meaning |
| :--- | :--- | :--- |
| `200 OK` | `OK` | Request succeeded; response contains requested data. |
| `201 Created` | `CREATED` | ActionTaken record successfully created. |
| `400 Bad Request` | `BAD_REQUEST` | Validation failed (missing required field, invalid length, `followUpRequired: true` without `followUpNote`, future `actionDateTime`). |
| `401 Unauthorized` | `UNAUTHORIZED` | Authentication missing or expired session. |
| `403 Forbidden` | `FORBIDDEN` | Authenticated, but user lacks permission (wrong role, not resource owner, password change required). |
| `404 Not Found` | `NOT_FOUND` | Target ticket or ActionTaken record does not exist. |
| `409 Conflict` | `CONFLICT` | Concurrency conflict detected via `updatedAt` mismatch. |
| `422 Unprocessable Entity` | `UNPROCESSABLE_ENTITY` | Business rule violation (Resolution Gate: attempting RESOLVED/CLOSED with 0 Actions Taken; invalid status transition). |
| `500 Server Error` | `INTERNAL_SERVER_ERROR` | Unexpected backend or database exception. |

---

## 3. Endpoints Specification

### 3.1. Actions Taken Management

---

#### 3.1.1. `GET /api/tickets/:id/actions-taken`

Retrieves all Actions Taken for a specific ticket, ordered chronologically by `actionDateTime` ascending.

- **Access**: `REQUESTER` (own tickets only), `IT_STAFF`, `ADMINISTRATOR`
- **Path Parameters**:

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Yes | The ticket ID (CUID). |

- **Query Parameters**: None.

- **Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "clxyz123abc",
      "ticketId": "clxyz000tic",
      "actionDateTime": "2026-10-15T10:30:00.000Z",
      "description": "Ran remote battery calibration utility and cleared battery memory cache.",
      "result": "SUCCESS",
      "performedBy": {
        "id": "clxyz456usr",
        "fullName": "Michael Brown",
        "role": "IT_STAFF"
      },
      "followUpRequired": true,
      "followUpNote": "Monitor laptop drain overnight on test bench.",
      "attachmentNotes": "Diagnostics export saved as battery-report-01.html",
      "createdAt": "2026-10-15T10:30:00.000Z",
      "updatedAt": "2026-10-15T10:30:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "ticketId": "clxyz000tic"
  }
}
```

- **Error Responses**:

| Status | Condition |
| :--- | :--- |
| `401 Unauthorized` | No active session. |
| `403 Forbidden` | Requester attempting to access another user's ticket. |
| `404 Not Found` | Ticket with the given `id` does not exist. |

---

#### 3.1.2. `POST /api/tickets/:id/actions-taken`

Creates a new Action Taken record for the specified ticket. The `performedById` is automatically derived from the authenticated session.

- **Access**: `IT_STAFF`, `ADMINISTRATOR` only. `REQUESTER` receives `403 Forbidden`.
- **Path Parameters**:

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Yes | The ticket ID (CUID). |

- **Request Body**:
```json
{
  "actionDateTime": "2026-10-15T10:30:00.000Z",
  "description": "Ran remote battery calibration utility and cleared battery memory cache.",
  "result": "SUCCESS",
  "followUpRequired": true,
  "followUpNote": "Monitor laptop drain overnight on test bench.",
  "attachmentNotes": "Diagnostics export saved as battery-report-01.html"
}
```

- **Field Validation Rules**:

| Field | Type | Required | Constraints |
| :--- | :--- | :--- | :--- |
| `actionDateTime` | `ISO-8601 string` | No (defaults to `now()`) | Must not be in the future. |
| `description` | `string` | **Yes** | 1–1,000 characters. |
| `result` | `enum` | **Yes** | One of: `SUCCESS`, `PARTIAL`, `PENDING`, `FAILED`. |
| `followUpRequired` | `boolean` | No (defaults `false`) | — |
| `followUpNote` | `string` | **Conditional** | Required if `followUpRequired === true`; 1–1,000 characters. Ignored/nullified if `followUpRequired === false`. |
| `attachmentNotes` | `string` | No | Max 500 characters. |

- **Server-Side Auto-Derivation**:
  - `performedById` ← `req.session.userId` (any client-supplied value is discarded).

- **Response**: `201 Created`
```json
{
  "data": {
    "id": "clxyz789new",
    "ticketId": "clxyz000tic",
    "actionDateTime": "2026-10-15T10:30:00.000Z",
    "description": "Ran remote battery calibration utility and cleared battery memory cache.",
    "result": "SUCCESS",
    "performedBy": {
      "id": "clxyz456usr",
      "fullName": "Michael Brown",
      "role": "IT_STAFF"
    },
    "followUpRequired": true,
    "followUpNote": "Monitor laptop drain overnight on test bench.",
    "attachmentNotes": "Diagnostics export saved as battery-report-01.html",
    "createdAt": "2026-10-15T10:30:00.000Z",
    "updatedAt": "2026-10-15T10:30:00.000Z"
  }
}
```

- **Error Responses**:

| Status | Condition |
| :--- | :--- |
| `400 Bad Request` | Validation failure (missing `description`, invalid `result` enum, `followUpRequired: true` without `followUpNote`, future `actionDateTime`). |
| `401 Unauthorized` | No active session. |
| `403 Forbidden` | `REQUESTER` role attempting to create an action. |
| `404 Not Found` | Ticket with the given `id` does not exist. |

---

#### 3.1.3. `PUT /api/actions-taken/:actionId`

Updates an existing Action Taken record. Only the original performer or an `ADMINISTRATOR` may update.

- **Access**: `IT_STAFF` (if performer), `ADMINISTRATOR`
- **Path Parameters**:

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `actionId` | `string` | Yes | The ActionTaken record ID (CUID). |

- **Request Body** (partial update supported):
```json
{
  "description": "Updated description after further investigation.",
  "result": "PARTIAL",
  "followUpRequired": false,
  "followUpNote": null,
  "attachmentNotes": "Updated attachment reference: error-log-v2.txt"
}
```

- **Field Validation Rules**: Same constraints as `POST` (Section 3.1.2), with additional rules:
  - `performedById` is **immutable** and cannot be changed.
  - `actionDateTime` may be updated but must not be set to a future timestamp.

- **Response**: `200 OK`
```json
{
  "data": {
    "id": "clxyz789new",
    "ticketId": "clxyz000tic",
    "actionDateTime": "2026-10-15T10:30:00.000Z",
    "description": "Updated description after further investigation.",
    "result": "PARTIAL",
    "performedBy": {
      "id": "clxyz456usr",
      "fullName": "Michael Brown",
      "role": "IT_STAFF"
    },
    "followUpRequired": false,
    "followUpNote": null,
    "attachmentNotes": "Updated attachment reference: error-log-v2.txt",
    "createdAt": "2026-10-15T10:30:00.000Z",
    "updatedAt": "2026-10-15T11:00:00.000Z"
  }
}
```

- **Error Responses**:

| Status | Condition |
| :--- | :--- |
| `400 Bad Request` | Validation failure (same rules as POST). |
| `401 Unauthorized` | No active session. |
| `403 Forbidden` | `REQUESTER` role, or `IT_STAFF` who is not the original performer. |
| `404 Not Found` | ActionTaken with the given `actionId` does not exist. |
| `409 Conflict` | Concurrency conflict (`updatedAt` mismatch if implemented). |

---

### 3.2. Ticket Workflow & Resolution Gate

---

#### 3.2.1. `PATCH /api/tickets/:id/status` (Resolution Gate Extension)

This endpoint was established in Lab 3 for status transitions. Lab 4 extends it with the **Resolution Gate** enforcement.

- **Additional Lab 4 Validation**:
  - When transitioning to `RESOLVED` or `CLOSED`:
    1. The server queries `count(ActionTaken WHERE ticketId = :id)`.
    2. If count is `0`, the request is rejected with `422 Unprocessable Entity`:
       ```json
       {
         "error": {
           "code": "UNPROCESSABLE_ENTITY",
           "message": "Cannot resolve or close a ticket without at least one recorded Action Taken."
         }
       }
       ```
    3. If count is `>= 1` and all other Lab 3 requirements (valid transition, `resolutionSummary`) are met, the transition proceeds.

- **Unchanged Behavior**: All existing Lab 3 status transition rules (permitted transitions matrix, role authorization, `resolutionSummary` requirement) remain fully in effect.

---

### 3.3. Dashboard Endpoints

---

#### 3.3.1. `GET /api/dashboards/requester`

Calculates and returns personalized dashboard summary metrics for the authenticated Requester.

- **Access**: `REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`
- **Query Parameters**: None.
- **Computation Scope**: All tickets where `ticket.requesterId === req.session.userId`.

- **Response**: `200 OK`
```json
{
  "data": {
    "totalOpenTickets": 3,
    "inProgressCount": 1,
    "waitingForRequesterCount": 1,
    "recentlyResolvedCount": 2,
    "closedTicketsCount": 5,
    "recentTickets": [
      {
        "id": "clxyz000tic",
        "ticketNumber": "TKT-0001",
        "summary": "Laptop battery drains rapidly after BIOS update",
        "currentStatus": "IN_PROGRESS",
        "requestedPriority": "HIGH",
        "itPriority": "URGENT",
        "category": {
          "id": "clxyzcat01",
          "name": "Hardware"
        },
        "assignedTo": {
          "id": "clxyz456usr",
          "fullName": "Michael Brown"
        },
        "updatedAt": "2026-10-15T10:30:00.000Z",
        "createdAt": "2026-10-14T08:00:00.000Z"
      }
    ]
  }
}
```

- **Metric Calculation Rules (referencing BR-12)**:

| Metric | SQL Logic |
| :--- | :--- |
| `totalOpenTickets` | `COUNT(*) WHERE requesterId = :userId AND currentStatus IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED')` |
| `inProgressCount` | `COUNT(*) WHERE requesterId = :userId AND currentStatus = 'IN_PROGRESS'` |
| `waitingForRequesterCount` | `COUNT(*) WHERE requesterId = :userId AND currentStatus = 'WAITING_FOR_REQUESTER'` |
| `recentlyResolvedCount` | `COUNT(*) WHERE requesterId = :userId AND currentStatus = 'RESOLVED'` |
| `closedTicketsCount` | `COUNT(*) WHERE requesterId = :userId AND currentStatus = 'CLOSED'` |
| `recentTickets` | `SELECT ... WHERE requesterId = :userId ORDER BY updatedAt DESC LIMIT 5` |

- **Error Responses**:

| Status | Condition |
| :--- | :--- |
| `401 Unauthorized` | No active session. |

---

#### 3.3.2. `GET /api/dashboards/staff`

Calculates and returns operational dashboard summary metrics for IT Staff and Administrators.

- **Access**: `IT_STAFF`, `ADMINISTRATOR` only. `REQUESTER` receives `403 Forbidden`.
- **Query Parameters**: None.

- **Response**: `200 OK`
```json
{
  "data": {
    "unassignedCount": 4,
    "assignedToMeCount": 7,
    "inProgressCount": 12,
    "waitingRequesterCount": 3,
    "urgentPriorityCount": 2,
    "resolvedTodayCount": 1,
    "recentTickets": [
      {
        "id": "clxyz000tic",
        "ticketNumber": "TKT-0001",
        "summary": "Laptop battery drains rapidly after BIOS update",
        "currentStatus": "IN_PROGRESS",
        "requestedPriority": "HIGH",
        "itPriority": "URGENT",
        "category": {
          "id": "clxyzcat01",
          "name": "Hardware"
        },
        "requester": {
          "id": "clxyz789req",
          "fullName": "Jane Doe"
        },
        "assignedTo": {
          "id": "clxyz456usr",
          "fullName": "Michael Brown"
        },
        "updatedAt": "2026-10-15T10:30:00.000Z",
        "createdAt": "2026-10-14T08:00:00.000Z"
      }
    ],
    "userSummary": {
      "activeRequestersCount": 15,
      "activeStaffCount": 5,
      "totalUsersCount": 22
    }
  }
}
```

- **Metric Calculation Rules (referencing BR-13, BR-14)**:

| Metric | SQL Logic |
| :--- | :--- |
| `unassignedCount` | `COUNT(*) WHERE assignedToId IS NULL AND currentStatus IN ('NEW','OPEN','IN_PROGRESS','REOPENED')` |
| `assignedToMeCount` | `COUNT(*) WHERE assignedToId = :userId AND currentStatus IN ('OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED')` |
| `inProgressCount` | `COUNT(*) WHERE currentStatus = 'IN_PROGRESS'` |
| `waitingRequesterCount` | `COUNT(*) WHERE currentStatus = 'WAITING_FOR_REQUESTER'` |
| `urgentPriorityCount` | `COUNT(*) WHERE itPriority = 'URGENT' AND currentStatus NOT IN ('RESOLVED','CLOSED','CANCELLED')` |
| `resolvedTodayCount` | `COUNT(*) WHERE currentStatus = 'RESOLVED' AND updatedAt >= startOfDay(today)` |
| `recentTickets` | `SELECT ... ORDER BY itPriority DESC, updatedAt DESC LIMIT 5` |
| `userSummary.activeRequestersCount` | `COUNT(*) FROM User WHERE role = 'REQUESTER' AND isActive = true` (ADMIN only) |
| `userSummary.activeStaffCount` | `COUNT(*) FROM User WHERE role = 'IT_STAFF' AND isActive = true` (ADMIN only) |
| `userSummary.totalUsersCount` | `COUNT(*) FROM User` (ADMIN only) |

- **Note**: The `userSummary` object is only included when the authenticated user has the `ADMINISTRATOR` role. For `IT_STAFF`, this field is omitted or `null`.

- **Error Responses**:

| Status | Condition |
| :--- | :--- |
| `401 Unauthorized` | No active session. |
| `403 Forbidden` | `REQUESTER` role attempting to access staff dashboard. |

---

## 4. RBAC Summary for Lab 4 Endpoints

| Endpoint | HTTP Method | Requester | IT Staff | Administrator |
| :--- | :---: | :---: | :---: | :---: |
| `/api/tickets/:id/actions-taken` | `GET` | ✅ (Own tickets) | ✅ | ✅ |
| `/api/tickets/:id/actions-taken` | `POST` | ❌ (403) | ✅ | ✅ |
| `/api/actions-taken/:actionId` | `PUT` | ❌ (403) | ✅ (Performer only) | ✅ |
| `/api/tickets/:id/status` | `PATCH` | ❌ (403) | ✅ (+ Resolution Gate) | ✅ (+ Resolution Gate) |
| `/api/dashboards/requester` | `GET` | ✅ | ✅ | ✅ |
| `/api/dashboards/staff` | `GET` | ❌ (403) | ✅ | ✅ |

---

## 5. Backward Compatibility Notes

1. **All Lab 1, Lab 2, and Lab 3 API endpoints** remain fully operational without modification.
2. The `PATCH /api/tickets/:id/status` endpoint is **extended** with the Resolution Gate check but does not break existing valid transitions.
3. Legacy tickets created before Lab 4 (with 0 Actions Taken) remain readable and browsable. However, transitioning them to `RESOLVED` or `CLOSED` will now require recording at least one Action Taken first.
4. The Prisma schema evolution adds the `ActionTaken` model and `ActionResult` enum without altering any existing models or columns.

---

*Document version: 1.0 — 2026‑10‑15*
