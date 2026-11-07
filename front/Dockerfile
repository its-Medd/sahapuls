# Single-stage, dev-dependency-inclusive image: this is a convenience
# container for `docker compose up` demos, not a size-optimized production
# image (it runs `vite preview` rather than a static file server behind
# nginx). For iterative frontend development, prefer `npm run dev` locally -
# see README.
FROM node:20-bookworm-slim
WORKDIR /app

# Baked in at build time since Vite inlines VITE_* variables into the bundle.
# Override with --build-arg if the API is reachable at a different origin.
ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=$VITE_API_URL

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 4173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4173"]
