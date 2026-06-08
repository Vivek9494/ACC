# Cursor Prompts — Phase Index

This directory contains the phase-by-phase Cursor prompts used to build the ACC application. Paste each prompt in order into a fresh Cursor session (or continue in the same session after verifying the previous phase).

| Phase | File | Scope |
|-------|------|-------|
| 0 | `00-bootstrap-cursor-prompt.md` | Repository skeleton, tooling, local infra (this phase) |
| 1 | `01-prisma-schema.md` | Full Prisma schema, migrations, seed scripts |
| 2 | `02-auth.md` | Signup, login, OTP, single-device JWT, idle logout |
| 3 | `03-rbac.md` | NestJS guards, `@Roles()`, `@TournamentScope()`, policy service |
| 4 | `04-player-profile.md` | Profile CRUD, Center migration, deactivation |
| 5 | `05-tournament-management.md` | Tournament CRUD, lifecycle state machine, cloning |
| 6 | `06-registration.md` | Registration submit, approval queue, APL ratings |
| 7 | `07-teams-roster.md` | Team creation, role assignment, Impact Player |
| 8 | `08-schedule-polls-playing11.md` | ACC schedule, polls, Playing 11 selection |
| 9 | `09-geofence-suspension.md` | Geofence, arrival tracking, suspension engine |
| 10 | `10-scoring-engine.md` | Match setup, ball-by-ball scoring |
| 11 | `11-scorecard-pdf.md` | Scorecard confirmation, PDF export |
| 12 | `12-statistics.md` | Stats aggregation, leaderboards, MOTM/MOTT |
| 13 | `13-notifications-audit.md` | FCM push, audit log, announcements |
| 14 | `14-video-upload.md` | Video upload module, S3 multipart |
| 15 | `15-fees.md` | Fees tracking, due notifications |
| 16 | `16-otp-lockout.md` | OTP lockout view, account unlock |
| 17 | `17-design-system.md` | Stitch design extraction, component library |
| 18 | `18-ui-screens.md` | Per-screen UI build from Stitch mockups |
| 19 | `19-e2e-load-tests.md` | Detox E2E, Supertest API, load testing |
| 20 | `20-production-infra.md` | AWS CDK/Terraform, deployment, observability |

> Prompt files for phases 1–20 will be added as they are authored. Phase 0 prompt lives at the repository root as `00-bootstrap-cursor-prompt.md`.
