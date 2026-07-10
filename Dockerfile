# ---- Base ----
    FROM node:22-slim AS base
    # OpenSSL is required by Prisma at runtime/generate
    RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
    # Enable pnpm at the exact version from your root package.json
    RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
    WORKDIR /app
    
    # ---- Dependencies (install the whole workspace) ----
    FROM base AS deps
    # Copy workspace manifests first for better layer caching
    COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
    COPY apps/api/package.json ./apps/api/
    COPY packages/types/package.json ./packages/types/
    # pnpm 11 requires allowBuilds in pnpm-workspace.yaml (not package.json#pnpm).
    RUN grep -q "'@firebase/util': true" pnpm-workspace.yaml \
      && grep -q 'protobufjs: true' pnpm-workspace.yaml
    # Install all workspace deps (frozen = reproducible from the lockfile)
    RUN pnpm install --frozen-lockfile
    
    # ---- Build ----
    FROM base AS build
    # Bring in installed node_modules from deps
    COPY --from=deps /app/node_modules ./node_modules
    COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
    COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
    # Copy the full source
    COPY . .
    # Build the shared types package first (API imports @acc/types)
    RUN pnpm --filter @acc/types build
    # Generate the Prisma client (schema lives under apps/api/prisma)
    RUN pnpm --filter @acc/api prisma:generate
    # Build the NestJS API (nest build -> apps/api/dist)
    RUN pnpm --filter @acc/api build
    
    # ---- Runtime (lean final image) ----
    FROM base AS runtime
    ENV NODE_ENV=production
    # node_modules (workspace) + built artifacts
    COPY --from=build /app/node_modules ./node_modules
    COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
    COPY --from=build /app/packages/types ./packages/types
    COPY --from=build /app/apps/api/dist ./apps/api/dist
    COPY --from=build /app/apps/api/package.json ./apps/api/package.json
    # Prisma needs the schema + generated client at runtime
    COPY --from=build /app/apps/api/prisma ./apps/api/prisma
    COPY apps/api/scripts/docker-start.sh ./apps/api/scripts/docker-start.sh
    RUN chmod +x ./apps/api/scripts/docker-start.sh
    WORKDIR /app/apps/api
    # Railway injects PORT; your app must listen on process.env.PORT
    EXPOSE 3001
    CMD ["./scripts/docker-start.sh"]
