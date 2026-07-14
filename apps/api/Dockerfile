# Build context PHẢI là thư mục gốc repo: docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @field-notes/api... --prod=false

FROM deps AS build
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @field-notes/shared build
RUN pnpm --filter @field-notes/api prisma:generate
RUN pnpm --filter @field-notes/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api ./apps/api
WORKDIR /app/apps/api
EXPOSE 8080
CMD ["node", "dist/index.js"]
