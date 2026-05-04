# Data Model: Secure Authentication & Session Management

**Feature**: Secure Authentication & Session Management  
**Date**: 2026-04-28

---

## Entity: Admin Account

Represents an authorized administrator who can access the logistics dashboard.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Unique identifier |
| `username` | VARCHAR(64) | UNIQUE, NOT NULL | Administrative login name |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt-hashed password |
| `display_name` | VARCHAR(128) | NULL | Human-readable name |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Account status |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Account creation time |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last update time |

### Validation Rules

- `username`: Must be 3–64 characters, alphanumeric with underscores and hyphens allowed.
- `password_hash`: Never expose in API responses; write-only field.
- `is_active`: Inactive accounts cannot authenticate even with valid credentials.

### State Transitions

```
[Created] --(set is_active=false)--> [Deactivated]
[Deactivated] --(set is_active=true)--> [Active]
```

---

## Entity: Session

Represents an authenticated work period for a specific administrator.

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Unique identifier |
| `session_token` | VARCHAR(255) | UNIQUE, NOT NULL | Signed token identifier (opaque) |
| `admin_id` | INT | NOT NULL, FK → admin_accounts(id), ON DELETE CASCADE | Associated administrator |
| `ip_address` | VARCHAR(45) | NULL | Client IP at creation (IPv6 compatible) |
| `user_agent` | VARCHAR(255) | NULL | Client user agent snapshot |
| `expires_at` | TIMESTAMP | NOT NULL | Absolute session expiry |
| `last_activity_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last verified access |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Session creation time |

### Validation Rules

- `session_token`: Must be unique and non-empty. Format is a JWS compact serialization string.
- `expires_at`: Must be in the future at creation time.
- `last_activity_at`: Updated on every protected request validation (sliding window behavior).

### State Transitions

```
[Created] --(expires_at reached)--> [Expired]
[Created] --(logout or admin deactivated)--> [Revoked]
```

Expired/revoked rows may be cleaned up by a background job (v2 enhancement).

---

## Entity: Audit Log Entry (system_logs)

Every authentication decision MUST be recorded for accountability (Constitution Principle V).

### Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INT | PK, AUTO_INCREMENT | Unique identifier |
| `event_type` | VARCHAR(64) | NOT NULL | e.g., `login_success`, `login_failure`, `logout`, `session_expired` |
| `admin_id` | INT | NULL, FK → admin_accounts(id) | Related admin (NULL if unknown user) |
| `session_token` | VARCHAR(255) | NULL | Related session token (if applicable) |
| `ip_address` | VARCHAR(45) | NULL | Client IP at event time |
| `user_agent` | VARCHAR(255) | NULL | Client user agent at event time |
| `details` | JSON | NULL | Additional structured context (e.g., failure reason) |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Event time |

---

## Relationships

```
AdminAccount ||--o{ Session : "has many"
AdminAccount ||--o{ SystemLog : "generates"
Session ||--o{ SystemLog : "referenced by"
```

- One `AdminAccount` can have zero or more `Session` records.
- One `AdminAccount` can generate many `SystemLog` entries.
- One `Session` can be referenced by multiple `SystemLog` entries (e.g., login then logout).

---

## MySQL Schema (DDL)

```sql
CREATE TABLE IF NOT EXISTS admin_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(128),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    admin_id INT NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admin_accounts(id) ON DELETE CASCADE,
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS system_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    admin_id INT,
    session_token VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    details JSON,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admin_accounts(id) ON DELETE SET NULL,
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```
