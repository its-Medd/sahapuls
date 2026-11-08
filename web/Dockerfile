FROM node:22-bookworm-slim AS builder
WORKDIR /app
ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=$VITE_API_URL
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
COPY simulator/package.json simulator/
RUN npm install --global npm@11.21.2 && npm ci --workspace web --include-workspace-root
COPY web/ web/
RUN npm run build --workspace web
FROM nginx:stable-alpine
COPY --from=builder /app/web/dist /usr/share/nginx/html
EXPOSE 80
