# Authentication API Contract

**Feature**: Secure Authentication & Session Management  
**Version**: 1.0.0  
**Date**: 2026-04-28

---

## Overview

The Authentication API provides endpoints for administrative login, logout, and session validation.
All endpoints accept and return JSON. Errors follow a consistent structure.

**Base Path**: `/api/auth`

---

## Endpoints

### POST /api/auth/login

Authenticate an administrator and establish a session.

#### Request

**Headers**:
- `Content-Type: application/json`

**Body**:

```json
{
  "username": "string (required, 3-64 chars)",
  "password": "string (required, min 8 chars)"
}
```

#### Response

**200 OK — Success**

```json
{
  "success": true,
  "data": {
    "admin": {
      "id": 1,
      "username": "admin",
      "display_name": "Administrator"
    }
  }
}
```

**Set-Cookie header**: `session=eyJhbG...; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=1800`

**400 Bad Request — Validation Error**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      { "field": "username", "message": "Username must be at least 3 characters" }
    ]
  }
}
```

**401 Unauthorized — Invalid Credentials**

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid username or password"
  }
}
```

**403 Forbidden — Account Inactive**

```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_INACTIVE",
    "message": "Account is deactivated"
  }
}
```

---

### POST /api/auth/logout

Terminate the current session.

#### Request

**Headers**:
- `Cookie: session=<token>`

**Body**: None

#### Response

**200 OK — Success**

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

**Set-Cookie header**: `session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0` (clears cookie)

**401 Unauthorized — No Session**

```json
{
  "success": false,
  "error": {
    "code": "NO_SESSION",
    "message": "No active session"
  }
}
```

---

### GET /api/session/validate

Validate the current session and return the authenticated admin.

#### Request

**Headers**:
- `Cookie: session=<token>`

#### Response

**200 OK — Valid Session**

```json
{
  "success": true,
  "data": {
    "admin": {
      "id": 1,
      "username": "admin",
      "display_name": "Administrator"
    },
    "session": {
      "expires_at": "2026-04-28T16:00:00Z"
    }
  }
}
```

**401 Unauthorized — Invalid or Expired Session**

```json
{
  "success": false,
  "error": {
    "code": "SESSION_INVALID",
    "message": "Session is invalid or expired"
  }
}
```

---

## Error Response Format

All error responses follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "UPPER_SNAKE_CASE_ERROR_CODE",
    "message": "Human-readable description",
    "details?": [ ...optional field-level errors... ]
  }
}
```

**Standard Error Codes**:

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `VALIDATION_ERROR` | 400 | Request body failed validation |
| `INVALID_CREDENTIALS` | 401 | Username or password incorrect |
| `ACCOUNT_INACTIVE` | 403 | Account exists but is deactivated |
| `NO_SESSION` | 401 | No session cookie present |
| `SESSION_INVALID` | 401 | Session token invalid or expired |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Authentication Flow

```
┌─────────┐                    ┌──────────────┐                    ┌──────────┐
│  Client │ ──POST /login────> │  Next.js API │ ──validate──────>  │  MySQL   │
│         │                    │   Route      │    credentials     │          │
│         │ <─Set-Cookie────── │              │ <─account data──── │          │
│         │                    │              │ ──create session─> │          │
│         │                    │              │ <─session record── │          │
│         │                    │              │                    │          │
│         │ ──GET /protected─> │  Middleware  │ ──read cookie────> │          │
│         │                    │              │ ──verify token─────│          │
│         │ <─redirect/login── │              │ <─session data──── │          │
│         │   or render page   │              │                    │          │
│         │                    │              │                    │          │
│         │ ──POST /logout───> │  Next.js API │ ──delete session─> │          │
│         │ <─Clear-Cookie──── │              │                    │          │
└─────────┘                    └──────────────┘                    └──────────┘
```

---

## Security Requirements

1. **Cookie attributes**: All session cookies MUST be `HttpOnly`, `Secure` (in production), `SameSite=Strict`, and `Path=/`.
2. **Password handling**: Raw passwords MUST NOT be logged or stored. Only bcrypt hashes are persisted.
3. **Timing attacks**: Login endpoint MUST take similar time for valid and invalid usernames to prevent user enumeration.
4. **Rate limiting**: Login endpoint SHOULD be rate-limited to 5 attempts per IP per minute (v2 enhancement).
5. **Session fixation**: New session token MUST be issued on successful login (prevent fixation attacks).
