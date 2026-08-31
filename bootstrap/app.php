<?php

use App\Http\Middleware\EnsureNativePlatform;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\ValidateCsrfTokenUnlessNative;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        // CSRF is skipped on the device build only. See the middleware for why
        // the blanket exemption cannot be allowed to reach the public web.
        $middleware->replace(ValidateCsrfToken::class, ValidateCsrfTokenUnlessNative::class);

        $middleware->alias([
            'native.only' => EnsureNativePlatform::class,
        ]);

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->redirectGuestsTo('/');

        // The web build sits behind the edge Caddy on a private Docker network
        // and publishes no host port, so every request genuinely arrives from
        // that proxy. Without this the forwarded scheme is ignored and Laravel
        // builds http:// URLs and non-secure cookies behind TLS. It cannot be
        // conditional on the platform: this callback runs before the config is
        // loaded, so config() is unavailable here. On the device there is no
        // proxy and nothing to forward, so trusting one costs nothing.
        $middleware->trustProxies(at: '*');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
