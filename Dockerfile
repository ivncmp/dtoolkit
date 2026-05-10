FROM node:22-slim AS builder

WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && npm rebuild better-sqlite3
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:22-slim

WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm rebuild better-sqlite3
COPY --from=builder /app/dist dist/

ENV DBRAIN_DATA=/data
ENV DBRAIN_PORT=7878
ENV DBRAIN_HOST=0.0.0.0
ENV DBRAIN_NON_INTERACTIVE=1

EXPOSE 7878

VOLUME /data

CMD ["sh", "-c", "node dist/cli/index.js init --non-interactive ${DBRAIN_DATA} && node dist/cli/index.js start ${DBRAIN_DATA}"]
