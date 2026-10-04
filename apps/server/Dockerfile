# @kuiz/server (Fastify + Socket.IO) container image. The web app is a separate static build
# (see docs/deploy.md). Build context is the REPO ROOT (the server needs the workspace packages):
#
#   docker build -f apps/server/Dockerfile -t kuiz-server .
#   docker run -p 3001:3001 -e DATABASE_URL=postgres://… -e CORS_ORIGIN=https://your-web kuiz-server
#
# ponytail: copies the whole workspace into the runtime image — simple, not slim. If image size
# matters, add a prune stage (pnpm deploy --prod) and copy only dist + pruned node_modules.

FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
# turbo-aware so `prisma generate` and the core/bricks builds run first (see turbo.json).
RUN pnpm exec turbo run build --filter=@kuiz/server

FROM node:22-slim AS run
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/server/dist/index.js"]
