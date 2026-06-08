# Cursor Prompt — ACC Application Phase 0 (Bootstrap)

> **How to use**: paste this entire file as the first prompt in a fresh Cursor session inside a new empty directory. Do not paste it incrementally. Cursor will work through it task by task. Review the output of each task before continuing; if Cursor drifts, stop it and correct course before letting it move on.

---

## Role

You are a senior full-stack engineer being asked to bootstrap a brand-new cricket tournament management application. Your job in this prompt is to set up the repository skeleton, tooling, and foundational infrastructure ONLY. You will not implement any business logic, UI screens, scoring engine, auth flow, or feature code in this phase. All of those are explicitly out of scope and will be handled in subsequent prompts.

## Product context

A mobile application for the Atmiya Cricket Club community based in Canada. It supports three tournament types:

- **ACC (Atmiya Cricket Club)** — Leather Ball, 4 fixed teams, participates in the external BEDCL league, 25 overs, max 5 overs per bowler, 16 matches per team per season.
- **APL (Atmiya Premier League)** — Tennis Ball, all cities in the province participate.
- **Center-level** — Tennis Ball, single or multi-city (but not all cities).

Capabilities that will be built in later phases include: ball-by-ball scoring, geofence-based match attendance enforcement, suspension governance, RBAC across 9 roles, OTP-based password reset, server-side PDF scorecard export, FCM push notifications, and live match streaming via embedded YouTube.

Target audience is 18+ only, English-only, online-only. All data must reside in Canada for PIPEDA compliance.

## Source of truth documents

Three documents live in `/docs/` and must be created as part of this prompt as empty folder placeholders. The user will populate them.

| File              | Purpose                                           | Status                     |
| ----------------- | ------------------------------------------------- | -------------------------- |
| `/docs/spec.docx` | ACC Application Consolidated Specification V3     | will be supplied by user   |
| `/docs/rbac.docx` | RBAC Permission Matrix                            | will be supplied by user   |
| `/docs/designs/`  | UI mockups from Stitch (PNG / SVG / Figma export) | populated before UI phases |

When implementing any feature in later prompts, always reference these docs. If something is unclear or contradictory, surface the question; do not invent rules or features.

## Tech stack — locked decisions

Do not deviate from any of these without explicit user instruction.

### Mobile

- React Native via Expo (managed workflow, SDK 51 or later)
- TypeScript in strict mode
- Expo Router for file-based navigation
- TanStack Query (React Query) for server state
- Zustand for client state
- React Hook Form plus Zod for forms
- expo-secure-store for token storage
- react-native-maps for ground location display
- expo-location for geofencing
- date-fns and date-fns-tz for timezone handling

### Backend

- NestJS 10 or later
- TypeScript in strict mode
- Prisma ORM
- PostgreSQL 16
- Redis 7 for cache, rate limiting, and OTP storage
- Socket.IO for live match score push to subscribers
- BullMQ for background jobs (suspension carry-forward, scorer auto-revoke, scorecard auto-confirm)
- class-validator and class-transformer for DTO validation
- Passport.js with JWT (custom strategy with token versioning for single-device enforcement)
- Pino for structured logging
- Puppeteer for server-side PDF generation

### Shared

- A workspace package containing all enums, constants, DTOs, and Zod schemas used by both mobile and backend. There must be no duplication of these between apps.

### Deferred infra (record intent in README, do not provision)

- AWS ca-central-1 (Montreal) for PIPEDA data residency
- S3 for media (profile photos, posters, showcase videos)
- ECS Fargate for backend
- ElastiCache for Redis
- RDS for PostgreSQL
- Twilio for SMS OTP delivery (Canadian +1 numbers)
- FCM for push notifications
- Sentry for error tracking
- CloudWatch for logs and metrics
- GitHub Actions for CI

## Repository structure

Create a Turborepo monorepo with this exact structure:

```
acc-app/
├── apps/
│   ├── mobile/                # React Native + Expo
│   └── backend/               # NestJS API
├── packages/
│   ├── shared/                # Shared types, enums, Zod schemas, constants
│   ├── config-eslint/         # Shared ESLint config
│   └── config-typescript/     # Shared tsconfig presets
├── docs/
│   ├── spec.docx              # placeholder, user supplies
│   ├── rbac.docx              # placeholder, user supplies
│   ├── designs/               # empty folder
│   └── cursor-prompts/        # subsequent phase prompts go here
├── infra/                     # docker-compose for local; deployment manifests later
├── .github/
│   └── workflows/             # CI pipelines
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .gitignore
├── .editorconfig
└── README.md
```

## Code standards

