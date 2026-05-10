FROM node:22-slim AS builder

WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tools/ tools/
COPY packages/core/package.json packages/core/
COPY packages/dbrain/package.json packages/dbrain/

RUN pnpm install --frozen-lockfile

COPY packages/core/src/ packages/core/src/
COPY packages/core/tsconfig.json packages/core/
COPY packages/dbrain/src/ packages/dbrain/src/
COPY packages/dbrain/tsconfig.json packages/dbrain/

RUN pnpm --filter @dtoolkit/core build && pnpm --filter @dtoolkit/dbrain build

FROM node:22-slim

WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tools/ tools/
COPY packages/core/package.json packages/core/
COPY packages/dbrain/package.json packages/dbrain/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/core/dist/ packages/core/dist/
COPY --from=builder /app/packages/dbrain/dist/ packages/dbrain/dist/

ENV DBRAIN_DATA=/data
ENV DBRAIN_PORT=7878
ENV DBRAIN_HOST=0.0.0.0
ENV DBRAIN_NON_INTERACTIVE=1

EXPOSE 7878

VOLUME /data

CMD ["sh", "-c", "node packages/dbrain/dist/cli/index.js init --non-interactive ${DBRAIN_DATA} && node packages/dbrain/dist/cli/index.js start ${DBRAIN_DATA}"]
