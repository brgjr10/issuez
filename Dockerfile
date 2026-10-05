# Issuez ships as a static single-file bundle, so the image only needs a build
# stage (Vite) and a static file server (nginx). Node never reaches the runtime
# image and there is no backend process.
#
# Both base images are pinned by digest. The tag is kept beside it as documentation:
# `node:22-alpine` is what `sha256:0a71...` pointed at on 2026-10-05, so picking up a new
# Node means changing the tag and the digest together, deliberately.

# ---- build ------------------------------------------------------------------
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build

WORKDIR /app

# Dependencies first so this layer caches until the lockfile itself changes.
# The build only needs vite and vite-plugin-singlefile, which are now dependencies
# so `--omit=dev` skips the test runner (vitest + jsdom) without breaking the build.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Only what the build reads. dist/ is generated here, not copied in.
COPY index.html vite.config.js ./
COPY src ./src
COPY assets ./assets

RUN npm run build

# ---- serve ------------------------------------------------------------------
FROM nginx:stable-alpine@sha256:0985e772fb9f729e6fa0980da05fca5d9c468e870eed43071545afa9d2e27d94 AS serve

# Replaces the stock config so the security headers and the webmanifest MIME
# type are part of the image rather than a mounted sidecar file.
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html

# conf.d/default.conf is dead config — this nginx.conf does not include conf.d — and the
# stock entrypoint scripts try to rewrite it, which they cannot do once nginx drops
# privileges, so the scripts would fail the container's entrypoint. Removing it takes them
# out of the picture. /var/cache/nginx is where nginx keeps its temp bodies and it has to
# be writable by the unprivileged user.
RUN rm -f /etc/nginx/conf.d/default.conf \
    && chown -R nginx:nginx /var/cache/nginx /usr/share/nginx/html

# Serve unprivileged. Stock nginx runs the master as root purely to bind port 80, and
# containers set net.ipv4.ip_unprivileged_port_start=0, so the `nginx` user can bind it too.
# docker/nginx.conf points the pid file and the logs at paths that user can write.
USER nginx

EXPOSE 80

# /healthz is served by nginx itself, so the check does not depend on wget
# resolving anything outside the container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

STOPSIGNAL SIGQUIT

CMD ["nginx", "-g", "daemon off;"]