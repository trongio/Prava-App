#!/bin/sh
# Prepares the writable state that lives outside the image, then hands off to
# FrankenPHP. Everything here is idempotent: the container is restarted on
# every deploy and the volumes survive.
set -e

# The storage volume mounts over the tree Laravel expects to exist.
mkdir -p \
    /app/storage/app/public \
    /app/storage/framework/cache/data \
    /app/storage/framework/sessions \
    /app/storage/framework/views \
    /app/storage/logs

# public/storage is a symlink into the volume, so it has to be re-made whenever
# the image changes.
php /app/artisan storage:link --force

# The first migration seeds the question bank from the bundled seeded.sqlite
# when the database file is empty, so a fresh volume comes up populated.
php /app/artisan migrate --force --isolated

# Route caching is deliberately absent: routes/web.php registers closures,
# which Laravel cannot serialise. Config, events and views cover the rest.
php /app/artisan config:cache
php /app/artisan event:cache
php /app/artisan view:cache

exec docker-php-entrypoint "$@"
