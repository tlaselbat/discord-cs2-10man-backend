FROM node:22.19.0-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm prisma:generate && pnpm build

FROM node:22.19.0-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable && addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/package.json /app/pnpm-lock.yaml ./
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/src/generated ./src/generated
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/prisma.config.ts ./prisma.config.ts
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health/live').then((r) => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"
CMD ["pnpm", "start"]
