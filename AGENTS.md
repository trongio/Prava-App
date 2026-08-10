<laravel-boost-guidelines>
=== foundation rules ===

# Laravel Boost Guidelines

The Laravel Boost guidelines are specifically curated by Laravel maintainers for this application. These guidelines should be followed closely to ensure the best experience when building Laravel applications.

## Foundational Context

This application is a Laravel application running on PHP 8.3. You are an expert with the Laravel ecosystem. Always use the APIs that match the installed major version of each package — do not assume a version.

Before relying on a package's API, confirm its installed version:
- PHP packages: run `composer show --direct` to list direct dependencies with versions, or `composer show <vendor/package>` for a single package.
- JS packages: check `package.json` for the installed versions.

## Skills Activation

This project has domain-specific skills available in `**/skills/**`. You MUST activate the relevant skill whenever you work in that domain—don't wait until you're stuck.

## Conventions

- You must follow all existing code conventions used in this application. When creating or editing a file, check sibling files for the correct structure, approach, and naming.
- Use descriptive names for variables and methods. For example, `isRegisteredForDiscounts`, not `discount()`.
- Check for existing components to reuse before writing a new one.

## Verification Scripts

- Do not create verification scripts or tinker when tests cover that functionality and prove they work. Unit and feature tests are more important.

## Application Structure & Architecture

- Stick to existing directory structure; don't create new base folders without approval.
- Do not change the application's dependencies without approval.

## Frontend Bundling

- If the user doesn't see a frontend change reflected in the UI, it could mean they need to run `npm run build`, `npm run dev`, or `composer run dev`. Ask them.

## Documentation Files

- You must only create documentation files if explicitly requested by the user.

## Replies

- Be concise in your explanations - focus on what's important rather than explaining obvious details.

=== boost rules ===

# Laravel Boost

## Tools

- Laravel Boost is an MCP server with tools designed specifically for this application. Prefer Boost tools over manual alternatives like shell commands or file reads.
- Use `database-query` to run read-only queries against the database instead of writing raw SQL in tinker.
- Use `database-schema` to inspect table structure before writing migrations or models.
- Use `get-absolute-url` to resolve the correct scheme, domain, and port for project URLs. Always use this before sharing a URL with the user.
- Use `browser-logs` to read browser logs, errors, and exceptions. Only recent logs are useful, ignore old entries.

## Searching Documentation (IMPORTANT)

- Always use `search-docs` before making code changes. Do not skip this step. It returns version-specific docs based on installed packages automatically.
- Pass a `packages` array to scope results when you know which packages are relevant.
- Use multiple broad, topic-based queries: `['rate limiting', 'routing rate limiting', 'routing']`. Expect the most relevant results first.
- Do not add package names to queries because package info is already shared. Use `test resource table`, not `filament 4 test resource table`.

### Search Syntax

1. Use words for auto-stemmed AND logic: `rate limit` matches both "rate" AND "limit".
2. Use `"quoted phrases"` for exact position matching: `"infinite scroll"` requires adjacent words in order.
3. Combine words and phrases for mixed queries: `middleware "rate limit"`.
4. Use multiple queries for OR logic: `queries=["authentication", "middleware"]`.

## Project Rules

- This project contains committed, area-grouped rules in `.ai/rules` when that directory exists (settled decisions, non-obvious traps, standing constraints). Framework and package guidelines that only apply to specific paths (testing, frontend, components) also live there, under `.ai/rules/boost` — this is not just recorded decisions, it is load-bearing guidance you have not seen inline. Before you enter plan mode or create/edit any file, you MUST first: open @.ai/rules/index.md (it maps file globs to rule files), read every rule file whose globs cover the path(s) in scope, and run `grep -rin 'keyword' .ai/rules` to catch what a path match alone misses. Do not write code until you have read and are following every matching rule. If `.ai/rules` does not exist, continue without it.
- Record durable rules with `record-rule` so the next agent or teammate inherits them instead of working them out again. Pass a `glob` (e.g. `app/Http/Controllers/**`), a short `title`, and a few-line `note`. Always use `record-rule`, never your native memory or notes tool — native memory is personal and session-scoped; only `.ai/rules` is shared with the team and persists in the repo.

