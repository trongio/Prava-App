<laravel-boost-guidelines>
=== foundation rules ===

# Laravel Boost Guidelines

The Laravel Boost guidelines are specifically curated by Laravel maintainers for this application. These guidelines should be followed closely to ensure the best experience when building Laravel applications.

## Foundational Context

This application is a Laravel application and its main Laravel ecosystems package & versions are below. You are an expert with them all. Ensure you abide by these specific packages & versions.

- php - 8.3.30
- inertiajs/inertia-laravel (INERTIA) - v2
- laravel/fortify (FORTIFY) - v1
- laravel/framework (LARAVEL) - v12
- laravel/prompts (PROMPTS) - v0
- laravel/sanctum (SANCTUM) - v4
- laravel/wayfinder (WAYFINDER) - v0
- laravel/mcp (MCP) - v0
- laravel/pint (PINT) - v1
- laravel/sail (SAIL) - v1
- pestphp/pest (PEST) - v4
- phpunit/phpunit (PHPUNIT) - v12
- @inertiajs/react (INERTIA) - v2
- react (REACT) - v19
- tailwindcss (TAILWINDCSS) - v4
- @laravel/vite-plugin-wayfinder (WAYFINDER) - v0
- eslint (ESLINT) - v9
- prettier (PRETTIER) - v3

## Skills Activation

This project has domain-specific skills available. You MUST activate the relevant skill whenever you work in that domain—don't wait until you're stuck.

- `wayfinder-development` — Activates whenever referencing backend routes in frontend components. Use when importing from @/actions or @/routes, calling Laravel routes from TypeScript, or working with Wayfinder route functions.
- `pest-testing` — Tests applications using the Pest 4 PHP framework. Activates when writing tests, creating unit or feature tests, adding assertions, testing Livewire components, browser testing, debugging test failures, working with datasets or mocking; or when the user mentions test, spec, TDD, expects, assertion, coverage, or needs to verify functionality works.
- `inertia-react-development` — Develops Inertia.js v2 React client-side applications. Activates when creating React pages, forms, or navigation; using &lt;Link&gt;, &lt;Form&gt;, useForm, or router; working with deferred props, prefetching, or polling; or when user mentions React with Inertia, React pages, React forms, or React navigation.
- `tailwindcss-development` — Styles applications using Tailwind CSS v4 utilities. Activates when adding styles, restyling components, working with gradients, spacing, layout, flex, grid, responsive design, dark mode, colors, typography, or borders; or when the user mentions CSS, styling, classes, Tailwind, restyle, hero section, cards, buttons, or any visual/UI changes.

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

- Laravel Boost is an MCP server that comes with powerful tools designed specifically for this application. Use them.

## Artisan

- Use the `list-artisan-commands` tool when you need to call an Artisan command to double-check the available parameters.

## URLs

- Whenever you share a project URL with the user, you should use the `get-absolute-url` tool to ensure you're using the correct scheme, domain/IP, and port.

## Tinker / Debugging

- You should use the `tinker` tool when you need to execute PHP to debug code or query Eloquent models directly.
- Use the `database-query` tool when you only need to read from the database.

## Reading Browser Logs With the `browser-logs` Tool

- You can read browser logs, errors, and exceptions using the `browser-logs` tool from Boost.
- Only recent browser logs will be useful - ignore old logs.

## Searching Documentation (Critically Important)

- Boost comes with a powerful `search-docs` tool you should use before trying other approaches when working with Laravel or Laravel ecosystem packages. This tool automatically passes a list of installed packages and their versions to the remote Boost API, so it returns only version-specific documentation for the user's circumstance. You should pass an array of packages to filter on if you know you need docs for particular packages.
- Search the documentation before making code changes to ensure we are taking the correct approach.
- Use multiple, broad, simple, topic-based queries at once. For example: `['rate limiting', 'routing rate limiting', 'routing']`. The most relevant results will be returned first.
- Do not add package names to queries; package information is already shared. For example, use `test resource table`, not `filament 4 test resource table`.

### Available Search Syntax

1. Simple Word Searches with auto-stemming - query=authentication - finds 'authenticate' and 'auth'.
2. Multiple Words (AND Logic) - query=rate limit - finds knowledge containing both "rate" AND "limit".
3. Quoted Phrases (Exact Position) - query="infinite scroll" - words must be adjacent and in that order.
4. Mixed Queries - query=middleware "rate limit" - "middleware" AND exact phrase "rate limit".
5. Multiple Queries - queries=["authentication", "middleware"] - ANY of these terms.

=== php rules ===

# PHP

- Always use curly braces for control structures, even for single-line bodies.

## Constructors

- Use PHP 8 constructor property promotion in `__construct()`.
    - <code-snippet>public function __construct(public GitHub $github) { }</code-snippet>
- Do not allow empty `__construct()` methods with zero parameters unless the constructor is private.

## Type Declarations

- Always use explicit return type declarations for methods and functions.
- Use appropriate PHP type hints for method parameters.

<code-snippet name="Explicit Return Types and Method Params" lang="php">
protected function isAccessible(User $user, ?string $path = null): bool
{
    ...
}
</code-snippet>

## Enums

