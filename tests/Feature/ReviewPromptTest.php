<?php

use App\Models\TestResult;
use App\Models\User;
use App\Models\UserStatistic;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();

    config([
        'review_prompt.min_tests_passed' => 3,
        'review_prompt.cooldown_days' => 60,
        'review_prompt.max_prompts' => 3,
    ]);
});

/**
 * Give the user an aggregate row claiming a number of passed tests.
 */
function withPassedTests(User $user, int $count): void
{
    UserStatistic::updateOrCreate(
        ['user_id' => $user->id],
        ['total_tests_taken' => $count, 'total_tests_passed' => $count]
    );
}

/**
 * A finished test result owned by the user.
 */
function finishedTest(User $user, string $status = TestResult::STATUS_PASSED): TestResult
{
    return TestResult::create([
        'user_id' => $user->id,
        'test_type' => 'quick',
        'configuration' => ['question_count' => 5, 'time_per_question' => 60, 'failure_threshold' => 10],
        'questions_with_answers' => [],
        'total_questions' => 5,
        'correct_count' => 5,
        'wrong_count' => 0,
        'score_percentage' => 100,
        'status' => $status,
        'started_at' => now()->subMinutes(5),
        'finished_at' => now(),
        'current_question_index' => 5,
        'answers_given' => [],
        'skipped_question_ids' => [],
        'remaining_time_seconds' => 0,
    ]);
}

/**
 * Visit the results screen and report whether it carried the prompt.
 */
function resultsCarryPrompt(User $user, TestResult $testResult): bool
{
    $carried = false;

    test()->actingAs($user)
        ->get("/test/{$testResult->id}/results")
        ->assertOk()
        ->assertInertia(function (Assert $page) use (&$carried) {
            $carried = $page->toArray()['props']['reviewPrompt'] !== null;
        });

    return $carried;
}

it('does not prompt before the user has passed enough tests', function () {
    withPassedTests($this->user, 2);

    expect(resultsCarryPrompt($this->user, finishedTest($this->user)))->toBeFalse();
});

it('prompts on a passed test once the threshold is met', function () {
    withPassedTests($this->user, 3);

    expect(resultsCarryPrompt($this->user, finishedTest($this->user)))->toBeTrue();
});

it('never prompts on a failed test', function () {
    withPassedTests($this->user, 10);

    $failed = finishedTest($this->user, TestResult::STATUS_FAILED);

    expect(resultsCarryPrompt($this->user, $failed))->toBeFalse();
});

it('carries the configured store url with the prompt', function () {
    withPassedTests($this->user, 3);
    config(['review_prompt.store_url' => 'market://details?id=com.example.app']);

    $this->actingAs($this->user)
        ->get('/test/'.finishedTest($this->user)->id.'/results')
        ->assertInertia(fn (Assert $page) => $page
            ->where('reviewPrompt.store_url', 'market://details?id=com.example.app')
            ->etc()
        );
});

it('stamps the show so revisiting the same results screen does not re-ask', function () {
    withPassedTests($this->user, 3);

    $testResult = finishedTest($this->user);

    expect(resultsCarryPrompt($this->user, $testResult))->toBeTrue();

    $this->user->refresh();
    expect($this->user->review_prompt_shown_count)->toBe(1)
        ->and($this->user->review_prompt_last_shown_at)->not->toBeNull();

    expect(resultsCarryPrompt($this->user->fresh(), $testResult))->toBeFalse();
});

it('holds the prompt back for the whole cooldown, then asks once more', function () {
    withPassedTests($this->user, 3);

    expect(resultsCarryPrompt($this->user, finishedTest($this->user)))->toBeTrue();

    // Still inside the cooldown.
    $this->user->refresh();
    $this->user->forceFill(['review_prompt_last_shown_at' => now()->subDays(59)])->save();
    expect(resultsCarryPrompt($this->user->fresh(), finishedTest($this->user)))->toBeFalse();

    // Past it.
    $this->user->forceFill(['review_prompt_last_shown_at' => now()->subDays(61)])->save();
    expect(resultsCarryPrompt($this->user->fresh(), finishedTest($this->user)))->toBeTrue();
});

it('stops asking for good once the lifetime ceiling is reached', function () {
    withPassedTests($this->user, 3);

    $this->user->forceFill([
        'review_prompt_shown_count' => 3,
        'review_prompt_last_shown_at' => now()->subYears(5),
    ])->save();

    expect(resultsCarryPrompt($this->user->fresh(), finishedTest($this->user)))->toBeFalse();
});

it('never prompts again after a dismissal', function () {
    withPassedTests($this->user, 3);

    $this->actingAs($this->user)
        ->post('/review-prompt/dismiss')
        ->assertOk()
        ->assertJson(['dismissed' => true]);

    $this->user->refresh();
    expect($this->user->review_prompt_dismissed_at)->not->toBeNull();

    // Not now, and not after any amount of time or further passed tests.
    expect(resultsCarryPrompt($this->user, finishedTest($this->user)))->toBeFalse();

    $this->travel(5)->years();
    withPassedTests($this->user, 500);

    expect(resultsCarryPrompt($this->user->fresh(), finishedTest($this->user)))->toBeFalse();
});

it('requires authentication to dismiss', function () {
    $this->post('/review-prompt/dismiss')->assertRedirect('/');
});

it('one user dismissing does not silence another', function () {
    $other = User::factory()->create();
    withPassedTests($this->user, 3);
    withPassedTests($other, 3);

    $this->actingAs($this->user)->post('/review-prompt/dismiss')->assertOk();

    expect(resultsCarryPrompt($other, finishedTest($other)))->toBeTrue();
});

it('falls back to counting passed tests when there is no aggregate row', function () {
    expect($this->user->statistic)->toBeNull();

    finishedTest($this->user);
    finishedTest($this->user);

    // Two passed so far, the third is the one being viewed.
    $third = finishedTest($this->user);

    expect(resultsCarryPrompt($this->user, $third))->toBeTrue();
});
