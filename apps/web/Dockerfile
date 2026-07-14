# Build context PHẢI là thư mục gốc repo: docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @field-notes/web... --prod=false

FROM deps AS build
COPY packages/shared packages/shared
COPY apps/web apps/web
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
RUN pnpm --filter @field-notes/shared build
RUN pnpm --filter @field-notes/web build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/web ./apps/web
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]
