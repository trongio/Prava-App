<?php

use App\Enums\TestStatus;
use App\Models\Answer;
use App\Models\Question;
use App\Models\QuestionCategory;
use App\Models\TestResult;
use App\Models\User;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();

    $this->category = QuestionCategory::factory()->create();

    // Create some questions
    for ($i = 0; $i < 5; $i++) {
        $question = Question::factory()->create([
            'question_category_id' => $this->category->id,
        ]);

        Answer::factory()->correct()->create([
            'question_id' => $question->id,
            'position' => 1,
        ]);
        for ($j = 2; $j <= 4; $j++) {
            Answer::factory()->create([
                'question_id' => $question->id,
                'position' => $j,
            ]);
        }
    }
});

describe('Active Test Model', function () {
    it('can determine if test is active', function () {
        $inProgressTest = TestResult::create([
            'user_id' => $this->user->id,
            'test_type' => 'quick',
            'configuration' => ['question_count' => 5, 'time_per_question' => 60, 'failure_threshold' => 10],
            'questions_with_answers' => [],
            'total_questions' => 5,
            'correct_count' => 0,
            'wrong_count' => 0,
            'score_percentage' => 0,
            'status' => TestStatus::InProgress,
            'started_at' => now(),
            'current_question_index' => 0,
            'answers_given' => [],
            'skipped_question_ids' => [],
            'remaining_time_seconds' => 300,
        ]);

        $pausedTest = TestResult::create([
            'user_id' => $this->user->id,
            'test_type' => 'quick',
            'configuration' => ['question_count' => 5, 'time_per_question' => 60, 'failure_threshold' => 10],
            'questions_with_answers' => [],
            'total_questions' => 5,
            'correct_count' => 0,
            'wrong_count' => 0,
            'score_percentage' => 0,
            'status' => TestStatus::Paused,
            'started_at' => now(),
            'current_question_index' => 0,
            'answers_given' => [],
            'skipped_question_ids' => [],
            'remaining_time_seconds' => 300,
            'paused_at' => now(),
        ]);

        $completedTest = TestResult::create([
            'user_id' => $this->user->id,
            'test_type' => 'quick',
            'configuration' => ['question_count' => 5, 'time_per_question' => 60, 'failure_threshold' => 10],
            'questions_with_answers' => [],
            'total_questions' => 5,
            'correct_count' => 3,
            'wrong_count' => 2,
            'score_percentage' => 60,
            'status' => TestStatus::Passed,
            'started_at' => now()->subMinutes(10),
            'finished_at' => now(),
            'current_question_index' => 5,
            'answers_given' => [],
            'skipped_question_ids' => [],
            'remaining_time_seconds' => 0,
        ]);

        expect($inProgressTest->isActive())->toBeTrue();
        expect($pausedTest->isActive())->toBeTrue();
        expect($completedTest->isActive())->toBeFalse();
    });

    it('can abandon an active test', function () {
        $test = TestResult::create([
            'user_id' => $this->user->id,
            'test_type' => 'quick',
            'configuration' => ['question_count' => 5, 'time_per_question' => 60, 'failure_threshold' => 10],
            'questions_with_answers' => [],
            'total_questions' => 5,
            'correct_count' => 2,
            'wrong_count' => 1,
            'score_percentage' => 0,
            'status' => TestStatus::InProgress,
            'started_at' => now(),
            'current_question_index' => 3,
            'answers_given' => [],
            'skipped_question_ids' => [],
            'remaining_time_seconds' => 200,
        ]);

        $result = $test->abandon();

        expect($result)->toBeTrue();
        expect($test->fresh()->status)->toBe(TestStatus::Abandoned);
        expect($test->fresh()->finished_at)->not->toBeNull();
        expect($test->fresh()->isAbandoned())->toBeTrue();
    });

    it('cannot abandon a completed test', function () {
        $test = TestResult::create([
            'user_id' => $this->user->id,
            'test_type' => 'quick',
            'configuration' => ['question_count' => 5, 'time_per_question' => 60, 'failure_threshold' => 10],
            'questions_with_answers' => [],
            'total_questions' => 5,
            'correct_count' => 3,
            'wrong_count' => 2,
            'score_percentage' => 60,
            'status' => TestStatus::Passed,
            'started_at' => now()->subMinutes(10),
            'finished_at' => now(),
            'current_question_index' => 5,
            'answers_given' => [],
            'skipped_question_ids' => [],
            'remaining_time_seconds' => 0,
        ]);

        $result = $test->abandon();

        expect($result)->toBeFalse();
        expect($test->fresh()->status)->toBe(TestStatus::Passed);
    });

    it('scopes active tests correctly', function () {
        // Create an active test
        TestResult::create([
            'user_id' => $this->user->id,
            'test_type' => 'quick',
            'configuration' => ['question_count' => 5, 'time_per_question' => 60, 'failure_threshold' => 10],
            'questions_with_answers' => [],
            'total_questions' => 5,
            'correct_count' => 0,
            'wrong_count' => 0,
            'score_percentage' => 0,
            'status' => TestStatus::InProgress,
            'started_at' => now(),
            'current_question_index' => 0,
            'answers_given' => [],
            'skipped_question_ids' => [],
            'remaining_time_seconds' => 300,
        ]);

        // Create a completed test
        TestResult::create([
            'user_id' => $this->user->id,
            'test_type' => 'quick',
            'configuration' => ['question_count' => 5, 'time_per_question' => 60, 'failure_threshold' => 10],
            'questions_with_answers' => [],
            'total_questions' => 5,
            'correct_count' => 3,
            'wrong_count' => 2,
            'score_percentage' => 60,
            'status' => TestStatus::Passed,
            'started_at' => now()->subMinutes(10),
            'finished_at' => now(),
            'current_question_index' => 5,
            'answers_given' => [],
            'skipped_question_ids' => [],
            'remaining_time_seconds' => 0,
        ]);

        $activeTests = TestResult::forUser($this->user->id)->active()->get();
        expect($activeTests)->toHaveCount(1);
        expect($activeTests->first()->status)->toBe(TestStatus::InProgress);
    });
});

