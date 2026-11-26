FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
COPY simulator/package.json simulator/
RUN npm install --global npm@11.21.2 && npm ci --workspace server --include-workspace-root
COPY server/ server/
RUN npm run build --workspace server && npm prune --omit=dev --workspace server --include-workspace-root
FROM node:22-bookworm-slim
WORKDIR /app/server
ENV NODE_ENV=production
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/server/package.json ./
COPY --from=builder /app/server/dist ./dist
RUN mkdir -p data && chown node:node data
USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