These apply to all code Cursor writes in this and all future prompts.

- TypeScript strict mode everywhere. No `any`. No `as unknown as` casts to silence the compiler. If a type is hard to express, ask before bypassing the type system.
- Backend follows NestJS module-per-feature: each spec module (auth, profile, tournament, registration, teams, schedule, polls, suspension, match-setup, scoring, scorecard, stats, notifications, audit, video, fees, otp-lockout) becomes one NestJS module.
- Mobile follows feature-folder structure under `apps/mobile/features/<feature-name>/` with subfolders for `screens`, `components`, `hooks`, and `queries`.
- Shared types, enums, and Zod schemas live in `packages/shared/` and are imported by both apps. No duplicate enum definitions anywhere.
- Naming: PascalCase for components and classes, camelCase for functions and variables, SCREAMING_SNAKE_CASE for constants, kebab-case for filenames.
- Conventional Commits format required (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`).
- Every API endpoint has a request DTO and response DTO defined in `packages/shared/` using Zod.
- Every API response uses a uniform envelope: `{ data: T | null, error: { code, message, requestId } | null }`.
- All datetimes are stored as UTC in the database, transmitted as ISO 8601 strings in the API, and formatted to the ground's local timezone at display time using date-fns-tz on mobile.
- All money and fees are stored in cents as BIGINT. Never use floats for money.
- Cricket statistics that involve division (averages, strike rate, economy) are computed at query time, never persisted denormalized.
- Logging: backend uses Pino with structured fields (requestId, userId, action). No `console.log` anywhere in production code paths.

## Phase 0 — Bootstrap tasks

Execute in order. Verify each task using the listed verification step before moving to the next. If a verification step fails, fix it before continuing.

### Task 0.1 — Initialize the monorepo

1. Initialize pnpm at the root. Set `"packageManager": "pnpm@9.x.x"` in root `package.json`.
2. Set up Turborepo 2.x as the build orchestrator. Configure `turbo.json` with pipelines for `lint`, `typecheck`, `build`, `test`, `dev`.
3. Create `tsconfig.base.json` at the root with strict settings: `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `exactOptionalPropertyTypes: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`.
4. Create `packages/config-eslint/` with a base `index.js` that exports an ESLint flat config using `@typescript-eslint`, `eslint-plugin-import`, `eslint-plugin-unused-imports`, and integrates Prettier. Export separate variants for Node and React Native.
5. Create `packages/config-typescript/` with `base.json`, `node.json`, and `react-native.json` extending the root base.
6. Wire workspace dependencies via `pnpm-workspace.yaml`. Internal package references use `workspace:*`.

**Verify**: `pnpm install` completes without errors. `pnpm turbo run lint` runs and passes (no files yet so no errors, but the pipeline must execute).

### Task 0.2 — Shared package skeleton

Create `packages/shared/`:

- `package.json` named `@acc/shared`, exports as ESM, built with `tsup` (single bundle, dts on).
- `src/enums/role.ts` — exports a const enum `Role` with members: `ADMIN`, `CLUB_MANAGER`, `CENTER_SEVAK`, `CAPTAIN`, `VICE_CAPTAIN`, `MANAGER`, `PLAYER`, `SCORER`, `GUEST`.
- `src/enums/tournament-type.ts` — `ACC`, `APL`, `CENTER_LEVEL`.
- `src/enums/ball-type.ts` — `LEATHER`, `TENNIS`.
- `src/enums/tournament-status.ts` — `NEW`, `REGISTRATION_OPEN`, `REGISTRATION_CLOSED`, `TEAMS_FINALIZED`, `FIXTURE_PUBLISHED`, `LIVE`, `KNOCKOUT_STATE`, `COMPLETED`.
- `src/enums/match-state.ts` — `SCHEDULED`, `PLAYING_11_LOCKED`, `TOSS_COMPLETED`, `LIVE`, `DELAYED`, `RAIN_INTERRUPTED`, `CANCELLED`, `NO_RESULT`, `COMPLETED`, `SCORECARD_LOCKED`.
- `src/enums/dismissal.ts` — `BOWLED`, `CAUGHT`, `LBW`, `RUN_OUT`, `STUMPED`, `HIT_WICKET`, `RETIRED_HURT`, `RETIRED_OUT`.
- `src/enums/registration-status.ts` — `IN_WAITLIST`, `CONFIRMED`, `DECLINED`.
- `src/enums/registration-form-batting-style.ts` — `RHB`, `LHB`.
- `src/enums/registration-form-bowling-style.ts` — `PACE`, `SPIN`.
- `src/enums/match-result.ts` — `WIN`, `LOSS`, `TIE_RESOLVED_BY_SUPER_OVER`, `NO_RESULT`.
- `src/constants/cricket.ts` — export `CRICKET_CONSTANTS` containing: `ACC_OVERS = 25`, `ACC_MAX_OVERS_PER_BOWLER = 5`, `ACC_MATCHES_PER_SEASON = 16`, `ACC_FIXED_TEAMS = ['ACC 3', 'ACC 6', 'ACC 9', 'ACC 0']`, `GEOFENCE_RADIUS_METERS = 50`, `IMPACT_PLAYER_MAX_CANDIDATES_PER_TEAM = 3`, `MATCHDAY_SQUAD_SIZE = 14`, `PLAYING_11_SIZE = 11`, `SUBSTITUTES_COUNT = 2`.
- `src/constants/auth.ts` — `OTP_EXPIRY_MINUTES = 5`, `OTP_MAX_PER_DAY = 5`, `OTP_MAX_ATTEMPTS = 5`, `PASSWORD_LENGTH = 6`, `IDLE_LOGOUT_DAYS = 10`, `SCORECARD_CONFIRM_WINDOW_HOURS = 5`.
- `src/constants/video.ts` — `VIDEO_MAX_DURATION_SECONDS = 60`, `VIDEO_ACCEPTED_MIME_TYPES = ['video/mp4', 'video/quicktime']`.
- `src/schemas/auth.ts` — Zod schemas for `LoginRequest`, `SignupRequest`, `OtpRequest`, `OtpVerifyRequest`, `PasswordResetRequest`. Export inferred TypeScript types.
- `src/schemas/api-envelope.ts` — Zod schema for `ApiResponse<T>` generic envelope.
- `src/index.ts` — barrel re-export of everything.

**Verify**: `pnpm --filter @acc/shared build` produces a `dist/` folder with `index.js`, `index.mjs`, and `index.d.ts`. Importing `Role.CAPTAIN` from `@acc/shared` in a scratch file resolves and type-checks.

### Task 0.3 — Backend skeleton

Create `apps/backend/`:

- NestJS 10 initialized with `@nestjs/cli`. Use the `npm` scaffolding then convert to pnpm.
- Modules at this stage: `AppModule`, `HealthModule`, `ConfigModule` (using `@nestjs/config` with Zod validation of `process.env` against a schema in `apps/backend/src/config/env.schema.ts`).
- `HealthModule` exposes `GET /health` returning `{ status: 'ok', timestamp, version }` where `version` reads from `package.json`.
- Pino logger configured globally via `nestjs-pino`. Request ID middleware generates and propagates a `x-request-id` header.
- Helmet middleware, CORS with allow-list driven by env var, global rate limiting (100 req per minute per IP) via `@nestjs/throttler`.
- Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- Global exception filter formatting errors into the standard envelope `{ data: null, error: { code, message, requestId } }`.
- `prisma/schema.prisma` with PostgreSQL datasource, generator client, and an empty model section. Run `prisma generate` so the client is buildable.
- `.env.example` listing every env var the backend will eventually need: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `FCM_PROJECT_ID`, `FCM_PRIVATE_KEY`, `FCM_CLIENT_EMAIL`, `S3_BUCKET`, `S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SENTRY_DSN`, `PORT`, `NODE_ENV`, `CORS_ORIGINS`.
- A `jest.config.ts` and one passing smoke test for the health endpoint.

**Verify**: `pnpm --filter backend start:dev` starts the server on port 3000. `curl http://localhost:3000/health` returns 200 with the expected JSON. `pnpm --filter backend test` passes the smoke test.

### Task 0.4 — Mobile skeleton

Create `apps/mobile/`:

- Expo init with managed workflow and TypeScript template (`npx create-expo-app@latest --template`).
- Expo Router configured. Two routes: `app/_layout.tsx` (root layout) and `app/index.tsx` (welcome screen).
- Welcome screen shows: app name, app version (from `expo-application` or package.json), and a small live "Backend: <status>" indicator that calls `/health` via TanStack Query. If the backend is down it shows "Backend: unreachable". No styling beyond Expo defaults.
- API client at `lib/api/client.ts` using `fetch`, reads base URL from `process.env.EXPO_PUBLIC_API_URL`, attaches a generated request ID header.
- Auth state placeholder at `lib/store/auth.ts` using Zustand. Initial state has `accessToken: null`, `refreshToken: null`, `userId: null`. No actual auth flow.
- Theme tokens placeholder at `lib/theme/tokens.ts`. Export an empty `tokens` object with the structure `{ color: {}, spacing: {}, radii: {}, type: {} }`. Do not pick any actual values; that comes from the Stitch designs.
- `app.json` configured with bundle identifier `com.atmiya.acc` for both iOS and Android. Set `scheme: 'acc'` for deep linking.

**Verify**: `pnpm --filter mobile start` opens the Expo dev server. Welcome screen loads in Expo Go on a real device or simulator. If the backend is running, the screen shows the backend status as ok.

### Task 0.5 — Local dev infrastructure

Create `infra/docker-compose.yml` at root:

- `postgres:16-alpine` on port 5432, named volume for data, env vars from `.env`
- `redis:7-alpine` on port 6379
- `mailhog/mailhog:latest` on ports 1025 (smtp) and 8025 (web ui) — placeholder for any future email work

Create root `.env.example` with `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, plus all backend env vars from Task 0.3 with placeholder values.

Add a Makefile at root with targets: `make up` (docker compose up), `make down` (docker compose down), `make logs`, `make psql`, `make redis-cli`.

**Verify**: `make up` brings all services to a healthy state. `docker compose ps` shows all three services running. Connect to Postgres with `psql` via `make psql` and run `\dt` to confirm the connection succeeds against an empty DB.

### Task 0.6 — CI scaffold

Create `.github/workflows/ci.yml` with three jobs that run on every push and pull request:

1. `lint` — checkout, setup Node 20, setup pnpm 9, install with cache, run `pnpm turbo run lint`
2. `typecheck` — same setup, run `pnpm turbo run typecheck`
3. `test` — same setup, run `pnpm turbo run test` (will only run the one health smoke test for now)

Use the official `pnpm/action-setup@v3` and `actions/setup-node@v4` with pnpm cache enabled.

**Verify**: push a feature branch to GitHub and confirm all three jobs pass. If GitHub remote is not yet set up, skip this verification but ensure the workflow file is syntactically valid.

### Task 0.7 — README and documentation

Create root `README.md` containing:

- One-paragraph product description (use the Product context section above as a base)
- "Quick start" section: `pnpm install`, `cp .env.example .env`, `make up`, `pnpm dev`
- "Repository structure" section: tree diagram of the structure with one-line description of each folder
- "Tech stack" section: bullet list of locked decisions
- "Documentation" section: links to `/docs/spec.docx` and `/docs/rbac.docx` and `/docs/cursor-prompts/`
- "Branching and commits" section: trunk-based development on `main`, feature branches named `feat/<short-description>`, Conventional Commits required
- "Environment variables" section: list every env var with a one-line description of what it controls

Create `docs/cursor-prompts/README.md` with a placeholder index listing the planned subsequent phases (copied from "What comes next" below).

## What you must NOT do in this prompt

This list is non-negotiable. Stop and refuse if instructed to do any of these as part of Phase 0.

- Do not implement authentication business logic. The auth module scaffold is fine; signup, login, OTP flow are Phase 2.
- Do not write any Prisma schema beyond the empty placeholder. Full schema is Phase 1.
- Do not build any UI screen beyond the welcome screen described in Task 0.4.
- Do not write the scoring engine, geofence logic, suspension logic, or any feature code.
- Do not install any UI component library (no NativeBase, no Tamagui, no shadcn equivalent). Wait until the UI phase, when component library will be chosen based on what fits the Stitch designs.
- Do not pick brand colors, fonts, or other visual design tokens. The theme file stays empty placeholder.
- Do not write feature tests. The one health smoke test is the only test in this phase.
- Do not provision any AWS infrastructure. Local docker-compose only.
- Do not generate fake data or seed data. Database stays empty until Phase 1.
- Do not commit any `.env` files. Only `.env.example` files with placeholder values.

## Self-check before declaring Phase 0 complete

Run through this list and report any failures before saying you are done.

- [ ] `pnpm install` from a clean clone succeeds in under 3 minutes
- [ ] `pnpm turbo run lint typecheck build` passes across all packages and apps
- [ ] `make up` brings docker services to healthy state
- [ ] `pnpm --filter backend start:dev` runs the backend on port 3000
- [ ] `curl http://localhost:3000/health` returns 200 with `{ status: 'ok', timestamp, version }`
- [ ] `pnpm --filter mobile start` opens Expo dev server and the welcome screen renders
- [ ] Welcome screen successfully calls the backend and shows status as ok
- [ ] All 9 roles, 3 tournament types, 8 tournament statuses, 10 match states, 8 dismissal types defined in `@acc/shared/enums/`
- [ ] All cricket and auth constants from the spec defined in `@acc/shared/constants/`
- [ ] `.env.example` files contain every env var that will eventually be needed
- [ ] CI workflow file present and syntactically valid
- [ ] README explains how to bootstrap a fresh dev environment in under 10 minutes

If any item fails, fix it before responding. Do not declare done with caveats.

## What comes next (do NOT do these now)

These are the planned subsequent prompts. Listed here so you know not to do them in Phase 0, and so Cursor can structure code to make later phases easier.

| Phase | Scope                                                                                                                                                                                                                                                                   |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Full Prisma schema for all entities (User, Player, Center, Tournament, Team, Match, Ball, ScorecardSnapshot, Suspension, Registration, RegistrationForm, Notification, AuditLog, Video, Fee, OtpAttempt, ImpactPlayer, Poll, PollVote) with migrations and seed scripts |
| 2     | Auth: signup, login (mobile + 6-char password), OTP via Twilio, single-device enforcement with token versioning, 10-day idle logout, failed-login attempt logging                                                                                                       |
| 3     | RBAC: NestJS guard, `@Roles()` decorator, `@TournamentScope()` decorator, policy service driven by the RBAC matrix                                                                                                                                                      |
| 4     | Player profile module: own profile CRUD, Center migration approval flow, deactivation                                                                                                                                                                                   |
| 5     | Tournament management: create tournament for each type, lifecycle state machine, cloning from past tournaments, custom registration form requests                                                                                                                       |
| 6     | Registration: submit registration, Center Sevak approval queue, ratings and availability for APL, late registration                                                                                                                                                     |
| 7     | Teams and roster: team creation, Cap / VC / Manager assignment, favourites, ACC reshuffle, Impact Player marking                                                                                                                                                        |
| 8     | ACC schedule, availability polls, Playing 11 selection (Captain workflow), external team player entry                                                                                                                                                                   |
| 9     | Geofence with expo-location, arrival tracking, suspension engine (BullMQ scheduled jobs for carry-forward)                                                                                                                                                              |
| 10    | Match setup (toss data capture per V3, scorer per-match grant), ball-by-ball scoring engine (extras, Free Hit on any no-ball, Retired Hurt / Out, Super Over chain, DLS manual update, Impact Player swap)                                                              |
| 11    | Scorecard confirmation (5-hour window, optimistic locking with "Scorecard got updated" error, auto-confirm via BullMQ), server-side PDF export via Puppeteer                                                                                                            |
| 12    | Statistics aggregation, scorecard add-ons (fall of wickets, partnerships), tournament leaderboards, Man of the Match and Man of the Tournament                                                                                                                          |
| 13    | FCM push notifications for all triggers in spec § 17, immutable audit log with Admin-only view, tournament-wide announcements                                                                                                                                           |
| 14    | Video upload module: 1-minute cap, allowed mime types, S3 multipart upload, viewer access control                                                                                                                                                                       |
| 15    | Fees module: manual tracking, team-wide and per-player views, fees-due notification (1 day before tournament start)                                                                                                                                                     |
| 16    | OTP lockout view, account unlock action for Captain and Club Manager                                                                                                                                                                                                    |
| 17    | UI design system extraction from Stitch mockups, component library setup, theme tokens population                                                                                                                                                                       |
| 18    | Per-screen UI build, driven by Stitch designs and screen inventory from UX phase                                                                                                                                                                                        |
| 19    | E2E test suite (Detox for mobile, Supertest for API), load testing for scoring engine                                                                                                                                                                                   |
| 20    | Production infra (AWS CDK or Terraform), deployment pipeline, observability wiring                                                                                                                                                                                      |

## Important reminders before you start

1. Two items from the spec are flagged as security risks: 6-character alphanumeric password with no failed-login protection, and phone number change without OTP. Do not write any code that contradicts these decisions in Phase 0, but flag them in the README under "Known security concerns to revisit."
2. Six items from the spec are open decisions (Captain + VC both suspended, Powerplay scope, locked account unlock UX, Impact Player 12th selection mechanic, email field purpose, combined auth risk). Do not resolve any of these in Phase 0. Capture them in `/docs/open-decisions.md` so they are visible.
3. The Manager role exists only in APL and Center-level tournaments, not ACC. Bake this into the enum type or shared constant so it cannot be forgotten in later phases.
4. All datetimes in UTC, displayed in the ground's local timezone. Set this convention up correctly from day one; retrofitting timezones is painful.

## Start

Acknowledge that you have read and understood this prompt, list the tech stack decisions back to me in one line each so I know they registered, then begin Task 0.1.

Do not skip the acknowledgement. Do not collapse multiple tasks into one. Do not move past a verification step that fails.
