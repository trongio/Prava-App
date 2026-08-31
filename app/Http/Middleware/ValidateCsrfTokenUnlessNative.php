<?php

namespace App\Http\Middleware;

use App\Support\Platform;
use Closure;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * CSRF verification, skipped only on the device build.
 *
 * NativePHP's WebView has no CSRF token plumbing (the docs state outright that
 * no CSRF protection is available), and the app is a single origin on one
 * device, so there is no cross-site attacker to protect against there. On the
 * public web every one of these POST routes - login, register, guest sessions,
 * profile updates, account deletion - is forgeable without this check, so the
 * exemption must never follow the code onto the web.
 */
class ValidateCsrfTokenUnlessNative extends ValidateCsrfToken
{
    public function handle($request, Closure $next): Response
    {
        if (Platform::isNative()) {
            return $next($request);
        }

        return parent::handle($request, $next);
    }
}
