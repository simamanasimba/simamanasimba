# Security

## Authentication

- Passwords hashed with bcrypt (12 rounds) — `packages/security`.
- Sessions are opaque random tokens (32 bytes, base64url), SHA-256 hashed
  before storage in the `sessions` table, delivered via an httpOnly,
  `sameSite=lax` cookie. Never stored or logged in plaintext.
- Email verification and password reset also use opaque hashed tokens with
  expiry (`email_verification_tokens`, `password_reset_tokens`).
- Logging out revokes the session row server-side (`revoked_at`) — not just a
  cookie clear — and password reset revokes *all* of a user's sessions.

## RBAC

Roles: `PLATFORM_OWNER` (bypasses org-membership checks entirely — support/
ops use only), `ORG_SUPER_ADMIN`, `ORG_ADMIN`, `EVENT_MANAGER`,
`ATTENDANCE_OFFICER`, `MEMBERSHIP_OFFICER`, `DIGITAL_INTELLIGENCE_ANALYST`,
`REPORT_VIEWER`, `STANDARD_USER`. Enforced via `@Roles(...)` +
`RolesGuard` on top of `OrgMembershipGuard`.

## Tenant isolation

See `docs/ARCHITECTURE.md#tenant-isolation`. The isolation contract:
`OrgMembershipGuard` resolves `req.orgMember` from the `:organizationId` route
param and the caller's `organization_members` row; every service method must
scope its Prisma queries by that value. **Required test before shipping**:
create two organizations, attempt to fetch org A's member/event/attendance
data using org B's session — must 403/404, never 200 with data.

## Public attendance API

`/api/v1/public/attendance/*` has no session requirement (it's reached by
scanning a QR code as an anonymous device) but is gated by a per-event opaque
`AttendanceToken` (hashed at rest, revocable, regenerable). It exposes:
member lookup by exact membership number (one at a time), check-in, walk-in
registration, and offline batch sync — never a list/browse of the member
database.

## Secrets

- Never logged: passwords, session tokens, access/refresh tokens, encryption
  keys, cookies, `Authorization` headers — see the `redact` config in
  `packages/logger`.
- Social OAuth tokens (`social_accounts.access_token_enc`) are stored as an
  `_enc` suffixed column, signaling they must be encrypted at rest before
  that feature is built out (`ENCRYPTION_KEY` is reserved for this).
- `.env` is gitignored; `.env.example` only ever contains placeholders.

## Rate limiting

Global `ThrottlerModule` (300 req/min/IP) via `@nestjs/throttler`, applied as
an `APP_GUARD` ahead of session auth. QR/attendance-token validation inherits
this; tighten per-route limits before production if attendance kiosks share a
NAT'd IP with many concurrent devices.

## What's not yet done

- MFA: not implemented; the `users` table and session model don't block
  adding a TOTP step later.
- CSRF: cookies are `sameSite=lax` (mitigates most cross-site POST forgery)
  but there's no explicit CSRF token yet — add one before exposing
  state-changing admin endpoints to a wider set of embedding contexts.
- Automated tenant-isolation and RBAC test suites (spec section 72) have not
  been written yet — see `docs/IMPLEMENTATION_STATUS.md`.
