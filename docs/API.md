# EduFlow REST API v1

Base URL: `https://<app>/api/v1` · Spec: `/api/v1/openapi.json`

## Authentication

Every request needs an API key in the `x-api-key` header. Create keys in
**Admin → API Keys** (`/admin/api-keys`). Keys are `ef_...` strings, stored
only as SHA-256 hashes, revocable and expirable.

```bash
curl -H "x-api-key: ef_..." https://<app>/api/v1/students?pageSize=10
```

Unauthenticated → `401`; expired/revoked → `401`; rate limit (120/min/IP)
→ `429`.

## Conventions

- **Pagination**: `?page=1&pageSize=50` (pageSize ≤ 200). Responses:
  `{ "data": [...], "meta": { page, pageSize, total, totalPages } }`.
- **Sorting**: `?sort=<field>&order=asc|desc` — only whitelisted fields per
  resource (unknown fields fall back to `createdAt`).
- **Filtering**: resource-specific equality filters (see below).
- **Errors**: `{ "error": "..." }` with appropriate status codes
  (401/403/404/409/422/429/500).
- **Tenant scope**: every response is scoped to the key's school.
  Cross-tenant access is impossible by construction.

## Endpoints

### GET /school
School profile + subscription plan + limits.

### GET/POST /students
| Query | Description |
|---|---|
| `classId` | Filter by class |
| `search` | Case-insensitive match on first/last name, admission number |
| `status` | Admission status (defaults to active) |

POST creates a student (validates `studentSchema`; creates a login account).
Returns `{ student, credentials: { email, tempPassword } }`.
`403` when the plan's student limit is reached; `409` on duplicates.
Emits a `student.created` webhook event.

### GET/POST /teachers
GET filters: `search`, `departmentId`. POST creates a teacher + login
(`403` at teacher limit; `409` duplicates). Emits `teacher.created`.

### GET /classes
Classes with class-subject mappings and student counts. Filter: `category`.

### GET /results
Published/any result rows. Filters: `studentId`, `classId`, `subjectId`,
`term`, `session`, `status`. Scoped via the student's school.

### GET /fees
Fee types. Filter: `isActive=true|false`.

### GET /attendance
Attendance rows. Filters: `date` (YYYY-MM-DD), `classId`, `studentId`,
`status`. Scoped via the student's school.

## Rate limits

Per-IP 120 requests/minute (in-memory per instance — replace with a shared
store such as Upstash before horizontal scaling; see
`src/lib/rate-limit.ts`).

## Outbound webhooks

Schools register endpoints in **Admin → Webhooks** and choose events.
Delivery:

```http
POST <endpoint-url>
X-EduFlow-Event: student.created
X-EduFlow-Signature: <hex HMAC-SHA256(rawBody, endpoint secret)>
X-EduFlow-Idempotency-Key: <event log id>
Content-Type: application/json

{ "id": "...", "event": "student.created", "createdAt": "...", "data": { ... } }
```

Verify the signature with the endpoint secret before trusting the payload.
Unacknowledged deliveries (non-2xx or timeout) retry with exponential
backoff (5 attempts, max 5 min × 2^n). Acknowledge with HTTP 2xx.

Event catalog: `student.created`, `student.updated`, `teacher.created`,
`payment.received`, `result.published`, `attendance.recorded` (extend in
`src/lib/saas/events.ts`).
