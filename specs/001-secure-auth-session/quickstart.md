# Quickstart: Secure Authentication & Session Management

**Feature**: Secure Authentication & Session Management  
**Date**: 2026-04-28

---

## Prerequisites

- Node.js 20+ installed
- MySQL 8.0+ server running locally or accessible via network
- `DATABASE_URL` environment variable configured (see below)

---

## Environment Setup

Create a `.env.local` file in the project root (`my-app/.env.local`):

```env
# Database
DATABASE_URL=mysql://user:password@localhost:3306/logistics_dashboard

# Session Signing (generate with: openssl rand -base64 32)
SESSION_SECRET=your-256-bit-secret-key-here

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Generate a session secret**:

```bash
openssl rand -base64 32
```

---

## Database Setup

1. Connect to MySQL and create the database:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS logistics_dashboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

2. Run the schema migration from `data-model.md`:

```bash
mysql -u root -p logistics_dashboard < specs/001-secure-auth-session/contracts/schema.sql
```

Or copy the DDL from [data-model.md](./data-model.md) and execute it directly.

3. **Seed an admin account** (for testing):

```bash
# Generate a bcrypt hash (use Node.js REPL)
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('admin123', 10));"

# Insert into MySQL
mysql -u root -p logistics_dashboard -e "
INSERT INTO admin_accounts (username, password_hash, display_name)
VALUES ('admin', '\$2a\$10\$...hash...', 'Test Administrator');
"
```

---

## Install Dependencies

From the project root (`my-app/`):

```bash
npm install mysql2 bcryptjs jose zod
npm install -D @types/bcryptjs
```

---

## Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

---

## Testing the Authentication Flow

### 1. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  -c cookies.txt -v
```

Expected: `200 OK` with `Set-Cookie: session=...` header.

### 2. Access Protected Route

```bash
curl http://localhost:3000/dashboard \
  -b cookies.txt -v
```

Expected: `200 OK` with dashboard HTML.

### 3. Logout

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt -c cookies.txt -v
```

Expected: `200 OK` with cookie cleared (`Max-Age=0`).

### 4. Verify Protection

```bash
curl http://localhost:3000/dashboard -v
```

Expected: `302 Redirect` to `/login`.

---

## Running Tests

### Integration Tests

```bash
npm run test:integration
```

Tests cover:
- Successful login with valid credentials
- Rejection of invalid credentials
- Session persistence across requests
- Protected route redirection
- Logout invalidation

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ECONNREFUSED` on database | Verify MySQL is running and `DATABASE_URL` is correct |
| `Session verification failed` | Check `SESSION_SECRET` is set and 32+ bytes |
| `Cookie not sent` | Ensure API and frontend share the same domain/localhost |
| `Middleware not running` | Confirm `middleware.ts` is in the project root (`my-app/middleware.ts`) |

---

## Next Steps

1. Implement the login page UI at `app/(auth)/login/page.tsx`
2. Implement the dashboard layout with session check at `app/(dashboard)/layout.tsx`
3. Add the logout button component
4. Run the integration test suite and verify all scenarios pass
5. Proceed to `/speckit.tasks` to generate implementation tasks
