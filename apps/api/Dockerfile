# Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev --workspace @turnout/api --workspace @turnout/shared --include-workspace-root=false

FROM node:24-slim
# Fonts for the link-preview images (resvg renders text with system fonts).
RUN apt-get update && apt-get install -y --no-install-recommends fonts-inter fontconfig && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY packages/shared packages/shared
COPY apps/api apps/api
# Recreate the workspace link npm ci would have made (so @turnout/shared resolves to the source).
RUN mkdir -p node_modules/@turnout && ln -sfn ../../packages/shared node_modules/@turnout/shared
USER node
WORKDIR /app/apps/api
EXPOSE 8080
CMD ["node", "--import", "./src/telemetry.ts", "src/server.ts"]
