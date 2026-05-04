# Implementation Plan: Secure Authentication & Session Management

**Branch**: `001-secure-auth-session` | **Date**: 2026-04-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-secure-auth-session/spec.md`

## Summary

Build a session-based authentication gateway for the logistics dashboard. Administrators log in with
username and password, receive a secure HTTP-only cookie session, and can access protected routes.
Sessions are stored in MySQL and validated on every request. Logout terminates the session both
server-side and client-side.

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js 16.x (App Router), React 19.x
**Primary Dependencies**: Next.js, Tailwind CSS v4, mysql2 (MySQL driver), jose (JWT/session signing)
**Storage**: MySQL (single source of truth per Constitution I)
**Testing**: Vitest (already configured in project)
**Target Platform**: Modern web browsers (desktop primary)
**Project Type**: Web application
**Performance Goals**: Login response < 500ms p95, session validation < 50ms per request
**Constraints**: HTTP-only cookies required, no localStorage for auth tokens, session timeout 30 min
**Scale/Scope**: Single-tenant admin dashboard, < 50 concurrent admin sessions expected

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status | Notes |
|-----------|-------|--------|-------|
| I. Operational Mode Governance | Single Source of Truth | ✅ PASS | Session and admin data stored in MySQL only |
| III. Technical Standards | Next.js App Router + MySQL | ✅ PASS | Matches approved tech stack |
| III. Technical Standards | Zod validation on inputs | ✅ PASS | Login form validated with Zod before DB check |
| III. Technical Standards | Atomic transactions | ✅ PASS | Session creation is atomic with successful auth |
| V. Development Workflow | Schema First | ✅ PASS | MySQL schema defined before UI components |
| V. Development Workflow | Audit Logging | ✅ PASS | Login/logout events logged to `system_logs` |
| V. Development Workflow | Clean UI | ✅ PASS | Login page and status indicators follow color-coded design |

## Project Structure

### Documentation (this feature)

```text
specs/001-secure-auth-session/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
my-app/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Protected layout with session check
│   │   ├── page.tsx            # Dashboard home
│   │   ├── pricing/
│   │   ├── dealers/
│   │   └── settings/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   │   └── route.ts
│   │   │   └── logout/
│   │   │       └── route.ts
│   │   └── session/
│   │       └── validate/
│   │           └── route.ts
│   └── layout.tsx
├── lib/
│   ├── db.ts                   # MySQL connection pool
│   ├── session.ts              # Session creation/validation helpers
│   └── auth.ts                 # Password hashing & verification
├── components/
│   ├── auth/
│   │   ├── login-form.tsx
│   │   └── logout-button.tsx
│   └── ui/
│       └── status-badge.tsx
├── types/
│   └── auth.ts
└── tests/
    └── integration/
        └── auth.test.ts
```

**Structure Decision**: Single Next.js 16 App Router project with route groups. `(auth)` group
contains the public login page. `(dashboard)` group contains all protected routes with a shared
layout that validates the session. API routes under `app/api/` handle login, logout, and session
validation. MySQL is accessed via `mysql2` with a connection pool exported from `lib/db.ts`.

## Complexity Tracking

> No Constitution Check violations require justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

## Phase 0: Research

See [research.md](./research.md) for full details.

**Key Decisions**:
- **Session Storage**: MySQL-backed sessions (not JWT in localStorage) to enable server-side
  revocation and align with Constitution "Single Source of Truth"
- **Cookie Transport**: Signed HTTP-only cookie with `Secure` and `SameSite=Strict` flags
- **Password Hashing**: bcrypt via `bcryptjs` (pure JS, no native bindings issues)
- **Session Signing**: `jose` library for HMAC-signed session tokens (lightweight, Edge-compatible)

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md) and [contracts/](./contracts/) for full details.

**Entities**: Admin Account, Session
**Contracts**: Authentication API (login/logout/validate)

## Quickstart

See [quickstart.md](./quickstart.md) for local development setup and testing instructions.

## Post-Design Constitution Check

Re-evaluated after Phase 1 — all gates still **PASS** ✅.
