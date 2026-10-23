# ProjectNova AI Gateway — standalone Bun server (server/gateway.ts).
# The gateway only imports Node builtins and files inside server/, so the
# image needs the package manifest, the lockfile and the server folder.
FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY server ./server

ENV NODE_ENV=production
EXPOSE 4000

CMD ["bun", "run", "server/gateway.ts"]