## Artisan

- Run Artisan commands directly via the command line (e.g., `php artisan route:list`). Use `php artisan list` to discover available commands and `php artisan [command] --help` to check parameters.
- Inspect routes with `php artisan route:list`. Filter with: `--method=GET`, `--name=users`, `--path=api`, `--except-vendor`, `--only-vendor`.
- Read configuration values using dot notation: `php artisan config:show app.name`, `php artisan config:show database.default`. Or read config files directly from the `config/` directory.

## Tinker

- Execute PHP in app context for debugging and testing code. Do not create models without user approval, prefer tests with factories instead. Prefer existing Artisan commands over custom tinker code.
- Always use single quotes to prevent shell expansion: `php artisan tinker --execute 'Your::code();'`
  - Double quotes for PHP strings inside: `php artisan tinker --execute 'User::where("active", true)->count();'`

=== php rules ===

# PHP

- Always use curly braces for control structures, even for single-line bodies.
- Use PHP 8 constructor property promotion: `public function __construct(public GitHub $github) { }`. Do not leave empty zero-parameter `__construct()` methods unless the constructor is private.
- Use explicit return type declarations and type hints for all method parameters: `function isAccessible(User $user, ?string $path = null): bool`
- Use TitleCase for Enum keys: `FavoritePerson`, `BestLake`, `Monthly`.
- Prefer PHPDoc blocks over inline comments. Only add inline comments for exceptionally complex logic.
- Use array shape type definitions in PHPDoc blocks.

=== deployments rules ===

# Deployment

