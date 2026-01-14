# Driving Test App

A mobile driving test application built with Laravel 12, React 19, and NativePHP Mobile. This app can be compiled to native iOS and Android applications.

## Tech Stack

- **Backend**: Laravel 12, PHP 8.2+
- **Frontend**: React 19, TypeScript, Inertia.js v2
- **Styling**: Tailwind CSS v4
- **Mobile**: NativePHP Mobile
- **Authentication**: Laravel Fortify (registration, login, 2FA, password reset, email verification)
- **Database**: SQLite
- **Testing**: Pest v4

## Requirements

- PHP 8.2+
- Node.js 18+
- Composer

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/PHPNative-DrivingTest-app.git
cd PHPNative-DrivingTest-app

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
│   ├── web.php              # Web routes
│   └── settings.php         # Settings routes
└── tests/
    ├── Feature/             # Feature tests
    └── Unit/                # Unit tests
```

## License

MIT