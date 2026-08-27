<?php

namespace App\Http\Controllers;

use App\Support\NativeReview;
use App\Support\ReviewPrompt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReviewPromptController extends Controller
{
    /**
     * Silence the Play Store rating prompt for good.
     *
     * Called both when the user dismisses the prompt and when they follow it
     * through to the store, so either answer retires it permanently.
     */
    public function dismiss(Request $request): JsonResponse
    {
        ReviewPrompt::dismissForever($request->user());

        return response()->json(['dismissed' => true]);
    }

    /**
     * The user chose to rate, so retire the prompt and hand off to Play.
     *
     * Prefers the native in-app review overlay. `native => false` means the
     * bridge function is not there (an unpatched build, or the browser during
     * development), and the caller should open `store_url` instead.
     */
    public function rate(Request $request): JsonResponse
    {
        ReviewPrompt::dismissForever($request->user());

        return response()->json([
            'native' => NativeReview::request(),
            'store_url' => config('review_prompt.store_url'),
        ]);
    }
}