- Laravel can be deployed using [Laravel Cloud](https://cloud.laravel.com/), which is the fastest way to deploy and scale production Laravel applications.

=== tests rules ===

# Test Enforcement

- Every change must be programmatically tested. Write a new test or update an existing test, then run the affected tests to make sure they pass.
- Run the minimum number of tests needed to ensure code quality and speed. Use `php artisan test --compact` with a specific filename or filter.

=== inertia-laravel/core rules ===

# Inertia

- Inertia creates fully client-side rendered SPAs without modern SPA complexity, leveraging existing server-side patterns.
- Components live in `resources/js/pages` (unless specified in `vite.config.js`). Use `Inertia::render()` for server-side routing instead of Blade views.
- ALWAYS use `search-docs` tool for version-specific Inertia documentation and updated code examples.
- IMPORTANT: Activate `inertia-react-development` when working with Inertia client-side patterns.

# Inertia v2

- Use all Inertia features from v1 and v2. Check the documentation before making changes to ensure the correct approach.
- New features: deferred props, infinite scroll, merging props, polling, prefetching, once props, flash data.
- When using deferred props, add an empty state with a pulsing or animated skeleton.

=== laravel/core rules ===

# Do Things the Laravel Way

- Use `php artisan make:` commands to create new files (i.e. migrations, controllers, models, etc.). You can list available Artisan commands using `php artisan list` and check their parameters with `php artisan [command] --help`.
- If you're creating a generic PHP class, use `php artisan make:class`.
- Pass `--no-interaction` to all Artisan commands to ensure they work without user input. You should also pass the correct `--options` to ensure correct behavior.

### Model Creation

- When creating new models, create useful factories and seeders for them too. Ask the user if they need any other things, using `php artisan make:model --help` to check the available options.

## APIs & Eloquent Resources

- For APIs, default to using Eloquent API Resources and API versioning unless existing API routes do not, then you should follow existing application convention.

## URL Generation

- When generating links to other pages, prefer named routes and the `route()` function.

## Testing

- When creating models for tests, use the factories for the models. Check if the factory has custom states that can be used before manually setting up the model.
- Faker: Use methods such as `$this->faker->word()` or `fake()->randomDigit()`. Follow existing conventions whether to use `$this->faker` or `fake()`.
- When creating tests, make use of `php artisan make:test [options] {name}` to create a feature test, and pass `--unit` to create a unit test. Most tests should be feature tests.

## Vite Error

- If you receive an "Illuminate\Foundation\ViteException: Unable to locate file in Vite manifest" error, you can run `npm run build` or ask the user to run `npm run dev` or `composer run dev`.

=== laravel/v12 rules ===

# Laravel 12

- CRITICAL: ALWAYS use `search-docs` tool for version-specific Laravel documentation and updated code examples.
- Since Laravel 11, Laravel has a new streamlined file structure which this project uses.

## Laravel 12 Structure

- In Laravel 12, middleware are no longer registered in `app/Http/Kernel.php`.
- Middleware are configured declaratively in `bootstrap/app.php` using `Application::configure()->withMiddleware()`.
- `bootstrap/app.php` is the file to register middleware, exceptions, and routing files.
- `bootstrap/providers.php` contains application specific service providers.
- The `app/Console/Kernel.php` file no longer exists; use `bootstrap/app.php` or `routes/console.php` for console configuration.
- Console commands in `app/Console/Commands/` are automatically available and do not require manual registration.

## Database

- When modifying a column, the migration must include all of the attributes that were previously defined on the column. Otherwise, they will be dropped and lost.

- Laravel 12 allows limiting eagerly loaded records natively, without external packages: `$query->latest()->limit(10);`.

### Models

- Casts can and likely should be set in a `casts()` method on a model rather than the `$casts` property. Follow existing conventions from other models.

=== wayfinder/core rules ===

# Laravel Wayfinder

Use Wayfinder to generate TypeScript functions for Laravel routes. Import from `@/actions/` (controllers) or `@/routes/` (named routes).

=== pint/core rules ===

# Laravel Pint Code Formatter

- If you have modified any PHP files, you must run `vendor/bin/pint --dirty --format agent` before finalizing changes to ensure your code matches the project's expected style.
- Do not run `vendor/bin/pint --test --format agent`, simply run `vendor/bin/pint --format agent` to fix any formatting issues.

=== pest/core rules ===

## Pest

- This project uses Pest for testing. Create tests: `php artisan make:test --pest {name}`.
- The `{name}` argument should not include the test suite directory. Use `php artisan make:test --pest SomeFeatureTest` instead of `php artisan make:test --pest Feature/SomeFeatureTest`.
- Run tests: `php artisan test --compact` or filter: `php artisan test --compact --filter=testName`.
- Do NOT delete tests without approval.

=== inertia-react/core rules ===

# Inertia + React

- IMPORTANT: Activate `inertia-react-development` when working with Inertia React client-side patterns.

=== nativephp/mobile/core rules ===

## NativePHP Mobile

- NativePHP Mobile is a Laravel package that enables developers to build native iOS and Android applications using PHP and native UI components.
- NativePHP Mobile runs a full PHP runtime directly on the device with SQLite — no web server required.
- NativePHP Mobile supports **two frontend approaches**: Livewire/Blade (PHP) or JavaScript frameworks (Vue, React, Inertia, etc.).
- NativePHP Mobile documentation is hosted at `https://nativephp.com/docs/mobile/2/**`
- **Before implementing any features using NativePHP Mobile, use the `web-search` tool to get the latest docs for that specific feature. The docs listing is available in <available-docs>**

### Identifying the Development Environment

**IMPORTANT:** Before running commands or giving platform-specific advice, determine:

1. **Operating System** (check with system info or ask):
   - **macOS**: Can build and run for **both iOS and Android**
   - **Windows/Linux**: Can **only build for Android** — iOS requires macOS with Xcode
   - When on Windows/Linux, never suggest `php artisan native:run ios`, `native:install ios`, or `native:open ios`
   - **Note:** WSL (Windows Subsystem for Linux) is NOT supported — must run directly on Windows

2. **Frontend Stack** (examine the codebase):
   - **Livewire/Blade**: Look for `.blade.php` files with `wire:` directives, Livewire components in `app/Livewire/`
   - **JavaScript (Vue/React/Inertia)**: Look for `.vue`, `.jsx`, `.tsx` files, `resources/js/` with framework code, `inertiajs` in `package.json`

### Required Environment Variables

**CRITICAL:** Before running `php artisan native:install`, ensure these are set in `.env`:

```dotenv
NATIVEPHP_APP_ID=com.yourcompany.yourapp
NATIVEPHP_APP_VERSION="DEBUG"
NATIVEPHP_APP_VERSION_CODE="1"
```

- `NATIVEPHP_APP_ID`: Reverse-domain app identifier (e.g., `com.acme.myapp`) — **required**
- `NATIVEPHP_APP_VERSION`: Use `"DEBUG"` for development, semantic version (e.g., `"1.0.0"`) for production
- `NATIVEPHP_APP_VERSION_CODE`: Integer build number for Play Store (increment with each release)

**Optional but recommended for iOS:**
```dotenv
NATIVEPHP_DEVELOPMENT_TEAM=XXXXXXXXXX
```
Find your Team ID in your [Apple Developer account](https://developer.apple.com/account) under 'Membership details'.

### PHP Usage (Livewire/Blade Projects)

Use PHP Facades in the `Native\Mobile\Facades` namespace:
- `Camera::getPhoto()`, `Dialog::toast()`, `Biometrics::prompt()`, `Scanner::scan()`, etc.
- All Facades: `Camera`, `Microphone`, `Dialog`, `Scanner`, `Biometrics`, `PushNotifications`, `Geolocation`, `Network`, `Browser`, `SecureStorage`, `File`, `Share`, `Haptics`, `System`, `Device`
- Listen for events with `#[OnNative(EventClass::class)]` attribute on Livewire component methods
- Use EDGE components in Blade templates for native UI (`native:bottom-nav`, `native:top-bar`, `native:side-nav`)

### JavaScript Usage (Vue/React/Inertia Projects)

Import from the NativePHP JavaScript bridge library:
```javascript
import { camera, dialog, scanner, biometric, on, Events } from '#nativephp';
// or individual imports
import { getPhoto, alert, scanQR } from '#nativephp';
```

The JS API mirrors the PHP Facades with fluent builders:
- `await camera.getPhoto()` / `await dialog.alert('Title', 'Message')` / `await scanner.scan()`
- `await biometric.prompt().id('auth-check')` — fluent builder pattern
- `await scanner.scan().prompt('Scan ticket').formats(['qr', 'ean13'])`

Listen for events with `on()` and `off()`:
```javascript
import { on, off, Events } from '#nativephp';
on(Events.Camera.PhotoTaken, (payload) => { /* handle photo */ });
// Cleanup in unmount: off(Events.Camera.PhotoTaken, handler);
```

### Event Handling (Both Stacks)

Asynchronous operations dispatch events to both JavaScript and PHP simultaneously.

**Livewire/Blade:**
```php
use Native\Mobile\Attributes\OnNative;
use Native\Mobile\Events\Camera\PhotoTaken;

#[OnNative(PhotoTaken::class)]
public function handlePhoto(string $path) { /* ... */ }
```

**JavaScript (Vue/React):**
```javascript
import { on, Events } from '#nativephp';
on(Events.Camera.PhotoTaken, ({ path }) => { /* ... */ });
```

Custom events can extend built-in events and be passed via `->event(CustomEvent::class)` (PHP) or `.event('App\\Events\\Custom')` (JS).

### EDGE Components (Native UI)

- EDGE (Element Definition and Generation Engine) renders Blade components as truly native UI elements.
- Components use `native:` prefix: `native:bottom-nav`, `native:top-bar`, `native:side-nav`.
- Child items require unique `id` attributes for lifecycle management.
- Add `nativephp-safe-area` class to body for proper handling of notches and navigation areas.
- **Note:** EDGE components are defined in Blade templates and work with both Livewire and Inertia apps (the layout is still Blade).

<available-docs>

## Getting Started

- [https://nativephp.com/docs/mobile/2/getting-started/introduction] Use these docs for comprehensive introduction to NativePHP Mobile, overview of how PHP runs natively on device, the embedded runtime architecture, and core philosophy behind the package
- [https://nativephp.com/docs/mobile/2/getting-started/quick-start] Use these docs for rapid setup guide to get your first mobile app running in minutes
- [https://nativephp.com/docs/mobile/2/getting-started/environment-setup] Use these docs for setting up your development environment including Xcode, Android Studio, simulators, and required dependencies
- [https://nativephp.com/docs/mobile/2/getting-started/installation] Use these docs for step-by-step installation via Composer, running `php artisan native:install`, platform-specific setup, and ICU support options
- [https://nativephp.com/docs/mobile/2/getting-started/configuration] Use these docs for detailed configuration guide including NATIVEPHP_APP_ID, NATIVEPHP_APP_VERSION, permissions setup, and config/nativephp.php options
- [https://nativephp.com/docs/mobile/2/getting-started/development] Use these docs for development workflow including `php artisan native:run`, `native:watch` for hot reload, `native:tail` for logs, and debugging techniques
- [https://nativephp.com/docs/mobile/2/getting-started/deployment] Use these docs for packaging and deploying apps to App Store and Play Store using `php artisan native:package`
- [https://nativephp.com/docs/mobile/2/getting-started/versioning] Use these docs for version management, semantic versioning, and `php artisan native:release` command
- [https://nativephp.com/docs/mobile/2/getting-started/changelog] Use these docs for version history and release notes
- [https://nativephp.com/docs/mobile/2/getting-started/roadmap] Use these docs for upcoming features and planned improvements
- [https://nativephp.com/docs/mobile/2/getting-started/support-policy] Use these docs for support policy and compatibility information

## The Basics

- [https://nativephp.com/docs/mobile/2/the-basics/overview] Use these docs for understanding how NativePHP Mobile works, the bridge between PHP and native code, and the overall architecture
- [https://nativephp.com/docs/mobile/2/the-basics/events] Use these docs for the complete event system guide including async vs sync operations, event handling in Livewire with `#[OnNative()]`, JavaScript event handling with `Native.on()`, custom events, and the dual dispatch pattern
- [https://nativephp.com/docs/mobile/2/the-basics/native-functions] Use these docs for understanding the `nativephp_call()` function, the bridge function registry, and how to extend native functionality
- [https://nativephp.com/docs/mobile/2/the-basics/native-components] Use these docs for overview of native UI components and how they integrate with your app
- [https://nativephp.com/docs/mobile/2/the-basics/web-view] Use these docs for understanding the web view rendering, JavaScript bridge, and how PHP content is displayed
- [https://nativephp.com/docs/mobile/2/the-basics/splash-screens] Use these docs for configuring splash screens on iOS and Android
- [https://nativephp.com/docs/mobile/2/the-basics/app-icon] Use these docs for setting up app icons for both platforms
- [https://nativephp.com/docs/mobile/2/the-basics/assets] Use these docs for managing static assets, images, and files in your mobile app

## EDGE Components (Native UI)

- [https://nativephp.com/docs/mobile/2/edge-components/introduction] Use these docs for understanding EDGE (Element Definition and Generation Engine), how Blade components become native UI, server-driven UI approach, and the JSON compilation process
- [https://nativephp.com/docs/mobile/2/edge-components/bottom-nav] Use these docs for implementing bottom navigation bars with `native:bottom-nav` and `native:bottom-nav-item`, including icons, labels, URLs, and styling
- [https://nativephp.com/docs/mobile/2/edge-components/top-bar] Use these docs for implementing top app bars with `native:top-bar` and `native:top-bar-action`, including titles, navigation icons, and action buttons
- [https://nativephp.com/docs/mobile/2/edge-components/side-nav] Use these docs for implementing slide-out navigation drawers with `native:side-nav`, `native:side-nav-item`, `native:side-nav-header`, and `native:side-nav-group`
- [https://nativephp.com/docs/mobile/2/edge-components/icons] Use these docs for available icon names and how to use icons in EDGE components

## APIs (Device Features)

- [https://nativephp.com/docs/mobile/2/apis/camera] Use these docs for camera operations including `Camera::getPhoto()`, `Camera::recordVideo()`, `Camera::pickImages()`, PhotoTaken and VideoRecorded events
- [https://nativephp.com/docs/mobile/2/apis/microphone] Use these docs for audio recording with `Microphone::record()`, `->start()`, `->stop()`, `->pause()`, `->resume()`, `->getStatus()`, and MicrophoneRecorded events
- [https://nativephp.com/docs/mobile/2/apis/scanner] Use these docs for QR code and barcode scanning with `Scanner::scan()`, fluent configuration, CodeScanned events, and supported formats
- [https://nativephp.com/docs/mobile/2/apis/dialog] Use these docs for native dialogs with `Dialog::alert()`, `Dialog::toast()`, button configuration, and ButtonPressed events
- [https://nativephp.com/docs/mobile/2/apis/biometrics] Use these docs for Face ID/Touch ID authentication with `Biometrics::prompt()`, fluent API, and Completed events
- [https://nativephp.com/docs/mobile/2/apis/push-notifications] Use these docs for push notification enrollment with `PushNotifications::enroll()`, `->getToken()`, and TokenGenerated events
- [https://nativephp.com/docs/mobile/2/apis/geolocation] Use these docs for location services with `Geolocation::getCurrentPosition()`, `->checkPermissions()`, `->requestPermissions()`, and LocationReceived events
- [https://nativephp.com/docs/mobile/2/apis/browser] Use these docs for opening URLs with `Browser::open()`, `Browser::inApp()`, `Browser::auth()` for OAuth flows
- [https://nativephp.com/docs/mobile/2/apis/secure-storage] Use these docs for secure credential storage with `SecureStorage::get()`, `->set()`, `->delete()` using device Keychain/KeyStore
- [https://nativephp.com/docs/mobile/2/apis/share] Use these docs for native share sheet with `Share::url()` and `Share::file()`
- [https://nativephp.com/docs/mobile/2/apis/file] Use these docs for file operations with `File::move()` and `File::copy()`
- [https://nativephp.com/docs/mobile/2/apis/network] Use these docs for network status checking with `Network::status()`
- [https://nativephp.com/docs/mobile/2/apis/haptics] Use these docs for haptic feedback with `Haptics::vibrate()` (prefer `Device::vibrate()`)
- [https://nativephp.com/docs/mobile/2/apis/device] Use these docs for device information with `Device::getId()`, `->getInfo()`, `->getBatteryInfo()`, `->vibrate()`, `->toggleFlashlight()`
- [https://nativephp.com/docs/mobile/2/apis/system] Use these docs for platform detection with `System::isIos()`, `System::isAndroid()`, `System::isMobile()`, `System::flashlight()`

## Concepts

- [https://nativephp.com/docs/mobile/2/concepts/databases] Use these docs for SQLite database usage, local data storage, and when to use local vs API storage
- [https://nativephp.com/docs/mobile/2/concepts/deep-links] Use these docs for configuring deep links, URL schemes, and universal links
- [https://nativephp.com/docs/mobile/2/concepts/push-notifications] Use these docs for comprehensive push notification setup including Firebase, APNs, and server-side integration
- [https://nativephp.com/docs/mobile/2/concepts/security] Use these docs for security best practices, secure storage, and protecting sensitive data
- [https://nativephp.com/docs/mobile/2/concepts/ci-cd] Use these docs for continuous integration and deployment pipelines for mobile apps
</available-docs>

</laravel-boost-guidelines>