describe('Test Creation with Active Test', function () {
    it('returns 409 when starting new test with active test present', function () {
        // Create an active test
        $activeTest = TestResult::create([
            'user_id' => $this->user->id,
            'test_type' => 'quick',
            'configuration' => ['question_count' => 5, 'time_per_question' => 60, 'failure_threshold' => 10],
            'questions_with_answers' => [],
            'total_questions' => 5,
            'correct_count' => 2,
            'wrong_count' => 1,
            'score_percentage' => 0,
            'status' => TestStatus::InProgress,
            'started_at' => now(),
            'current_question_index' => 3,
            'answers_given' => [],
            'skipped_question_ids' => [],
            'remaining_time_seconds' => 200,
        ]);

        $response = $this->actingAs($this->user)
            ->postJson('/test', [
                'test_type' => 'thematic',
                'question_count' => 10,
                'time_per_question' => 60,
                'failure_threshold' => 10,
            ]);

        $response->assertStatus(409)
            ->assertJson([
                'error' => 'active_test_exists',
            ]);

        // Verify active test still exists
        expect($activeTest->fresh()->status)->toBe(TestStatus::InProgress);
    });

    it('abandons active test when abandon_active is true', function () {
        // Create an active test
        $activeTest = TestResult::create([
            'user_id' => $this->user->id,
            'test_type' => 'quick',
            'configuration' => ['question_count' => 5, 'time_per_question' => 60, 'failure_threshold' => 10],
            'questions_with_answers' => [],
            'total_questions' => 5,
            'correct_count' => 2,
            'wrong_count' => 1,
            'score_percentage' => 0,
            'status' => TestStatus::InProgress,
            'started_at' => now(),
            'current_question_index' => 3,
            'answers_given' => [],
            'skipped_question_ids' => [],
            'remaining_time_seconds' => 200,
        ]);

        $response = $this->actingAs($this->user)
            ->postJson('/test', [
                'test_type' => 'thematic',
                'question_count' => 10,
                'time_per_question' => 60,
                'failure_threshold' => 10,
                'abandon_active' => true,
            ]);

        $response->assertRedirect();

        // Verify old test was abandoned
        expect($activeTest->fresh()->status)->toBe(TestStatus::Abandoned);
        expect($activeTest->fresh()->isAbandoned())->toBeTrue();

        // Verify new test was created
        $newTest = TestResult::forUser($this->user->id)->active()->first();
        expect($newTest)->not->toBeNull();
        expect($newTest->id)->not->toBe($activeTest->id);
    });

    it('creates test normally when no active test exists', function () {
        $response = $this->actingAs($this->user)
            ->postJson('/test', [
                'test_type' => 'thematic',
                'question_count' => 10,
                'time_per_question' => 60,
                'failure_threshold' => 10,
            ]);

        $response->assertRedirect();

        $newTest = TestResult::forUser($this->user->id)->active()->first();
        expect($newTest)->not->toBeNull();
    });
});

