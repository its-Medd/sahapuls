FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
COPY simulator/package.json simulator/
RUN npm install --global npm@11.21.2 && npm ci --workspace simulator --include-workspace-root
COPY simulator/ simulator/
RUN npm run build --workspace simulator && npm prune --omit=dev --workspace simulator --include-workspace-root
FROM node:22-bookworm-slim
WORKDIR /app/simulator
ENV NODE_ENV=production
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/simulator/package.json ./
COPY --from=builder /app/simulator/dist ./dist
USER node
CMD ["node", "dist/index.js"]
