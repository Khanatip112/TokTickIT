# Lab 2 REST API Specification
## TokTickIT Requester Ticketing MVP API Contracts

---

## 1. Overview & Base Conventions

- **Base URL**: `/api`
- **Protocol**: HTTP/1.1
- **Content Types**:
  - Standard JSON requests: `application/json`
  - File upload requests: `multipart/form-data`
  - Responses: `application/json` (except file download: binary stream with `Content-Disposition`)
- **Development Identity Context Header**:
  - All requester-scoped endpoints require the header `x-dev-requester-id: <number>`.
  - If header is missing or references an invalid/inactive user ID, backend returns `401 Unauthorized` or `403 Forbidden`.

---

## 2. Global Error Structure

All error responses adhere to the standard JSON structure:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Validation failed for ticket creation",
    "details": [
      {
        "field": "summary",
        "message": "Summary must be at least 5 characters long"
      }
    ]
  }
}
```

### Standard Status Codes
- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Validation failure or invalid request body format.
- `401 Unauthorized`: Dev Requester ID header missing.
- `403 Forbidden`: Dev Requester is inactive or attempting to access a resource owned by another requester.
- `404 Not Found`: Resource (Ticket, Attachment, Category, System) does not exist.
- `413 Payload Too Large`: Upload file exceeds 5 MB size limit.
- `422 Unprocessable Entity`: Business rule constraint violated (e.g. active attachment quota reached).
- `500 Internal Server Error`: Unexpected backend error.

---

## 3. API Endpoints

### 3.1. GET /api/dev-requesters
Retrieve a list of active Development Requesters for the identity selection screen.

- **HTTP Method**: `GET`
- **Path**: `/api/dev-requesters`
- **Authentication Header**: None required (public lookup endpoint for testing).
- **Query Parameters**: None.

#### Success Response (200 OK)
```json
[
  {
    "id": 1,
    "name": "Jennifer Anderson",
    "email": "jennifer.anderson@example.com",
    "department": "Marketing",
    "isActive": true
  },
  {
    "id": 2,
    "name": "David Lee",
    "email": "david.lee@example.com",
    "department": "Finance",
    "isActive": true
  },
  {
    "id": 3,
    "name": "Sarah Johnson",
    "email": "sarah.johnson@example.com",
    "department": "Human Resources",
    "isActive": true
  },
  {
    "id": 4,
    "name": "Michael Brown",
    "email": "michael.brown@example.com",
    "department": "Operations",
    "isActive": true
  }
]
```

#### Error Responses
- `500 Internal Server Error`: Database query failed.

---

### 3.2. GET /api/categories
Retrieve active ticket categories.

- **HTTP Method**: `GET`
- **Path**: `/api/categories`
- **Authentication Header**: Optional.

#### Success Response (200 OK)
```json
[
  {
    "id": 1,
    "name": "Account and Access",
    "description": "Login issues, password resets, role permissions, and access grants"
  },
  {
    "id": 2,
    "name": "Hardware",
    "description": "Laptops, monitors, printers, docking stations, and peripherals"
  },
  {
    "id": 3,
    "name": "Software",
    "description": "Application crashes, license activation, installation, and updates"
  },
  {
    "id": 4,
    "name": "Network",
    "description": "Wi-Fi connectivity, VPN issues, DNS problems, and slow speed"
  }
]
```

---

### 3.3. GET /api/related-systems
Retrieve active related systems.

- **HTTP Method**: `GET`
- **Path**: `/api/related-systems`
- **Authentication Header**: Optional.

#### Success Response (200 OK)
```json
[
  { "id": 1, "name": "Email", "code": "SYS-EMAIL" },
  { "id": 2, "name": "Campus Wi-Fi", "code": "SYS-WIFI" },
  { "id": 3, "name": "VPN", "code": "SYS-VPN" },
  { "id": 4, "name": "LEB2 App", "code": "SYS-LEB2" },
  { "id": 5, "name": "Grade Submission App", "code": "SYS-GRADES" },
  { "id": 6, "name": "Printer", "code": "SYS-PRINT" },
  { "id": 7, "name": "Corporate Laptop", "code": "SYS-LAPTOP" }
]
```

---

### 3.4. POST /api/tickets
Create a new support ticket for the active Development Requester.

- **HTTP Method**: `POST`
- **Path**: `/api/tickets`
- **Headers**:
  - `Content-Type: application/json`
  - `x-dev-requester-id: <number>` (Required)

#### Request Body Schema
```json
{
  "categoryId": 2,
  "relatedSystemId": 7,
  "requestedPriority": "MEDIUM",
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery is draining much faster than usual even when idle. Started after last update."
}
```

#### Field Validation Rules
- `categoryId`: Integer, required, must exist and be active.
- `relatedSystemId`: Integer, required, must exist and be active.
- `requestedPriority`: String, required, enum: `["LOW", "MEDIUM", "HIGH", "URGENT"]`.
- `summary`: String, required, trimmed, min 5 chars, max 150 chars.
- `description`: String, required, trimmed, min 10 chars, max 3000 chars.

#### Success Response (201 Created)
```json
{
  "id": 42,
  "ticketNumber": "TKT-2026-000042",
  "requesterId": 1,
  "categoryId": 2,
  "relatedSystemId": 7,
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery is draining much faster than usual even when idle. Started after last update.",
  "requestedPriority": "MEDIUM",
  "itPriority": "MEDIUM",
  "currentStatus": "NEW",
  "createdAt": "2026-09-04T10:15:30.000Z",
  "updatedAt": "2026-09-04T10:15:30.000Z",
  "requester": {
    "id": 1,
    "name": "Jennifer Anderson",
    "email": "jennifer.anderson@example.com"
  },
  "category": {
    "id": 2,
    "name": "Hardware"
  },
  "relatedSystem": {
    "id": 7,
    "name": "Corporate Laptop"
  },
  "attachments": []
}
```

#### Error Responses
- `400 Bad Request`: Field validation error.
- `401 Unauthorized`: Missing `x-dev-requester-id` header.
- `403 Forbidden`: Dev Requester ID is inactive.
- `500 Internal Server Error`: Backend database failure.

---

### 3.5. GET /api/tickets
Retrieve a paginated, searchable, filterable list of tickets owned strictly by the requesting user.

- **HTTP Method**: `GET`
- **Path**: `/api/tickets`
- **Headers**: `x-dev-requester-id: <number>` (Required)
- **Query Parameters**:
  - `page`: Integer (optional, default: `1`, min: `1`).
  - `pageSize`: Integer (optional, default: `10`, min: `1`, max: `50`).
  - `search`: String (optional, search across `ticketNumber` and `summary`).
  - `categoryId`: Integer (optional, filter by category).
  - `requestedPriority`: Enum String (optional: `LOW`, `MEDIUM`, `HIGH`, `URGENT`).
  - `currentStatus`: Enum String (optional: `NEW`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`).
  - `sortBy`: String (optional, default: `createdAt`, options: `createdAt`, `updatedAt`, `ticketNumber`, `requestedPriority`).
  - `sortOrder`: String (optional, default: `desc`, options: `asc`, `desc`).

