# API reference

Base URL: `http://localhost:4000` in development. All authenticated routes
expect the `eip_session` cookie (set automatically by `/auth/login` and
`/auth/register-organization`) — the web app sends it via `credentials:
"include"`.

## Auth — `/api/v1/auth`
`POST /register-organization` · `POST /login` · `POST /logout` ·
`POST /verify-email` · `POST /forgot-password` · `POST /reset-password` ·
`GET /me`

## Organizations — `/api/v1/organizations/:organizationId`
`GET /` · `PATCH /` · `GET /users` · `POST /users/invite` ·
`PATCH /users/:userId` · `DELETE /users/:userId`

## Members — `/api/v1/organizations/:organizationId/members`
`GET /?q=&region=&district=&membershipType=&membershipStatus=&page=&pageSize=`
· `POST /` · `GET /:memberId` (full profile: history, registrations,
attendance) · `PATCH /:memberId`

## Events — `/api/v1/organizations/:organizationId/events`
`GET /?status=` · `POST /` · `GET /:eventId` · `PATCH /:eventId` ·
`GET /:eventId/registrations` · `POST /:eventId/registrations` ·
`POST /:eventId/qr` (generate/regenerate) · `PATCH /:eventId/qr/revoke`

## Attendance (admin) — `/api/v1/organizations/:organizationId`
`GET /events/:eventId/attendance` · `GET /events/:eventId/attendance/live` ·
`POST /events/:eventId/attendance/admin-checkin` ·
`GET|POST /attendance-devices` · `PATCH /attendance-devices/:deviceId/heartbeat`

## Attendance (public, QR-gated) — `/api/v1/public/attendance/events/:eventId`
`GET /?token=` (validate token, minimal event info) · `POST /lookup` ·
`POST /check-in` · `POST /register` (walk-in) · `POST /sync` (offline batch)

## Analytics — `/api/v1/organizations/:organizationId/analytics`
`GET /membership-growth?interval=&from=&to=` · `GET /membership-summary` ·
`GET /members/by-region` · `GET /members/by-type` ·
`GET /members/frequent?minEvents=` · `GET /members/never-attended` ·
`GET /members/inactive?months=` · `GET /events/compare?eventIds=a,b,c` ·
`GET /events/:eventId/timeseries?granularity=hour|day`

## Digital intelligence
- Monitoring — `/api/v1/organizations/:organizationId/monitoring`:
  `GET|POST /aliases`, `DELETE /aliases/:id`, `GET|POST /rules`,
  `POST /rules/:ruleId/run`
- Mentions — `/api/v1/organizations/:organizationId/mentions`: `GET /`,
  `GET /:mentionId`
- Alerts — `/api/v1/organizations/:organizationId/alerts`: `GET /?status=`,
  `PATCH /:alertId/acknowledge`, `PATCH /:alertId/resolve`
- Platform capabilities — `GET /api/v1/platform-capabilities` (public)

## Search — `GET /api/v1/organizations/:organizationId/search?q=&entityTypes=`

## Reports — `/api/v1/organizations/:organizationId/reports`
`GET /` · `POST /` (`{type, format, parameters}` — CSV is implemented today;
PDF/Excel return a clear "not yet implemented" error rather than a fake file)
· `GET /:reportId`

## Audit logs — `GET /api/v1/organizations/:organizationId/audit-logs`

## Internal (worker → API only, `x-internal-key` header, never expose to the web app)
`POST /api/v1/internal/monitoring/run-due` · `POST /api/v1/internal/social-metrics/sync`

## Health — `/health`, `/health/database`, `/health/redis`, `/health/search`, `/health/connectors`