describe('Quick Test with Active Test', function () {
    it('returns 409 when quick starting with active test present', function () {
        // Create an active test
        $activeTest = TestResult::create([
            'user_id' => $this->user->id,
            'test_type' => 'quick',
            'configuration' => ['question_count' => 5, 'time_per_question' => 60, 'failure_threshold' => 10],
            'questions_with_answers' => [],
            'total_questions' => 5,
            'correct_count' => 0,
            'wrong_count' => 0,
            'score_percentage' => 0,
            'status' => TestStatus::InProgress,
            'started_at' => now(),
            'current_question_index' => 0,
            'answers_given' => [],
            'skipped_question_ids' => [],
            'remaining_time_seconds' => 300,
        ]);

        $response = $this->actingAs($this->user)
            ->postJson('/test/quick');

        $response->assertStatus(409)
            ->assertJson([
                'error' => 'active_test_exists',
            ]);
    });

    it('abandons active test on quick start with abandon_active', function () {
        // Create an active test
        $activeTest = TestResult::create([
            'user_id' => $this->user->id,
            'test_type' => 'thematic',
            'configuration' => ['question_count' => 5, 'time_per_question' => 60, 'failure_threshold' => 10],
            'questions_with_answers' => [],
            'total_questions' => 5,
            'correct_count' => 1,
            'wrong_count' => 0,
            'score_percentage' => 0,
            'status' => TestStatus::InProgress,
            'started_at' => now(),
            'current_question_index' => 1,
            'answers_given' => [],
            'skipped_question_ids' => [],
            'remaining_time_seconds' => 240,
        ]);

        $response = $this->actingAs($this->user)
            ->postJson('/test/quick', ['abandon_active' => true]);

        $response->assertRedirect();

        // Verify old test was abandoned
        expect($activeTest->fresh()->status)->toBe(TestStatus::Abandoned);

        // Verify new test was created (quickStart creates a 'thematic' test with default settings)
        $newTest = TestResult::forUser($this->user->id)->active()->first();
        expect($newTest)->not->toBeNull();
        expect($newTest->test_type)->toBe('thematic');
    });
});

describe('Test Index Page with Active Test', function () {
    it('shows active test data to user', function () {
        $activeTest = TestResult::create([
            'user_id' => $this->user->id,
            'test_type' => 'quick',
            'configuration' => ['question_count' => 30, 'time_per_question' => 60, 'failure_threshold' => 10],
            'questions_with_answers' => [],
            'total_questions' => 30,
            'correct_count' => 5,
            'wrong_count' => 2,
            'score_percentage' => 0,
            'status' => TestStatus::InProgress,
            'started_at' => now(),
            'current_question_index' => 7,
            'answers_given' => array_fill(0, 7, ['answer_id' => 1]),
            'skipped_question_ids' => [],
            'remaining_time_seconds' => 1380,
        ]);

        $response = $this->actingAs($this->user)
            ->get('/test');

        $response->assertSuccessful()
            ->assertInertia(fn ($page) => $page
                ->component('test/index')
                ->has('activeTest')
                ->where('activeTest.id', $activeTest->id)
                ->where('activeTest.status', 'in_progress')
                ->where('activeTest.answered_count', 7)
            );
    });

    it('shows null active test when none exists', function () {
        $response = $this->actingAs($this->user)
            ->get('/test');

        $response->assertSuccessful()
            ->assertInertia(fn ($page) => $page
                ->component('test/index')
                ->where('activeTest', null)
            );
    });
});
