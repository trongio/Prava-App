#!/usr/bin/env bash
#
# Creates (or refreshes) the `desktop` branch: the Windows/Linux variant of
# this app, built with NativePHP for Desktop.
#
# It has to be a separate branch rather than a build flag. nativephp/desktop
# declares an outright Composer conflict with nativephp/mobile, so the two can
# never be installed in the same tree:
#
#   nativephp/desktop[2.0.0, ..., 2.2.1] conflict with nativephp/mobile *
#
# Everything this script changes is mechanical, so the branch can be thrown
# away and regenerated from main whenever main moves.
#
#   deploy/make-desktop-branch.sh            # create/refresh from the current branch
#   deploy/make-desktop-branch.sh --build    # ...and build the Linux artifacts
#
set -euo pipefail

BASE="$(git rev-parse --abbrev-ref HEAD)"
BUILD=0
[ "${1:-}" = "--build" ] && BUILD=1

say() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }

if [ -n "$(git status --porcelain)" ]; then
    echo "Working tree is dirty. Commit or stash first: the desktop branch is generated from a clean HEAD." >&2
    exit 1
fi

say "Creating desktop branch from ${BASE}"
git switch -C desktop

# The private nativephp.composer.sh repository goes with the mobile package.
# Dropping it means the desktop branch needs no licence credentials at all,
# which is what lets CI build it on a clean runner.
say "Swapping nativephp/mobile for nativephp/desktop"
php -r '
$path = "composer.json";
$d = json_decode(file_get_contents($path), true);
unset($d["require"]["nativephp/mobile"], $d["repositories"]);
$d["require"]["nativephp/desktop"] = "^2.2";
file_put_contents($path, json_encode($d, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . PHP_EOL);
'
rm -f composer.lock
composer update --no-interaction --no-scripts

say "Pointing the #nativephp import at the shim"
php -r '
$path = "package.json";
$d = json_decode(file_get_contents($path), true);
$d["imports"]["#nativephp"] = "./resources/js/native-shim.ts";
file_put_contents($path, json_encode($d, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . PHP_EOL);
'

say "Removing the mobile Vite plugin"
php -r '
$path = "vite.config.ts";
$s = file_get_contents($path);
$s = str_replace("\nimport { nativephpMobile, nativephpHotFile } from \"./vendor/nativephp/mobile/resources/js/vite-plugin.js\";\n", "\n", $s);
$s = str_replace("\nimport { nativephpMobile, nativephpHotFile } from '"'"'./vendor/nativephp/mobile/resources/js/vite-plugin.js'"'"';\n", "\n", $s);
$s = str_replace("            hotFile: nativephpHotFile(),\n", "", $s);
$s = str_replace("        nativephpMobile(),\n", "", $s);
file_put_contents($path, $s);
'

say "Publishing the desktop scaffolding"
rm -f bootstrap/cache/*.php
composer dump-autoload -q
php artisan native:install --no-interaction
# The mobile config is still on disk from main and has entirely different keys,
# so it has to be replaced rather than skipped.
php artisan vendor:publish --tag=nativephp-config --force --no-interaction

say "Verifying the frontend still type-checks and builds"
npm install --no-audit --no-fund
npx tsc --noEmit
npm run build

if [ "$BUILD" = "1" ]; then
    # An explicit arch matters: with none, both are built and the AppImage
    # filename carries no architecture, so arm64 overwrites x64.
    say "Building the Linux x64 artifacts (downloads Electron and a static PHP, ~300MB)"
    php artisan native:build linux x64
    ls -la nativephp/electron/dist/ | grep -vE '^d|unpacked'
fi

say "Done. Review with 'git status', then commit on the desktop branch."
echo "    Windows needs wine plus 32-bit NSIS locally, or the windows-latest"
echo "    job in .github/workflows/desktop-build.yml."
