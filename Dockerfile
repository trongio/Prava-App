# syntax=docker/dockerfile:1.7
#
# Web build of the driving test app (driving.hackerman.ge).
#
# The same codebase ships to the Play Store through NativePHP; this image is
# the APP_PLATFORM=web variant, which swaps the device profile picker for real
# Fortify accounts and guest sessions. See app/Support/Platform.php.
#
# Build with the NativePHP Composer credentials passed as a secret, never
# copied into a layer:
#
#   DOCKER_BUILDKIT=1 docker build \
#     --secret id=composer_auth,src=$HOME/.config/composer/auth.json \
#     -t driving-web:<sha> .

ARG FRANKENPHP_IMAGE=dunglas/frankenphp:1.12.7-php8.3.33-bookworm

# ---------------------------------------------------------------------------
# Builder: PHP dependencies, then the Vite bundle.
# ---------------------------------------------------------------------------
FROM ${FRANKENPHP_IMAGE} AS builder

RUN install-php-extensions pdo_sqlite zip intl gd @composer

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates git unzip \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependency manifests first so these layers survive application changes.
COPY composer.json composer.lock ./
RUN --mount=type=secret,id=composer_auth,target=/app/auth.json \
    composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

RUN composer dump-autoload --optimize --classmap-authoritative --no-dev

# Wayfinder shells out to `php artisan` during the Vite build and emits one
# module per registered route, and the route table differs per platform, so
# the build has to know it is building the web variant.
#
# VITE_APP_NAME is baked into the bundle at build time and is what every
# browser tab title reads; there is no .env in the image to supply it, so
# without this every page would be titled "... - Laravel". Keep it in step
# with APP_NAME in deploy/env.production.example.
ARG VITE_APP_NAME="მართვის მოწმობა"
ENV APP_PLATFORM=web \
    VITE_APP_NAME=${VITE_APP_NAME}
RUN php artisan wayfinder:generate --no-interaction \
    && npm run build

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
FROM ${FRANKENPHP_IMAGE} AS runtime

RUN install-php-extensions pdo_sqlite zip intl gd opcache

# curl backs the container health check, procps backs the scheduler's.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl procps libcap2-bin \
    && rm -rf /var/lib/apt/lists/*

# FrankenPHP binds :8000 rather than :80 so it needs no capability to bind a
# privileged port, and can therefore drop to an unprivileged user.
ENV SERVER_NAME=:8000 \
    APP_PLATFORM=web \
    APP_ENV=production \
    APP_DEBUG=false \
    DB_CONNECTION=sqlite \
    DB_DATABASE=/data/database.sqlite

RUN setcap -r /usr/local/bin/frankenphp 2>/dev/null || true; \
    useradd --create-home --uid 10001 --shell /usr/sbin/nologin app \
    && mkdir -p /data /config/caddy /data/caddy \
    && chown -R app:app /data /config

WORKDIR /app

COPY --from=builder --chown=app:app /app /app
COPY --chown=app:app deploy/docker-entrypoint.sh /usr/local/bin/app-entrypoint

RUN chmod +x /usr/local/bin/app-entrypoint \
    && rm -f /app/database/database.sqlite

USER app

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
    CMD curl -fsS http://127.0.0.1:8000/up || exit 1

ENTRYPOINT ["/usr/local/bin/app-entrypoint"]
CMD ["frankenphp", "run", "--config", "/etc/frankenphp/Caddyfile"]
