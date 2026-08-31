<?php

namespace App\Support;

use App\Models\TestResult;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Decides when to invite a user to rate the app on the Play Store.
 *
 * The prompt is deliberately hard to trigger and trivial to kill: it appears
 * only on the results screen of a test the user has *passed*, never before
 * they have passed a handful of them, and a single dismissal silences it for
 * good. Everything it needs lives on the `users` row, so this works offline
 * like the rest of the app.
 *
 * Thresholds are in config/review_prompt.php.
 */
class ReviewPrompt
{
    /**
     * Should the results screen for this test carry the rating prompt?
     */
    public static function shouldShow(User $user, TestResult $testResult): bool
    {
        // There is no app store listing to send a browser to.
        if (Platform::isWeb()) {
            return false;
        }

        if (! $testResult->isPassed()) {
            return false;
        }

        if ($user->review_prompt_dismissed_at !== null) {
            return false;
        }

        if ($user->review_prompt_shown_count >= (int) config('review_prompt.max_prompts')) {
            return false;
        }

        if (self::passedTestCount($user) < (int) config('review_prompt.min_tests_passed')) {
            return false;
        }

        return self::cooldownHasElapsed($user);
    }

    /**
     * Record that the prompt was rendered, starting the cooldown.
     */
    public static function markShown(User $user): void
    {
        $user->forceFill([
            'review_prompt_last_shown_at' => Carbon::now(),
            'review_prompt_shown_count' => $user->review_prompt_shown_count + 1,
        ])->save();
    }

    /**
     * Silence the prompt permanently.
     *
     * Used both when the user dismisses it and when they follow it through to
     * the store: either way they have answered the question and should not be
     * asked again.
     */
    public static function dismissForever(User $user): void
    {
        $user->forceFill([
            'review_prompt_dismissed_at' => Carbon::now(),
        ])->save();
    }

    /**
     * Tests passed so far, from the aggregate row when there is one.
     */
    private static function passedTestCount(User $user): int
    {
        $statistic = $user->statistic;

        if ($statistic !== null) {
            return (int) $statistic->total_tests_passed;
        }

        return $user->testResults()->passed()->count();
    }

    /**
     * True when the prompt has never been shown, or was last shown long enough
     * ago that asking once more is not nagging.
     */
    private static function cooldownHasElapsed(User $user): bool
    {
        $lastShownAt = $user->review_prompt_last_shown_at;

        if ($lastShownAt === null) {
            return true;
        }

        return $lastShownAt->lte(Carbon::now()->subDays((int) config('review_prompt.cooldown_days')));
    }
}