#### Success Response (200 OK)
```json
{
  "data": [
    {
      "id": 42,
      "ticketNumber": "TKT-2026-000042",
      "summary": "Laptop battery drains quickly",
      "requestedPriority": "MEDIUM",
      "itPriority": "MEDIUM",
      "currentStatus": "NEW",
      "createdAt": "2026-09-04T10:15:30.000Z",
      "updatedAt": "2026-09-04T10:15:30.000Z",
      "category": {
        "id": 2,
        "name": "Hardware"
      },
      "relatedSystem": {
        "id": 7,
        "name": "Corporate Laptop"
      },
      "activeAttachmentsCount": 0
    }
  ],
  "pagination": {
    "totalCount": 1,
    "page": 1,
    "pageSize": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

---

### 3.6. GET /api/tickets/:id
Retrieve full details of a specific ticket owned by the requesting user.

- **HTTP Method**: `GET`
- **Path**: `/api/tickets/:id`
- **Headers**: `x-dev-requester-id: <number>` (Required)

#### Ownership Check
Backend fetches ticket where `id = :id`. If `ticket.requesterId !== header.x-dev-requester-id`, return `403 Forbidden`.

#### Success Response (200 OK)
```json
{
  "id": 42,
  "ticketNumber": "TKT-2026-000042",
  "requesterId": 1,
  "categoryId": 2,
  "relatedSystemId": 7,
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery is draining much faster than usual even when idle. Started after last update.",
  "requestedPriority": "MEDIUM",
  "itPriority": "MEDIUM",
  "currentStatus": "NEW",
  "createdAt": "2026-09-04T10:15:30.000Z",
  "updatedAt": "2026-09-04T10:15:30.000Z",
  "requester": {
    "id": 1,
    "name": "Jennifer Anderson",
    "email": "jennifer.anderson@example.com",
    "department": "Marketing"
  },
  "category": {
    "id": 2,
    "name": "Hardware"
  },
  "relatedSystem": {
    "id": 7,
    "name": "Corporate Laptop"
  },
  "attachments": [
    {
      "id": 10,
      "filename": "battery_report.pdf",
      "originalName": "battery_report.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 1048576,
      "isRemoved": false,
      "removedAt": null,
      "removalReason": null,
      "createdAt": "2026-09-04T10:16:00.000Z",
      "downloadUrl": "/api/attachments/10/download"
    }
  ]
}
```

#### Error Responses
- `403 Forbidden`: Ticket belongs to a different requester.
- `404 Not Found`: Ticket ID does not exist.

---

### 3.7. POST /api/tickets/:id/attachments
Upload a new attachment to an existing owned ticket.

- **HTTP Method**: `POST`
- **Path**: `/api/tickets/:id/attachments`
- **Headers**:
  - `Content-Type: multipart/form-data`
  - `x-dev-requester-id: <number>` (Required)
- **Form Data Field**: `file` (Binary file)

#### Validation Constraints
- MIME types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
- Max size: 5,242,880 bytes (5 MB).
- Active Attachment Limit: Backend checks count of `Attachment` records where `ticketId = :id` and `isRemoved = false`. If count >= 5, return `422 Unprocessable Entity`.

#### Success Response (201 Created)
```json
{
  "id": 11,
  "ticketId": 42,
  "filename": "screenshot_error.png",
  "originalName": "screenshot_error.png",
  "mimeType": "image/png",
  "sizeBytes": 524288,
  "isRemoved": false,
  "removedAt": null,
  "removalReason": null,
  "createdAt": "2026-09-04T10:20:00.000Z",
  "downloadUrl": "/api/attachments/11/download"
}
```

#### Error Responses
- `400 Bad Request`: Unsupported MIME type or invalid file field.
- `403 Forbidden`: Ticket owned by another user.
- `413 Payload Too Large`: File exceeds 5 MB.
- `422 Unprocessable Entity`: Maximum active attachment quota (5) reached.

---

### 3.8. GET /api/attachments/:id/download
Download or stream an active attachment owned by the requesting user.

- **HTTP Method**: `GET`
- **Path**: `/api/attachments/:id/download`
- **Headers**: `x-dev-requester-id: <number>` (Required)

#### Validation & Soft Removal Check
1. Fetch attachment by `:id` and join ticket.
2. If `ticket.requesterId !== header.x-dev-requester-id`, return `403 Forbidden`.
3. If `attachment.isRemoved === true`, return `403 Forbidden` with error message: `"File soft-removed and unavailable for download"`.

#### Success Response (200 OK)
- **Headers**:
  - `Content-Type`: `<mimeType>`
  - `Content-Disposition`: `attachment; filename="<originalName>"`
  - `Content-Length`: `<sizeBytes>`
- **Body**: Binary file stream.

---

### 3.9. DELETE /api/attachments/:id
Soft-remove an attachment from an owned ticket.

- **HTTP Method**: `DELETE`
- **Path**: `/api/attachments/:id`
- **Headers**:
  - `Content-Type: application/json`
  - `x-dev-requester-id: <number>` (Required)

#### Request Body Schema
```json
{
  "removalReason": "Uploaded incorrect diagnostic report version"
}
```

#### Validation Rules
- `removalReason`: String, required, non-empty, min 3 characters.

#### Backend Operation
Sets `isRemoved = true`, `removedAt = current_timestamp()`, `removalReason = req.body.removalReason`. Does NOT delete physical file or database row.

#### Success Response (200 OK)
```json
{
  "id": 10,
  "ticketId": 42,
  "filename": "battery_report.pdf",
  "originalName": "battery_report.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 1048576,
  "isRemoved": true,
  "removedAt": "2026-09-04T10:25:00.000Z",
  "removalReason": "Uploaded incorrect diagnostic report version",
  "message": "Attachment successfully soft-removed"
}
```

#### Error Responses
- `400 Bad Request`: `removalReason` missing or less than 3 characters.
- `403 Forbidden`: Attachment/ticket owned by another user.
- `404 Not Found`: Attachment ID does not exist.