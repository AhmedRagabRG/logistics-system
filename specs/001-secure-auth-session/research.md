# Research: Secure Authentication & Session Management

**Feature**: Secure Authentication & Session Management  
**Date**: 2026-04-28  
**Purpose**: Resolve technical unknowns and select best-fit patterns for the logistics dashboard auth system.

---

## Decision 1: Session Transport Mechanism

**Decision**: Use HTTP-only, Secure, SameSite=Strict cookies for session transport.

**Rationale**:
- HTTP-only cookies are not accessible via JavaScript, eliminating XSS-based token theft.
- `Secure` flag ensures cookies are only sent over HTTPS in production.
- `SameSite=Strict` prevents CSRF attacks from cross-site requests.
- Aligns with Constitution Principle III (API Integrity) by enforcing secure auth_token patterns.

**Alternatives considered**:
- **localStorage JWT**: Rejected — vulnerable to XSS, requires manual header injection on every request.
- **Bearer token in Authorization header**: Rejected — same XSS risk if stored in JavaScript-accessible storage.

---

## Decision 2: Session Storage Backend

**Decision**: Store session records in MySQL alongside application data.

**Rationale**:
- Constitution Principle I mandates "All operational data MUST reside in the MySQL database."
- Enables server-side session revocation (logout invalidates the DB record immediately).
- Simplifies audit logging — session lifecycle events are queryable alongside business data.
- No additional infrastructure (Redis, etc.) required.

**Alternatives considered**:
- **Redis**: Rejected — adds external dependency; Constitution requires MySQL as single source of truth.
- **JWT stateless sessions**: Rejected — cannot revoke instantly without a deny-list (which itself needs a store).

---

## Decision 3: Password Hashing Algorithm

**Decision**: Use `bcryptjs` (pure JavaScript implementation of bcrypt).

**Rationale**:
- Industry-standard adaptive hashing function.
- No native C++ bindings, so it works across all platforms (local dev, Docker, Vercel Edge if needed).
- Configurable cost factor (default 10 rounds, ~100ms hash time acceptable for login frequency).

**Alternatives considered**:
- **argon2**: Rejected — requires native bindings, more complex build setup.
- **scrypt**: Rejected — less common in Node.js ecosystem, harder to tune parameters safely.

---

## Decision 4: Session Token Format

**Decision**: Use `jose` library to create and verify signed compact JWT-like tokens stored in the cookie.

**Rationale**:
- `jose` is lightweight, Edge-compatible, and actively maintained.
- Token contains only session ID (no sensitive data), signed with a server secret.
- Verification is fast (< 10ms) and requires no DB lookup for signature validation.
- The actual session state (expiry, user data) is validated against the MySQL `sessions` table on
  every protected request.

**Alternatives considered**:
- **crypto.randomBytes + raw lookup**: Rejected — no built-in expiry or tamper detection in the token itself.
- **jsonwebtoken**: Rejected — not Edge-compatible (uses Node.js crypto module directly).

---

## Decision 5: Route Protection Strategy

**Decision**: Use Next.js 16 App Router `middleware.ts` for session validation on protected routes.

**Rationale**:
- Middleware runs on every request before reaching the page, enabling uniform protection.
- Can read HTTP-only cookies and verify session tokens before rendering.
- Unauthenticated users are redirected to `/login` at the edge.
- Server Components in the `(dashboard)` layout can also re-validate the session for defense in depth.

**Alternatives considered**:
- **getServerSideProps (Pages Router)**: Rejected — project uses App Router.
- **Client-side route guards only**: Rejected — bypassable by disabling JavaScript; server must enforce.

---

## Decision 6: Database Access Layer

**Decision**: Use `mysql2` with a connection pool for MySQL access.

**Rationale**:
- `mysql2` is the standard MySQL driver for Node.js, supports prepared statements (prevents SQL injection).
- Connection pool reuses connections for better performance under concurrent requests.
- Promise-based API works cleanly with async/await in Next.js Server Components and API routes.

**Alternatives considered**:
- **Prisma**: Could be used but adds schema migration overhead; `mysql2` is sufficient for focused auth tables.
- **Drizzle**: Similar to Prisma; `mysql2` direct access is simpler for two tables.

**Note**: If the project later adopts Prisma/Drizzle for the broader logistics schema, the auth tables
should be migrated into that ORM's schema for consistency.

---

## Decision 7: Session Timeout & Renewal

**Decision**: 30-minute absolute session expiry with a sliding 5-minute grace window on activity.

**Rationale**:
- Spec assumption states 30 minutes is acceptable.
- Sliding window reduces friction for active users while maintaining security.
- Expired sessions are cleaned up via a lightweight cron or background query (out of scope for v1).

---

## Resolved Unknowns

| Unknown | Resolution |
|---------|------------|
| How to store sessions securely? | MySQL table + signed HTTP-only cookie |
| How to hash passwords? | `bcryptjs` with cost factor 10 |
| How to validate sessions on each request? | `middleware.ts` reads cookie, verifies signature with `jose`, checks DB record |
| How to handle logout across tabs? | Server-side session deletion invalidates the DB record; all tabs share the same cookie |
| How to prevent concurrent session abuse? | Optional: limit to N active sessions per admin (v2 enhancement) |
