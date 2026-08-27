<?php

namespace App\Http\Controllers;

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
}