- Typically, keys in an Enum should be TitleCase. For example: `FavoritePerson`, `BestLake`, `Monthly`.

## Comments

- Prefer PHPDoc blocks over inline comments. Never use comments within the code itself unless the logic is exceptionally complex.

## PHPDoc Blocks

- Add useful array shape type definitions when appropriate.

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

=== inertia-laravel/v2 rules ===

# Inertia v2

- Use all Inertia features from v1 and v2. Check the documentation before making changes to ensure the correct approach.
- New features: deferred props, infinite scrolling (merging props + `WhenVisible`), lazy loading on scroll, polling, prefetching.
- When using deferred props, add an empty state with a pulsing or animated skeleton.

=== laravel/core rules ===

# Do Things the Laravel Way

- Use `php artisan make:` commands to create new files (i.e. migrations, controllers, models, etc.). You can list available Artisan commands using the `list-artisan-commands` tool.
- If you're creating a generic PHP class, use `php artisan make:class`.
- Pass `--no-interaction` to all Artisan commands to ensure they work without user input. You should also pass the correct `--options` to ensure correct behavior.

## Database

- Always use proper Eloquent relationship methods with return type hints. Prefer relationship methods over raw queries or manual joins.
- Use Eloquent models and relationships before suggesting raw database queries.
- Avoid `DB::`; prefer `Model::query()`. Generate code that leverages Laravel's ORM capabilities rather than bypassing them.
- Generate code that prevents N+1 query problems by using eager loading.
- Use Laravel's query builder for very complex database operations.

### Model Creation

- When creating new models, create useful factories and seeders for them too. Ask the user if they need any other things, using `list-artisan-commands` to check the available options to `php artisan make:model`.

### APIs & Eloquent Resources

- For APIs, default to using Eloquent API Resources and API versioning unless existing API routes do not, then you should follow existing application convention.

## Controllers & Validation

- Always create Form Request classes for validation rather than inline validation in controllers. Include both validation rules and custom error messages.
- Check sibling Form Requests to see if the application uses array or string based validation rules.

## Authentication & Authorization

- Use Laravel's built-in authentication and authorization features (gates, policies, Sanctum, etc.).

## URL Generation

- When generating links to other pages, prefer named routes and the `route()` function.

## Queues

- Use queued jobs for time-consuming operations with the `ShouldQueue` interface.

## Configuration

- Use environment variables only in configuration files - never use the `env()` function directly outside of config files. Always use `config('app.name')`, not `env('APP_NAME')`.

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
- The `app\Console\Kernel.php` file no longer exists; use `bootstrap/app.php` or `routes/console.php` for console configuration.
- Console commands in `app/Console/Commands/` are automatically available and do not require manual registration.

## Database

- When modifying a column, the migration must include all of the attributes that were previously defined on the column. Otherwise, they will be dropped and lost.
- Laravel 12 allows limiting eagerly loaded records natively, without external packages: `$query->latest()->limit(10);`.

### Models

- Casts can and likely should be set in a `casts()` method on a model rather than the `$casts` property. Follow existing conventions from other models.

=== wayfinder/core rules ===

# Laravel Wayfinder

Wayfinder generates TypeScript functions for Laravel routes. Import from `@/actions/` (controllers) or `@/routes/` (named routes).

- IMPORTANT: Activate `wayfinder-development` skill whenever referencing backend routes in frontend components.
- Invokable Controllers: `import StorePost from '@/actions/.../StorePostController'; StorePost()`.
- Parameter Binding: Detects route keys (`{post:slug}`) — `show({ slug: "my-post" })`.
- Query Merging: `show(1, { mergeQuery: { page: 2, sort: null } })` merges with current URL, `null` removes params.
- Inertia: Use `.form()` with `<Form>` component or `form.submit(store())` with useForm.

=== pint/core rules ===

# Laravel Pint Code Formatter

- You must run `vendor/bin/pint --dirty --format agent` before finalizing changes to ensure your code matches the project's expected style.
- Do not run `vendor/bin/pint --test --format agent`, simply run `vendor/bin/pint --format agent` to fix any formatting issues.

=== pest/core rules ===

## Pest

- This project uses Pest for testing. Create tests: `php artisan make:test --pest {name}`.
- Run tests: `php artisan test --compact` or filter: `php artisan test --compact --filter=testName`.
- Do NOT delete tests without approval.
- CRITICAL: ALWAYS use `search-docs` tool for version-specific Pest documentation and updated code examples.
- IMPORTANT: Activate `pest-testing` every time you're working with a Pest or testing-related task.

=== inertia-react/core rules ===

# Inertia + React

- IMPORTANT: Activate `inertia-react-development` when working with Inertia React client-side patterns.

=== tailwindcss/core rules ===

# Tailwind CSS

- Always use existing Tailwind conventions; check project patterns before adding new ones.
- IMPORTANT: Always use `search-docs` tool for version-specific Tailwind CSS documentation and updated code examples. Never rely on training data.
- IMPORTANT: Activate `tailwindcss-development` every time you're working with a Tailwind CSS or styling-related task.

=== nativephp/mobile rules ===

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

Custom events can extend built-in events and be passed via `->event(CustomEvent::class)` (PHP) or `.event('App\Events\Custom')` (JS).

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
