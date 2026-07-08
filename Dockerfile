# ---- Base ----
FROM node:22-slim AS base
# OpenSSL is required by Prisma at runtime/generate
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
# Enable pnpm at the exact version from the root package.json
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
WORKDIR /app

# ---- Dependencies (install the whole workspace) ----
FROM base AS deps
# Copy workspace manifests first for better layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
# Install all workspace deps (frozen = reproducible from the lockfile).
# Dev deps are kept so prisma CLI is available for migrate deploy at startup.
RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY . .
RUN pnpm --filter @acc/types build
RUN pnpm --filter @acc/api prisma:generate
RUN pnpm --filter @acc/api build

# ---- Runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/types ./packages/types
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY apps/api/scripts/docker-start.sh ./apps/api/scripts/docker-start.sh
RUN chmod +x ./apps/api/scripts/docker-start.sh
WORKDIR /app/apps/api
# Railway injects PORT; the app listens on process.env.PORT
EXPOSE 3001
CMD ["./scripts/docker-start.sh"]
