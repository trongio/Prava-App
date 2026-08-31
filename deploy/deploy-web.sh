#!/usr/bin/env bash
#
# Deploys the web build to driving.hackerman.ge on aegis-cloud.
#
# The server is arm64 and this workstation is x86_64, so the image is built on
# the server rather than pushed to it. There is no registry in the loop: the
# working tree is rsynced into a release directory, built there, and the
# previous release is left in place for a rollback.
#
#   deploy/deploy-web.sh              # deploy the current working tree
#   deploy/deploy-web.sh --bootstrap  # first run: create network, .env, volumes
#
set -euo pipefail

HOST="${DEPLOY_HOST:-aegis-cloud}"
ROOT="/srv/driving"
SHA="$(git rev-parse --short HEAD)$( [ -n "$(git status --porcelain)" ] && echo "-dirty" || true )"
RELEASE="${ROOT}/releases/${SHA}"
COMPOSER_AUTH_LOCAL="${COMPOSER_AUTH_LOCAL:-$HOME/.config/composer/auth.json}"
BOOTSTRAP=0

[ "${1:-}" = "--bootstrap" ] && BOOTSTRAP=1

say() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }

if [ ! -f "$COMPOSER_AUTH_LOCAL" ]; then
    echo "Missing $COMPOSER_AUTH_LOCAL - the NativePHP Composer credentials are required to build." >&2
    exit 1
fi

if [ "$BOOTSTRAP" = "1" ]; then
    say "Bootstrapping ${ROOT} on ${HOST}"
    ssh "$HOST" "sudo mkdir -p ${ROOT}/releases && sudo chown -R \$(id -u):\$(id -g) ${ROOT}"
    ssh "$HOST" "docker network inspect driving_edge >/dev/null 2>&1 || docker network create driving_edge"
    ssh "$HOST" "docker network connect driving_edge hackerman-caddy 2>/dev/null || true"

    # The application key and any mail credentials live only on the server.
    ssh "$HOST" "test -f ${ROOT}/.env" || {
        say "Writing ${ROOT}/.env (APP_KEY generated on the server)"
        ssh "$HOST" "umask 077 && cat > ${ROOT}/.env" < deploy/env.production.example
        KEY="base64:$(head -c 32 /dev/urandom | base64)"
        ssh "$HOST" "printf 'APP_KEY=%s\n' '$KEY' >> ${ROOT}/.env && chmod 600 ${ROOT}/.env"
    }
fi

say "Syncing working tree to ${RELEASE}"
ssh "$HOST" "mkdir -p ${RELEASE}"
rsync -az --delete \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude 'vendor' \
    --exclude 'public/build' \
    --exclude 'public/hot' \
    --exclude '.env' \
    --exclude 'auth.json' \
    --exclude 'credentials' \
    --exclude 'nativephp/android' \
    --exclude 'nativephp/ios' \
    --exclude 'database/database.sqlite' \
    ./ "${HOST}:${RELEASE}/"

say "Uploading build credentials (build-time secret, never written to a layer)"
ssh "$HOST" "umask 077 && cat > ${RELEASE}/.composer-auth.json" < "$COMPOSER_AUTH_LOCAL"

say "Building driving-web:${SHA} on ${HOST}"
ssh "$HOST" "cd ${RELEASE} && DOCKER_BUILDKIT=1 docker build \
    --secret id=composer_auth,src=${RELEASE}/.composer-auth.json \
    -t driving-web:${SHA} -t driving-web:current ."

ssh "$HOST" "shred -u ${RELEASE}/.composer-auth.json 2>/dev/null || rm -f ${RELEASE}/.composer-auth.json"

say "Starting the stack"
ssh "$HOST" "cd ${RELEASE} && RELEASE_SHA=${SHA} docker compose -p driving -f deploy/compose.prod.yaml up -d --remove-orphans"

say "Waiting for the health check"
ssh "$HOST" "for i in \$(seq 1 40); do
    state=\$(docker inspect -f '{{.State.Health.Status}}' driving-web 2>/dev/null || echo starting)
    [ \"\$state\" = healthy ] && echo healthy && exit 0
    [ \"\$state\" = unhealthy ] && docker logs --tail 50 driving-web && exit 1
    sleep 3
done; echo 'timed out waiting for health'; docker logs --tail 50 driving-web; exit 1"

say "Deployed ${SHA}. Reload the edge if the Caddyfile changed:"
echo "    ssh ${HOST} 'docker exec hackerman-caddy caddy reload --config /etc/caddy/Caddyfile'"
