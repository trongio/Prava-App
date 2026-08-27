<?php

namespace App\Support;

/**
 * Thin wrapper over the Play in-app review bridge function.
 *
 * `Review.Request` is a local addition to the generated Android tree, applied
 * by scripts/patch-nativephp-android.py. It is deliberately optional: a build
 * without the patch, an iOS build, or the browser during development all fail
 * the check below and let the caller fall back to opening the store listing.
 */
class NativeReview
{
    /**
     * Ask Play to show the in-app review overlay.
     *
     * A true return means only that the request reached the native side. Play
     * never reports whether the user rated, dismissed, or saw anything at all,
     * and shows nothing when the quota is spent, when the user has already
     * reviewed, or when the build was not installed from Play. Never gate
     * anything on the outcome, because there is no outcome to read.
     *
     * The native side handles the "showed nothing" case itself by opening the
     * store listing, so a true return still means the user ends up somewhere
     * they can rate.
     */
    public static function request(): bool
    {
        if (! function_exists('nativephp_call')) {
            return false;
        }

        // The store URL travels with the call so the native side can fall back
        // to the listing when Play declines to draw the overlay. It reports
        // success either way, so PHP cannot make that decision from here.
        $payload = json_encode([
            'store_url' => config('review_prompt.store_url'),
        ]);

        $result = nativephp_call('Review.Request', $payload);

        if (! $result) {
            return false;
        }

        $decoded = json_decode($result, true);

        return isset($decoded['success']) && $decoded['success'] === true;
    }
}
