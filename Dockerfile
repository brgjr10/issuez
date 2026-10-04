# Issuez ships as a static single-file bundle, so the image only needs a build
# stage (Vite) and a static file server (nginx). Node never reaches the runtime
# image and there is no backend process.

# ---- build ------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Dependencies first so this layer caches until the lockfile itself changes.
# Vite and vitest are devDependencies but the build needs them, so no --omit=dev.
COPY package.json package-lock.json ./
RUN npm ci

# Only what the build reads. dist/ is generated here, not copied in.
COPY index.html vite.config.js ./
COPY src ./src
COPY assets ./assets

RUN npm run build

# ---- serve ------------------------------------------------------------------
FROM nginx:stable-alpine AS serve

# Replaces the stock config so the security headers and the webmanifest MIME
# type are part of the image rather than a mounted sidecar file.
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# /healthz is served by nginx itself, so the check does not depend on wget
# resolving anything outside the container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

STOPSIGNAL SIGQUIT

CMD ["nginx", "-g", "daemon off;"]
