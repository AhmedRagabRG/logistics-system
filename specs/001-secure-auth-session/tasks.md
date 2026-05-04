---

description: "Task list template for feature implementation"
---

# Tasks: Secure Authentication & Session Management

**Input**: Design documents from `/specs/001-secure-auth-session/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are NOT included for this feature as they were not explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `my-app/` is the project root
- All paths shown below are relative to the repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependency installation, and environment configuration

- [x] T001 Create auth feature directory structure in my-app/ per implementation plan (app/(auth)/, app/(dashboard)/, app/api/auth/, app/api/session/, components/auth/, types/)
- [x] T002 [P] Install runtime dependencies: `npm install mysql2 bcryptjs jose zod` in my-app/
- [x] T003 [P] Install dev dependency: `npm install -D @types/bcryptjs` in my-app/
- [x] T004 Configure environment variables in my-app/.env.local (DATABASE_URL, SESSION_SECRET, NEXT_PUBLIC_APP_URL)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Apply MySQL schema for auth tables (admin_accounts, sessions, system_logs) using DDL from data-model.md
- [x] T006 [P] Create auth TypeScript types in my-app/types/auth.ts (Admin, Session, AuthResult interfaces)
- [x] T007 Create MySQL connection pool in my-app/lib/db.ts with mysql2/promise
- [x] T008 [P] Create password hashing helpers in my-app/lib/auth.ts using bcryptjs (hashPassword, verifyPassword)
- [x] T009 Create session creation/validation helpers in my-app/lib/session.ts using jose (createSessionToken, verifySessionToken, getSessionFromCookie)
- [x] T010 [P] Create audit logging helper in my-app/lib/audit.ts (logAuthEvent) for system_logs table

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Admin Secure Login (Priority: P1) 🎯 MVP

**Goal**: Administrators can log in with username and password to receive a secure session cookie

**Independent Test**: Submit valid credentials to /api/auth/login and verify Set-Cookie header is returned; submit invalid credentials and verify 401 response without cookie

### Implementation for User Story 1

- [x] T011 [P] [US1] Create login API route in my-app/app/api/auth/login/route.ts (validate with Zod, check credentials, create session, set HTTP-only cookie, log event)
- [x] T012 [P] [US1] Create login form component in my-app/components/auth/login-form.tsx (username/password inputs, error display, submit handler)
- [x] T013 [US1] Create login page in my-app/app/(auth)/login/page.tsx (renders login form with Tailwind styling)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Protected Route Access (Priority: P1) 🎯 MVP

**Goal**: Only authenticated administrators can access dashboard routes; unauthenticated users are redirected to login

**Independent Test**: Access /dashboard without a session cookie and verify redirect to /login; access with valid session cookie and verify dashboard renders

### Implementation for User Story 2

- [x] T014 [US2] Create session validation middleware in my-app/middleware.ts (read cookie, verify token with jose, check DB session, redirect unauthenticated to /login)
- [x] T015 [US2] Create protected dashboard layout in my-app/app/(dashboard)/layout.tsx (validates session server-side, renders navigation, wraps children)
- [x] T016 [P] [US2] Create dashboard home page in my-app/app/(dashboard)/page.tsx (placeholder content confirming access)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Session Persistence (Priority: P2)

**Goal**: Authenticated administrators remain logged in across page navigation and during active work periods

**Independent Test**: Log in, navigate between dashboard pages, and verify no re-authentication prompt; verify session last_activity_at is updated on protected requests

### Implementation for User Story 3

- [x] T017 [US3] Create session validation API route in my-app/app/api/session/validate/route.ts (returns admin data and session expiry for client-side checks)
- [x] T018 [US3] Update middleware in my-app/middleware.ts to refresh last_activity_at timestamp in sessions table on each protected request

**Checkpoint**: User Story 3 should now be independently functional

---

## Phase 6: User Story 4 - Secure Logout (Priority: P2)

**Goal**: Administrators can terminate their session completely, clearing auth state server-side and client-side

**Independent Test**: Click logout, verify redirect to /login, then attempt to access /dashboard and verify re-authentication is required

### Implementation for User Story 4

- [x] T019 [P] [US4] Create logout API route in my-app/app/api/auth/logout/route.ts (delete session from DB, clear cookie, log event)
- [x] T020 [P] [US4] Create logout button component in my-app/components/auth/logout-button.tsx (calls logout API, handles redirect)
- [x] T021 [US4] Integrate logout button into dashboard layout in my-app/app/(dashboard)/layout.tsx (adds logout button to navigation/header)

**Checkpoint**: All user stories should now be independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T022 [P] Create status badge component in my-app/components/ui/status-badge.tsx (color-coded auth status indicators per Constitution V)
- [x] T023 Add error handling and loading states to login form in my-app/components/auth/login-form.tsx (loading spinner, network error messages)
- [x] T024 Code cleanup and consistency review across auth modules (ensure all imports use alias paths, verify no raw passwords in logs)
- [x] T025 Run quickstart.md validation steps (execute curl commands for login, protected access, logout, and verify protection)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
  - T005 depends on T001-T004
  - T007 depends on T005
  - T006, T008, T010 can run in parallel after T005
  - T009 depends on T006, T007, T008
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
  - T014 middleware depends on T009 session helpers
  - T015 layout depends on T014 middleware
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) and after US2 middleware exists
  - T017 depends on T009
  - T018 depends on T014 (middleware already exists from US2)
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) and after US2 layout exists
  - T019 depends on T009, T010
  - T020 depends on T006
  - T021 depends on T015 (layout from US2), T019, T020

### Within Each User Story

- Models/types before services/helpers
- Services/helpers before API routes
- API routes before UI components
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, US1 and US2 can start in parallel
- US3 and US4 can start in parallel after US2 is complete
- T011 and T012 (US1) can run in parallel
- T015 and T016 (US2) can run in parallel after T014
- T019 and T020 (US4) can run in parallel
- All Polish tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch API route and form component together:
Task: "Create login API route in my-app/app/api/auth/login/route.ts"
Task: "Create login form component in my-app/components/auth/login-form.tsx"

# Then create page (depends on both):
Task: "Create login page in my-app/app/(auth)/login/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Login)
4. Complete Phase 4: User Story 2 (Protected Routes)
5. **STOP and VALIDATE**: Test login and protection independently
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Login)
   - Developer B: User Story 2 (Protected Routes)
3. Once US1 and US2 are complete:
   - Developer A: User Story 3 (Session Persistence)
   - Developer B: User Story 4 (Secure Logout)
4. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
