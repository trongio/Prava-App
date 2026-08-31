# მართვის მოწმობა - Prava

Georgian driving-theory practice app: the full official question bank for every licence
category, per-category exam rules, road signs, and progress tracking. Built with Laravel 12
and React 19, and shipped three ways from one codebase: a native Android app, an installable
web app, and Windows/Linux desktop builds.

<p align="center">
  <a href="https://play.google.com/store/apps/details?id=com.prava.trongio">
    <img src="docs/play-store-qr.png" alt="Scan to install from Google Play" width="180">
  </a>
</p>

<p align="center">
  <a href="https://play.google.com/store/apps/details?id=com.prava.trongio"><b>Get it on Google Play</b></a><br>
  <sub>or scan the code above</sub>
</p>

<p align="center">
  <b><a href="https://driving.hackerman.ge">Try it in your browser at driving.hackerman.ge</a></b><br>
  <sub>no account needed - there is a guest mode</sub>
</p>

## Where it runs

| Target | How it is built | Auth |
| --- | --- | --- |
| Android (Play Store) | `nativephp/mobile`, `APP_PLATFORM=native` | Pick a profile on the device; password optional |
| Web ([driving.hackerman.ge](https://driving.hackerman.ge)) | Docker + FrankenPHP, `APP_PLATFORM=web` | Fortify accounts, or a throwaway guest session |
| Windows / Linux | `nativephp/desktop` on the `desktop` branch | Same as Android |

`APP_PLATFORM` is what separates the first two. The device database belongs to one phone, so
picking a profile is the whole login there; on a shared server that same code would list every
account and sign in as any of them, so the web build registers Fortify instead and enforces
CSRF. See `app/Support/Platform.php` and `.ai/rules/routes.md`.

The web build is also an installable PWA: manifest, icons, and a service worker that caches
the question and sign images.

## Features

- The complete official question bank, covering B/B1, A/A1/A2, C/C1, D/D1, T/S, Tram, Mil and AM
- Per-category exam rules: each licence has its own question count, time limit and mistake allowance
- Practice by topic or by licence category, with bookmarks and notes
- Road sign reference with the questions that use each sign
- Test history and per-question progress, stored locally on the device

## Tech Stack

- **Backend**: Laravel 12, PHP 8.3
- **Frontend**: React 19, TypeScript, Inertia.js v2
- **Styling**: Tailwind CSS v4
- **Mobile**: NativePHP Mobile
- **Desktop**: NativePHP for Desktop (Electron), on the `desktop` branch
- **Web hosting**: Docker, FrankenPHP, Caddy
- **Authentication**: Laravel Fortify (registration, login, 2FA, password reset, email verification)
- **Database**: SQLite
- **Testing**: Pest v4

## Requirements

- PHP 8.3
- Node.js 18+ (22+ for the desktop branch)
- Composer
- Docker, for the web build only

## Installation

```bash
# Clone the repository
git clone https://github.com/trongio/Prava-App.git
cd Prava-App

# Run the setup script (installs dependencies, creates .env, runs migrations, builds assets)
composer run setup
```

Or manually:

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
npm install
npm run build
```

## Development

```bash
# Start all development services (server, queue, logs, vite)
composer run dev

# Or start with SSR support
composer run dev:ssr
```

This runs:
- Laravel development server
- Queue listener
- Log viewer (Pail)
- Vite dev server

## Testing

```bash
# Run all tests
php artisan test

# Run tests with compact output
php artisan test --compact

# Run specific test file
php artisan test tests/Feature/Auth/AuthenticationTest.php

# Filter by test name
php artisan test --filter=test_users_can_authenticate
```

## Code Quality

```bash
# Format PHP code
vendor/bin/pint

# Format only changed files
vendor/bin/pint --dirty

# Lint JavaScript/TypeScript
npm run lint

# Format frontend code
npm run format

# Type check
npm run types
```

## NativePHP Mobile

This app uses [NativePHP Mobile](https://nativephp.com) to compile to native iOS and Android apps.

### Requirements

- **iOS**: Xcode installed and configured
- **Android**: Android Studio with emulator set up
- **License**: Active NativePHP license required

### Configuration

Set your app ID in `.env` (use reverse domain notation, lowercase only):
```
NATIVEPHP_APP_ID=com.yourcompany.drivingtest
```

Configure mobile settings in `config/nativephp.php`:
- App version and version code
- Deeplink scheme and host
- Permissions (camera, biometric, push notifications, etc.)
- Orientation settings (portrait/landscape)

After changing permissions, run:
```bash
php artisan native:install --force
```

### Development Workflow

```bash
# Build assets for specific platform
npm run build -- --mode=ios
npm run build -- --mode=android

# Compile and run on simulator/emulator
php artisan native:run

# Or use the shorthand
php native run
./native run

# Run with hot reload (watches for file changes)
php artisan native:run --watch

# Or start watcher separately
php artisan native:watch

# Open project in Xcode or Android Studio
php artisan native:open
```

### Hot Module Replacement (HMR)

HMR is pre-configured in `vite.config.ts` with `nativephpHotFile()`. This enables live updates on real devices when connected to the same Wi-Fi network as your development machine.

For multi-platform development on macOS, run separate watchers in different terminals for iOS and Android simultaneously.

## Deploying the web build

The site runs on `aegis-cloud` as a Docker stack fronted by the existing `hackerman-caddy`
edge container. It publishes no host ports; the SQLite database and uploaded images live in
named volumes and survive every deploy.

```bash
# First time: create the network, /srv/driving and its .env (APP_KEY generated on the server)
deploy/deploy-web.sh --bootstrap

# Every deploy after that
deploy/deploy-web.sh
```

The server is arm64 and most workstations are not, so the image is built on the server rather
than pushed to it. The NativePHP Composer licence is passed in as a BuildKit secret and shredded
afterwards, so it never lands in an image layer.

Routing lives in `deploy/Caddyfile.snippet`, which belongs in the edge Caddyfile
(`/home/ubuntu/hackerman/Caddyfile`, repo `trongio/hackerman`). That file is baked into the
Caddy image, so a running container also needs a hot reload:

```bash
ssh aegis-cloud 'docker exec hackerman-caddy caddy reload --config /etc/caddy/Caddyfile'
```

Server-side configuration is documented in `deploy/env.production.example`. Note that
`APP_PLATFORM=web` there is what switches on Fortify, guest sessions and CSRF.

## Desktop (Windows / Linux)

`nativephp/desktop` declares an outright Composer conflict with `nativephp/mobile`, so the
desktop app cannot be a build flag: it lives on a generated `desktop` branch.

```bash
# Regenerate the branch from a clean HEAD
deploy/make-desktop-branch.sh

# ...and build the Linux artifacts as well (downloads Electron and a static PHP)
deploy/make-desktop-branch.sh --build
```

The script swaps the packages, drops the private NativePHP repository (the desktop package is
on Packagist, so no licence credentials are needed), points the `#nativephp` import at
`resources/js/native-shim.ts`, and removes the mobile Vite plugin.

Linux produces an AppImage and a `.deb`. Pass the architecture explicitly
(`php artisan native:build linux x64`): with no arch it builds both, and the AppImage
filename carries no architecture, so the second one silently overwrites the first.

Windows is built by the `windows-latest` job in `.github/workflows/desktop-build.yml`
rather than cross-compiled, which would need wine plus 32-bit NSIS.

## Project Structure

```
├── app/
│   ├── Actions/Fortify/      # Auth business logic
│   ├── Http/Controllers/     # Controllers
│   └── Providers/            # Service providers
├── resources/js/
│   ├── components/           # React components
│   │   └── ui/              # Reusable UI components
│   ├── layouts/             # Page layouts
│   ├── pages/               # Inertia pages
│   └── hooks/               # React hooks
├── routes/
│   ├── web.php              # Web routes (platform-dependent auth surface)
│   └── settings.php         # Settings routes
├── deploy/                  # Web deploy: Dockerfile inputs, compose, Caddy, scripts
├── .ai/rules/               # Settled decisions and non-obvious traps, per path
└── tests/
    ├── Feature/             # Feature tests
    ├── Web/                 # Feature tests that boot with APP_PLATFORM=web
    └── Unit/                # Unit tests
```

## License

MIT