# ACC — Atmiya Cricket Club App

ACC is a cricket tournament management application for the Atmiya Cricket Club
community in Canada. It supports leather-ball and tennis-ball tournaments across
multiple cities, with features (built in later phases) for ball-by-ball scoring,
registration, RBAC, scheduling, suspensions, and live match updates.

This repository is a **pnpm workspace monorepo**. This phase sets up the
workspace, shared tooling, and local infrastructure only — the NestJS and Expo
apps are placeholders that will be scaffolded in later prompts.

## Repository structure

```
ACC/
├── apps/
│   ├── api/         # NestJS backend (TypeScript) — placeholder
│   └── mobile/      # Expo React Native app (TypeScript) — placeholder
├── packages/
│   └── types/       # Shared TypeScript types used by api and mobile (@acc/types)
├── docs/            # Specification documents
├── docker/          # docker-compose for local Postgres and Redis
├── package.json     # Root scripts and shared dev dependencies
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.mjs
└── .prettierrc.json
```

## Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org) (an LTS version is recommended)
- **pnpm** — install with `corepack enable` or `npm install -g pnpm`
- **Docker** (with Docker Compose) — for the local Postgres and Redis services
- **Expo Go** on your phone — install from the
  [App Store](https://apps.apple.com/app/expo-go/id982107779) or
  [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)
  to run the mobile app on a physical device

## Quick start

```bash
# 1. Install all workspace dependencies
pnpm install

# 2. Start the local database services (Postgres + Redis)
pnpm db:up

# 3. Run the apps (placeholders for now)
pnpm dev:api
pnpm dev:mobile
```

## Start the local database

Postgres and Redis run via Docker Compose. Defaults are baked into the compose
file, so no `.env` is required to get started.

```bash
# Start in the background
pnpm db:up

# Tail logs
pnpm db:logs

# Stop the services
pnpm db:down
```

| Service  | Host port | In-container port | Default credentials                    |
| -------- | --------- | ----------------- | -------------------------------------- |
| Postgres | 5435      | 5432              | user `acc` / password `acc` / db `acc` |
| Redis    | 6380      | 6379              | (no auth)                              |

> The host ports default to **5435** (Postgres) and **6380** (Redis) to avoid
> clashing with other local instances commonly bound to 5432/6379. Override them
> via `docker/.env` if you'd prefer the standard ports.

To override the defaults, copy the example env file and edit it:

```bash
cp docker/.env.example docker/.env
```

## Run the api

The NestJS app is not scaffolded yet. The command is wired and will run the real
dev server once the app exists.

```bash
pnpm dev:api
# (placeholder until apps/api is scaffolded in a later phase)
```

## Run the mobile app

The Expo app is not scaffolded yet. Once it is, `pnpm dev:mobile` will start the
Expo dev server; scan the QR code with **Expo Go** on your phone to load the app.

```bash
pnpm dev:mobile
# (placeholder until apps/mobile is scaffolded in a later phase)
```

## Shared tooling

- **TypeScript** — strict base config in `tsconfig.base.json`, extended per package
- **ESLint** — flat config in `eslint.config.mjs` (`pnpm lint`)
- **Prettier** — config in `.prettierrc.json` (`pnpm format`)
- **EditorConfig** — `.editorconfig` for consistent editor defaults

## Documentation

Specification and design documents live in [`/docs`](./docs):

- `docs/spec.docx` — consolidated application specification
- `docs/rbac.docx` — RBAC permission matrix
- `docs/designs/` — UI mockups
- `docs/cursor-prompts/` — phased build prompts

## Conventions

- Trunk-based development on `main`; feature branches named `feat/<short-description>`
- [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)
- Shared types live only in `@acc/types` — no duplicate definitions across apps
