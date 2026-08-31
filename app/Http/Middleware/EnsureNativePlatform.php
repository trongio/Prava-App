<?php

namespace App\Http\Middleware;

use App\Support\Platform;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks routes that only make sense inside the device app (device
 * filesystem access, the Play Store review prompt) when the same codebase
 * is served on the public web.
 */
class EnsureNativePlatform
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_if(Platform::isWeb(), 404);

        return $next($request);
    }
}
