# Lab 3 REST API Specification
## TokTickIT Authentication, Authorization, IT Staff Ticketing, and Admin APIs

---

## 1. Architectural Overview & Conventions

- **Base URL**: `/api`
- **Protocol**: HTTP/1.1 over TLS (HTTPS in production; HTTP in local development)
- **Data Exchange Format**:
  - Request Bodies: `application/json` (except file uploads: `multipart/form-data`)
  - Response Bodies: `application/json` (except file downloads: binary stream)
- **Character Encoding**: UTF-8
- **Authentication Scheme**:
  - Cookie-based session (`toktickit_session`) with `HttpOnly`, `SameSite=Lax`, and `Path=/`.
  - Alternatively supported: `Authorization: Bearer <token>` header for automated integration tests and REST clients.
  - On successful login, the server establishes an active session recording the authenticated user's ID, role, and password-change requirement.
- **First-Login Barrier Enforcement**:
  - If `user.requiresPasswordChange === true`, server middleware intercepts all requests except:
    - `GET /api/auth/me`
    - `POST /api/auth/change-password`
    - `POST /api/auth/logout`
  - All other API endpoints return `403 Forbidden` with error code `PASSWORD_CHANGE_REQUIRED`.

---

## 2. Global Error Structure & Security Conventions

All error responses adhere to a consistent JSON envelope:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Human-readable description of error",
    "details": [
      {
        "field": "email",
        "message": "Email address is already in use"
      }
    ]
  }
}
```

### Standard HTTP Status Codes

| Status Code | Code String | Condition & Semantic Meaning |
| :--- | :--- | :--- |
| `200 OK` | `OK` | Request succeeded; response contains requested data. |
| `201 Created` | `CREATED` | Resource successfully created (Ticket, User, Comment, Note). |
| `400 Bad Request` | `BAD_REQUEST` | Validation failed (missing required field, invalid length, malformed syntax). |
| `401 Unauthorized` | `UNAUTHORIZED` | Authentication missing, invalid credentials, or expired session. |
| `403 Forbidden` | `FORBIDDEN` | Authenticated, but user lacks permission (wrong role, not resource owner, or password change required). |
| `404 Not Found` | `NOT_FOUND` | Target resource does not exist (or hidden to prevent cross-tenant enumeration). |
| `409 Conflict` | `CONFLICT` | State conflict (e.g. duplicate email address registration). |
| `413 Payload Too Large` | `PAYLOAD_TOO_LARGE` | File upload exceeds maximum 5 MB limit. |
| `422 Unprocessable` | `UNPROCESSABLE_ENTITY` | Business rule violation (invalid status transition, admin self-deactivation, removing last admin). |
| `500 Server Error` | `INTERNAL_SERVER_ERROR` | Unexpected backend or database exception. |

### Security & Information Leakage Prevention
- **Authentication Errors**: All failed login attempts return a uniform error `"Invalid email or password."` to prevent email enumeration.
- **Deactivated Accounts**: Inactive users receive the same `"Invalid email or password."` response.
- **Internal Note Privacy**: Requesters attempting to access or write internal notes receive `403 Forbidden` with `"Access denied."` without disclosing note counts or timestamps.
- **Cross-Requester Ticket Access**: Accessing another user's ticket returns `403 Forbidden` (`"You do not have permission to access this ticket."`) or `404 Not Found`.

---

## 3. Endpoints Specification

### 3.1. Authentication & Session Management

---

#### 3.1.1. `POST /api/auth/login`
Authenticates a user with email and password, establishing an authenticated session.

- **Access**: Public / Unauthenticated
- **Request Body**:
```json
{
  "email": "jennifer.anderson@toktickit.com",
  "password": "Password123!"
}
```
- **Validation Rules**:
  - `email`: Required, valid email format.
  - `password`: Required, non-empty string.
- **Success Response (`200 OK`)**:
  - Sets HTTP-Only cookie `toktickit_session`.
```json
{
  "user": {
    "id": "cuid_user_1",
    "name": "Jennifer Anderson",
    "email": "jennifer.anderson@toktickit.com",
    "role": "REQUESTER",
    "department": "Marketing",
    "requiresPasswordChange": false
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: Missing email or password.
  - `401 Unauthorized`: Invalid credentials or account inactive (`"Invalid email or password."`).

---

#### 3.1.2. `POST /api/auth/logout`
Destroys the active session and invalidates the session cookie.

- **Access**: Authenticated (`REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`)
- **Request Body**: None.
- **Success Response (`200 OK`)**:
  - Clears `toktickit_session` cookie.
```json
{
  "message": "Successfully logged out"
}
```

---

#### 3.1.3. `GET /api/auth/me`
Retrieves the profile of the currently authenticated user.

- **Access**: Authenticated (`REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`)
- **Success Response (`200 OK`)**:
```json
{
  "user": {
    "id": "cuid_user_1",
    "name": "Jennifer Anderson",
    "email": "jennifer.anderson@toktickit.com",
    "role": "REQUESTER",
    "department": "Marketing",
    "requiresPasswordChange": false
  }
}
```
- **Error Responses**:
  - `401 Unauthorized`: No active session or session expired.

---

#### 3.1.4. `POST /api/auth/change-password`
Enforces voluntary or mandatory first-login password updates.

- **Access**: Authenticated (`REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`)
- **Request Body**:
```json
{
  "currentPassword": "InitialPass123!",
  "newPassword": "NewSecurePassword456!",
  "confirmPassword": "NewSecurePassword456!"
}
```
- **Validation Rules**:
  - `currentPassword`: Must match current hashed password.
  - `newPassword`: Must satisfy complexity standards (>=8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character).
  - `confirmPassword`: Must match `newPassword`.
- **Success Response (`200 OK`)**:
```json
{
  "message": "Password updated successfully",
  "user": {
    "id": "cuid_user_1",
    "name": "Jennifer Anderson",
    "email": "jennifer.anderson@toktickit.com",
    "role": "REQUESTER",
    "requiresPasswordChange": false
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: Validation failure (complexity not met or passwords do not match).
  - `401 Unauthorized`: Current password incorrect.

---

### 3.2. IT Staff Ticket Queue & Operations

---

#### 3.2.1. `GET /api/staff/tickets`
Retrieves a paginated list of all tickets across the system with filtering and search.

- **Access**: Permitted for `IT_STAFF` and `ADMINISTRATOR`
- **Query Parameters**:
  - `search` (string, optional): Searches case-insensitively within `ticketNumber` and `summary`.
  - `categoryId` (string, optional): Filters by category CUID.
  - `status` (string, optional): One of `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`.
  - `requestedPriority` (string, optional): `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
  - `itPriority` (string, optional): `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
  - `ownerId` (string, optional): Filter by assigned staff ID, or `"unassigned"` for unassigned tickets.
  - `sortBy` (string, default: `createdAt`): `createdAt`, `updatedAt`, `ticketNumber`, `itPriority`.
  - `sortOrder` (string, default: `desc`): `asc` or `desc`.
  - `page` (integer, default: 1): Page number.
  - `pageSize` (integer, default: 10, max: 50): Page size.
- **Success Response (`200 OK`)**:
```json
{
  "data": [
    {
      "id": "cuid_tkt_1",
      "ticketNumber": "TKT-2025-001234",
      "summary": "Laptop battery drains quickly",
      "requestedPriority": "MEDIUM",
      "itPriority": "MEDIUM",
      "currentStatus": "IN_PROGRESS",
      "createdAt": "2026-05-12T09:14:00.000Z",
      "updatedAt": "2026-05-12T10:30:00.000Z",
      "category": { "id": "cat_1", "name": "Hardware" },
      "relatedSystem": { "id": "sys_1", "name": "Corporate Laptop" },
      "requester": {
        "id": "cuid_user_1",
        "name": "Jennifer Anderson",
        "email": "jennifer.anderson@toktickit.com"
      },
      "owner": {
        "id": "cuid_staff_1",
        "name": "Michael Brown",
        "email": "michael.brown@toktickit.com"
      },
      "activeAttachmentsCount": 2,
      "publicCommentsCount": 3,
      "internalNotesCount": 2
    }
  ],
  "pagination": {
    "totalCount": 87,
    "page": 1,
    "pageSize": 10,
    "totalPages": 9,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```
- **Error Responses**:
  - `401 Unauthorized`: Not logged in.
  - `403 Forbidden`: User is `REQUESTER` or `requiresPasswordChange` is true.

---

#### 3.2.2. `GET /api/staff/tickets/:id`
Retrieves complete operational details of a single ticket for IT Staff investigation.

- **Access**: Permitted for `IT_STAFF` and `ADMINISTRATOR`
- **Success Response (`200 OK`)**:
```json
{
  "id": "cuid_tkt_1",
  "ticketNumber": "TKT-2025-001234",
  "summary": "Laptop battery drains quickly",
  "description": "My laptop battery is draining much faster than usual even when the system is idle. This started happening after last week's Windows update.",
  "requestedPriority": "MEDIUM",
  "itPriority": "MEDIUM",
  "currentStatus": "IN_PROGRESS",
  "resolutionSummary": null,
  "createdAt": "2026-05-12T09:14:00.000Z",
  "updatedAt": "2026-05-12T10:30:00.000Z",
  "requester": {
    "id": "cuid_user_1",
    "name": "Jennifer Anderson",
    "email": "jennifer.anderson@toktickit.com",
    "department": "Marketing"
  },
  "owner": {
    "id": "cuid_staff_1",
    "name": "Michael Brown",
    "email": "michael.brown@toktickit.com"
  },
  "category": { "id": "cat_1", "name": "Hardware" },
  "relatedSystem": { "id": "sys_1", "name": "Corporate Laptop" },
  "attachments": [
    {
      "id": "att_1",
      "fileName": "battery_diagnostic.png",
      "originalName": "battery_diagnostic.png",
      "sizeBytes": 245000,
      "mimeType": "image/png",
      "isRemoved": false,
      "removedAt": null,
      "removalReason": null,
      "createdAt": "2026-05-12T09:14:00.000Z"
    }
  ]
}
```
- **Error Responses**:
  - `401 Unauthorized`: Not authenticated.
  - `403 Forbidden`: Non-staff user.
  - `404 Not Found`: Ticket does not exist.

---

#### 3.2.3. `PATCH /api/staff/tickets/:id/claim`
Claims an unassigned or active ticket, assigning the authenticated user as `ownerId`.

- **Access**: Permitted for `IT_STAFF` and `ADMINISTRATOR`
- **Request Body**: None (assigns `session.userId`).
- **Success Response (`200 OK`)**:
```json
{
  "id": "cuid_tkt_1",
  "ownerId": "cuid_staff_1",
  "currentStatus": "OPEN",
  "updatedAt": "2026-05-12T10:35:00.000Z",
  "owner": {
    "id": "cuid_staff_1",
    "name": "Michael Brown",
    "email": "michael.brown@toktickit.com"
  }
}
```
- **Error Responses**:
  - `403 Forbidden`: Non-staff role.
  - `404 Not Found`: Ticket does not exist.

---

#### 3.2.4. `PATCH /api/staff/tickets/:id/assign`
Assigns or reassigns a ticket to a specific active IT Staff member (or unassigns by passing `null`).

- **Access**: Permitted for `IT_STAFF` and `ADMINISTRATOR`
- **Request Body**:
```json
{
  "ownerId": "cuid_staff_2"
}
```
- **Validation Rules**:
  - `ownerId`: Must be a valid CUID for an active user with role `IT_STAFF` or `ADMINISTRATOR`, or `null` to unassign.
- **Success Response (`200 OK`)**:
```json
{
  "id": "cuid_tkt_1",
  "ownerId": "cuid_staff_2",
  "owner": {
    "id": "cuid_staff_2",
    "name": "Lisa Martinez",
    "email": "lisa.martinez@toktickit.com"
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: Target user is inactive or not an IT Staff / Administrator.
  - `404 Not Found`: Ticket not found.

---

#### 3.2.5. `PATCH /api/staff/tickets/:id/priority`
Updates the ticket's `itPriority` independently of `requestedPriority`.

- **Access**: Permitted for `IT_STAFF` and `ADMINISTRATOR`
- **Request Body**:
```json
{
  "itPriority": "HIGH"
}
```
- **Validation Rules**:
  - `itPriority`: Required, one of `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
- **Success Response (`200 OK`)**:
```json
{
  "id": "cuid_tkt_1",
  "requestedPriority": "MEDIUM",
  "itPriority": "HIGH",
  "updatedAt": "2026-05-12T10:40:00.000Z"
}
```
- **Error Responses**:
  - `400 Bad Request`: Invalid priority value.

---

#### 3.2.6. `PATCH /api/staff/tickets/:id/status`
Advances ticket status according to the status transition lifecycle matrix.

- **Access**: Permitted for `IT_STAFF` and `ADMINISTRATOR`
- **Request Body**:
```json
{
  "currentStatus": "RESOLVED",
  "resolutionSummary": "Replaced faulty battery cell and updated power management driver to v2.1."
}
```
- **Validation Rules**:
  - `currentStatus`: Must follow the permitted transition matrix (**BR-15**).
  - `resolutionSummary`: Required if status is `RESOLVED` or `CLOSED` (minimum 5 chars, maximum 1,000 chars).
- **Success Response (`200 OK`)**:
```json
{
  "id": "cuid_tkt_1",
  "currentStatus": "RESOLVED",
  "resolutionSummary": "Replaced faulty battery cell and updated power management driver to v2.1.",
  "updatedAt": "2026-05-12T11:00:00.000Z"
}
```
- **Error Responses**:
  - `400 Bad Request`: Missing `resolutionSummary` when resolving/closing.
  - `422 Unprocessable Entity`: Status transition is not permitted from current state.

---

### 3.3. Public Comments & Internal Notes

---

#### 3.3.1. `GET /api/tickets/:id/comments`
Retrieves public comments for a ticket.

- **Access**: Permitted for ticket owner (`REQUESTER`), `IT_STAFF`, and `ADMINISTRATOR`.
- **Success Response (`200 OK`)**:
```json
[
  {
    "id": "cuid_cmt_1",
    "content": "We are investigating the issue on your device. We'll update you shortly.",
    "createdAt": "2026-05-13T10:30:00.000Z",
    "author": {
      "id": "cuid_staff_1",
      "name": "Michael Brown",
      "role": "IT_STAFF"
    }
  },
  {
    "id": "cuid_cmt_2",
    "content": "Thank you for the update. Please let me know if you need any additional information.",
    "createdAt": "2026-05-13T11:45:00.000Z",
    "author": {
      "id": "cuid_user_1",
      "name": "Jennifer Anderson",
      "role": "REQUESTER"
    }
  }
]
```
- **Error Responses**:
  - `403 Forbidden`: Requester does not own the ticket.
  - `404 Not Found`: Ticket not found.

---

#### 3.3.2. `POST /api/tickets/:id/comments`
Posts a new public comment authored by the authenticated user.

- **Access**: Permitted for ticket owner (`REQUESTER`), `IT_STAFF`, and `ADMINISTRATOR`.
- **Request Body**:
```json
{
  "content": "The battery issue appears after 30 minutes of running Zoom."
}
```
- **Validation Rules**:
  - `content`: Required string, trimmed, 1 to 2,000 characters. Blank submissions rejected.
- **Success Response (`201 Created`)**:
```json
{
  "id": "cuid_cmt_3",
  "ticketId": "cuid_tkt_1",
  "content": "The battery issue appears after 30 minutes of running Zoom.",
  "createdAt": "2026-05-13T12:00:00.000Z",
  "author": {
    "id": "cuid_user_1",
    "name": "Jennifer Anderson",
    "role": "REQUESTER"
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: Empty or whitespace-only comment.
  - `403 Forbidden`: Requester does not own the ticket.

---

#### 3.3.3. `GET /api/tickets/:id/notes`
Retrieves confidential internal notes for operational IT use.

- **Access**: Restricted to `IT_STAFF` and `ADMINISTRATOR`. **Forbidden for `REQUESTER`**.
- **Success Response (`200 OK`)**:
```json
[
  {
    "id": "cuid_note_1",
    "content": "Diagnostic tool indicates battery degradation at 45%. Hardware replacement authorized under warranty.",
    "createdAt": "2026-05-13T10:15:00.000Z",
    "author": {
      "id": "cuid_staff_1",
      "name": "Michael Brown",
      "role": "IT_STAFF"
    }
  }
]
```
- **Error Responses**:
  - `403 Forbidden`: Authenticated user is `REQUESTER` (strictly denied without revealing notes).
  - `404 Not Found`: Ticket not found.

---

#### 3.3.4. `POST /api/tickets/:id/notes`
Creates a confidential internal note.

- **Access**: Restricted to `IT_STAFF` and `ADMINISTRATOR`. **Forbidden for `REQUESTER`**.
- **Request Body**:
```json
{
  "content": "Ordered replacement battery part #BAT-9921. Delivery expected tomorrow morning."
}
```
- **Validation Rules**:
  - `content`: Required string, trimmed, 1 to 2,000 characters.
- **Success Response (`201 Created`)**:
```json
{
  "id": "cuid_note_2",
  "ticketId": "cuid_tkt_1",
  "content": "Ordered replacement battery part #BAT-9921. Delivery expected tomorrow morning.",
  "createdAt": "2026-05-13T10:45:00.000Z",
  "author": {
    "id": "cuid_staff_1",
    "name": "Michael Brown",
    "role": "IT_STAFF"
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: Empty or invalid content.
  - `403 Forbidden`: Non-staff user.

---

### 3.4. Requester APIs & Workflow Continuation

---

#### 3.4.1. `GET /api/tickets`
Retrieves tickets owned strictly by the authenticated Requester.

- **Access**: Permitted for `REQUESTER` (returns owned tickets).
- **Query Parameters**: Same search, filtering, and pagination parameters as Lab 2 (`search`, `categoryId`, `requestedPriority`, `currentStatus`, `page`, `pageSize`, `sortBy`, `sortOrder`).
- **Success Response (`200 OK`)**: Paginated tickets envelope.
- **Security Note**: Ownership is enforced via `session.userId`. Any client-supplied `requesterId` parameter is ignored.

---

#### 3.4.2. `POST /api/tickets`
Creates a new ticket owned by the authenticated user.

- **Access**: Permitted for `REQUESTER` and `IT_STAFF`.
- **Request**: `multipart/form-data` with fields: `categoryId`, `relatedSystemId`, `requestedPriority`, `summary`, `description`, and optional `attachments`.
- **Ownership**: Server automatically assigns `requesterId = session.userId`. Client-supplied IDs are ignored.
- **Success Response (`201 Created`)**: Newly created ticket object with auto-generated ticket number `TKT-2026-XXXXXX` and status `NEW`.

---

#### 3.4.3. `POST /api/tickets/:id/resolve-indication`
Enables a Requester to indicate that their reported issue appears resolved.

- **Access**: Permitted only for ticket owner (`REQUESTER`).
- **Request Body**: None or `{ "note": "Issue is now resolved on my end." }`.
- **Behavior**: Verifies Requester ownership, verifies ticket is active (`OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`), creates an automated Public Comment from the Requester stating `"Requester indicated that the problem appears resolved."`, and alerts IT Staff. Does NOT change status to `RESOLVED` or `CLOSED` (**BR-05**).
- **Success Response (`200 OK`)**:
```json
{
  "message": "Resolution indication recorded successfully",
  "ticketId": "cuid_tkt_1"
}
```
- **Error Responses**:
  - `403 Forbidden`: Non-owner Requester.
  - `422 Unprocessable Entity`: Ticket is already `RESOLVED` or `CLOSED`.

---

#### 3.4.4. Attachment Operations (`POST`, `GET`, `DELETE`)
- `POST /api/tickets/:id/attachments`: Upload attachment (max 5 active per ticket, max 5 MB).
- `GET /api/attachments/:id/download`: Download active attachment (403 if soft-removed or non-owner).
- `DELETE /api/attachments/:id`: Soft-remove attachment with mandatory `removalReason`.

---

### 3.5. Administrator User Management APIs

---

#### 3.5.1. `GET /api/admin/users`
Retrieves the user directory for administrator management.

- **Access**: Restricted to `ADMINISTRATOR`.
- **Query Parameters**:
  - `search` (string, optional): Case-insensitive search matching `name` or `email`.
  - `role` (string, optional): Filter by `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`.
- **Success Response (`200 OK`)**:
```json
[
  {
    "id": "cuid_user_1",
    "name": "Jennifer Anderson",
    "email": "jennifer.anderson@toktickit.com",
    "role": "REQUESTER",
    "department": "Marketing",
    "isActive": true,
    "requiresPasswordChange": false,
    "createdAt": "2026-05-01T08:00:00.000Z"
  },
  {
    "id": "cuid_staff_1",
    "name": "Michael Brown",
    "email": "michael.brown@toktickit.com",
    "role": "IT_STAFF",
    "department": "IT Support",
    "isActive": true,
    "requiresPasswordChange": false,
    "createdAt": "2026-05-01T08:00:00.000Z"
  }
]
```
- **Error Responses**:
  - `401 Unauthorized`: Not authenticated.
  - `403 Forbidden`: Non-Administrator.

---

#### 3.5.2. `POST /api/admin/users`
Creates a new user account with one permitted role and an initial password.

- **Access**: Restricted to `ADMINISTRATOR`.
- **Request Body**:
```json
{
  "name": "Alex Thompson",
  "email": "alex.thompson@toktickit.com",
  "role": "IT_STAFF",
  "department": "Infrastructure",
  "isActive": true,
  "initialPassword": "InitialPass123!"
}
```
- **Validation Rules**:
  - `name`: Required string (2 to 100 characters).
  - `email`: Required valid email address; must be globally unique.
  - `role`: Required, one of `REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`.
  - `isActive`: Boolean, defaults to `true`.
  - `initialPassword`: Required (or generated), satisfies complexity criteria.
  - Automatically flags account with `requiresPasswordChange = true`.
- **Success Response (`201 Created`)**:
```json
{
  "id": "cuid_user_new",
  "name": "Alex Thompson",
  "email": "alex.thompson@toktickit.com",
  "role": "IT_STAFF",
  "department": "Infrastructure",
  "isActive": true,
  "requiresPasswordChange": true,
  "createdAt": "2026-05-14T09:00:00.000Z"
}
```
- **Error Responses**:
  - `400 Bad Request`: Validation failure.
  - `403 Forbidden`: Non-Administrator.
  - `409 Conflict`: Email address already registered.

---

#### 3.5.3. `PATCH /api/admin/users/:id`
Updates an existing user's name, email, role, or active status.

- **Access**: Restricted to `ADMINISTRATOR`.
- **Request Body**:
```json
{
  "name": "Alex Thompson",
  "email": "alex.t@toktickit.com",
  "role": "IT_STAFF",
  "isActive": false
}
```
- **Safety Enforcement**:
  - **Self-Deactivation Guard (**BR-22**)**: If `id === session.userId` and `isActive === false`, reject with `422 Unprocessable Entity` (`"Cannot deactivate your own administrator account"`).
  - **Last Administrator Guard (**BR-23**)**: If target user is an active Administrator, and no other active Administrator exists in the database, any update setting `isActive: false` or changing `role` away from `ADMINISTRATOR` must be rejected with `422 Unprocessable Entity` (`"Cannot deactivate or demote the last active Administrator"`).
  - **Email Uniqueness**: Updating email to one already owned by another user returns `409 Conflict`.
- **Success Response (`200 OK`)**:
```json
{
  "id": "cuid_user_new",
  "name": "Alex Thompson",
  "email": "alex.t@toktickit.com",
  "role": "IT_STAFF",
  "isActive": false,
  "updatedAt": "2026-05-14T09:30:00.000Z"
}
```
- **Error Responses**:
  - `400 Bad Request`: Invalid payload.
  - `403 Forbidden`: Non-Administrator.
  - `409 Conflict`: Duplicate email.
  - `422 Unprocessable Entity`: Safety rule violation (self-deactivation or last active admin).

---

#### 3.5.4. `POST /api/admin/users/:id/reset-password`
Administrative password reset setting a new initial password.

- **Access**: Restricted to `ADMINISTRATOR`.
- **Request Body**:
```json
{
  "initialPassword": "TempPassword999!"
}
```
- **Validation Rules**:
  - `initialPassword`: Required, satisfies password complexity rules.
  - Automatically updates `passwordHash` and sets `requiresPasswordChange = true`.
- **Success Response (`200 OK`)**:
```json
{
  "message": "Initial password set successfully. User will be required to change password on next login.",
  "userId": "cuid_user_new"
}
```
- **Error Responses**:
  - `400 Bad Request`: Password complexity not met.
  - `403 Forbidden`: Non-Administrator.
  - `404 Not Found`: User not found.

---

#### 3.5.5. `GET /api/staff/users`
Lookup endpoint returning all active IT Staff (and Administrators) for ticket assignment dropdowns.

- **Access**: Permitted for `IT_STAFF` and `ADMINISTRATOR`.
- **Success Response (`200 OK`)**:
```json
[
  { "id": "cuid_staff_1", "name": "Michael Brown", "email": "michael.brown@toktickit.com", "role": "IT_STAFF" },
  { "id": "cuid_staff_2", "name": "Lisa Martinez", "email": "lisa.martinez@toktickit.com", "role": "IT_STAFF" }
]
```

---

## 4. Comprehensive Authorization Matrix

| Endpoint | Method | Unauthenticated | Requester | IT Staff | Administrator |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `/api/auth/login` | POST | Allow (200) | Allow | Allow | Allow |
| `/api/auth/logout` | POST | 401 | Allow (200) | Allow (200) | Allow (200) |
| `/api/auth/me` | GET | 401 | Allow (200) | Allow (200) | Allow (200) |
| `/api/auth/change-password` | POST | 401 | Allow (200) | Allow (200) | Allow (200) |
| `/api/tickets` | GET | 401 | Allow (Owned) | Allow (Owned) | Allow (Owned) |
| `/api/tickets` | POST | 401 | Allow (201) | Allow (201) | Allow (201) |
| `/api/tickets/:id` | GET | 401 | Allow (Owned only, 403 otherwise)| Allow (200) | Allow (200) |
| `/api/tickets/:id/resolve-indication`| POST | 401 | Allow (Owned only)| 403 | 403 |
| `/api/staff/tickets` | GET | 401 | 403 Forbidden | Allow (200) | Allow (200) |
| `/api/staff/tickets/:id` | GET | 401 | 403 Forbidden | Allow (200) | Allow (200) |
| `/api/staff/tickets/:id/claim` | PATCH | 401 | 403 Forbidden | Allow (200) | Allow (200) |
| `/api/staff/tickets/:id/assign` | PATCH | 401 | 403 Forbidden | Allow (200) | Allow (200) |
| `/api/staff/tickets/:id/priority`| PATCH | 401 | 403 Forbidden | Allow (200) | Allow (200) |
| `/api/staff/tickets/:id/status` | PATCH | 401 | 403 Forbidden | Allow (200) | Allow (200) |
| `/api/tickets/:id/comments` | GET | 401 | Allow (Owned) | Allow (200) | Allow (200) |
| `/api/tickets/:id/comments` | POST | 401 | Allow (Owned) | Allow (201) | Allow (201) |
| `/api/tickets/:id/notes` | GET | 401 | **403 Forbidden** | Allow (200) | Allow (200) |
| `/api/tickets/:id/notes` | POST | 401 | **403 Forbidden** | Allow (201) | Allow (201) |
| `/api/admin/users` | GET | 401 | 403 Forbidden | 403 Forbidden | Allow (200) |
| `/api/admin/users` | POST | 401 | 403 Forbidden | 403 Forbidden | Allow (201) |
| `/api/admin/users/:id` | PATCH | 401 | 403 Forbidden | 403 Forbidden | Allow (200) |
| `/api/admin/users/:id/reset-password`| POST | 401 | 403 Forbidden | 403 Forbidden | Allow (200) |
| `/api/staff/users` | GET | 401 | 403 Forbidden | Allow (200) | Allow (200) |
| `/api/categories` | GET | 401 | Allow (200) | Allow (200) | Allow (200) |
| `/api/related-systems` | GET | 401 | Allow (200) | Allow (200) | Allow (200) |
| `/api/attachments/:id/download` | GET | 401 | Allow (Owned) | Allow (200) | Allow (200) |
| `/api/attachments/:id` | DELETE | 401 | Allow (Owned) | Allow (200) | Allow (200) |
