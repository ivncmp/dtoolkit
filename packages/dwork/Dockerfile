FROM node:22-slim AS builder

WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tools/ tools/
COPY packages/core/package.json packages/core/
COPY packages/sdk/package.json packages/sdk/
COPY packages/dwork/package.json packages/dwork/

RUN pnpm install --frozen-lockfile

COPY packages/core/src/ packages/core/src/
COPY packages/core/tsconfig.json packages/core/
COPY packages/sdk/src/ packages/sdk/src/
COPY packages/sdk/tsconfig.json packages/sdk/
COPY packages/dwork/src/ packages/dwork/src/
COPY packages/dwork/tsconfig.json packages/dwork/

RUN pnpm --filter @dtoolkit/core build && pnpm --filter @dtoolkit/sdk build && pnpm --filter @dtoolkit/dwork build

FROM node:22-slim

WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tools/ tools/
COPY packages/core/package.json packages/core/
COPY packages/sdk/package.json packages/sdk/
COPY packages/dwork/package.json packages/dwork/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/core/dist/ packages/core/dist/
COPY --from=builder /app/packages/sdk/dist/ packages/sdk/dist/
COPY --from=builder /app/packages/dwork/dist/ packages/dwork/dist/

ENV DWORK_DATA=/data
ENV DWORK_PORT=7881
ENV DWORK_HOST=0.0.0.0
ENV DWORK_NON_INTERACTIVE=1

EXPOSE 7881 7882

VOLUME /data

CMD ["sh", "-c", "node packages/dwork/dist/cli/index.js init --non-interactive ${DWORK_DATA} && node packages/dwork/dist/cli/index.js start ${DWORK_DATA}"]
