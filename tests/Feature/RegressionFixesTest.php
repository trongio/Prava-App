<?php

use App\Models\Answer;
use App\Models\Question;
use App\Models\QuestionCategory;
use App\Models\TestResult;
use App\Models\User;
use App\Models\UserQuestionProgress;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->category = QuestionCategory::factory()->create();

    $this->questions = collect(range(1, 10))->map(function () {
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

        return $question->fresh('answers');
    });
});

describe('Timer is derived from the actual question count (H2)', function () {
    it('sizes the timer to the questions actually selected, not the requested count', function () {
        // Bookmark only 3 questions, then request a 30-question bookmarked test.
        $this->questions->take(3)->each(function (Question $question) {
            UserQuestionProgress::create([
                'user_id' => $this->user->id,
                'question_id' => $question->id,
                'is_bookmarked' => true,
            ]);
        });

        $this->actingAs($this->user)->post('/test', [
            'test_type' => 'bookmarked',
            'question_count' => 30,
            'time_per_question' => 60,
            'failure_threshold' => 10,
        ])->assertRedirect();

        $test = TestResult::where('user_id', $this->user->id)->firstOrFail();

        expect($test->total_questions)->toBe(3)
            ->and($test->remaining_time_seconds)->toBe(180);
    });

    it('produces a non-negative time_taken when fewer questions than requested are selected', function () {
        $this->questions->take(3)->each(function (Question $question) {
            UserQuestionProgress::create([
                'user_id' => $this->user->id,
                'question_id' => $question->id,
                'is_bookmarked' => true,
            ]);
        });

        $this->actingAs($this->user)->post('/test', [
            'test_type' => 'bookmarked',
            'question_count' => 30,
            'time_per_question' => 60,
            'failure_threshold' => 10,
        ]);

        $test = TestResult::where('user_id', $this->user->id)->firstOrFail();

        $this->actingAs($this->user)
            ->postJson("/test/{$test->id}/complete", ['remaining_time' => 120])
            ->assertOk();

        expect($test->fresh()->time_taken_seconds)->toBe(60)
            ->and($test->fresh()->time_taken_seconds)->toBeGreaterThanOrEqual(0);
    });
});

describe('Time expiry is enforced server-side (H3)', function () {
    it('marks an expired test as failed even when within the mistake limit', function () {
        $test = TestResult::create([
            'user_id' => $this->user->id,
            'test_type' => 'thematic',
            'configuration' => ['question_count' => 10, 'time_per_question' => 60, 'failure_threshold' => 10],
            'questions_with_answers' => [],
            'total_questions' => 10,
            'correct_count' => 10,
            'wrong_count' => 0,
            'score_percentage' => 100,
            'status' => TestResult::STATUS_IN_PROGRESS,
            'started_at' => now()->subSeconds(600),
            'current_question_index' => 9,
            'answers_given' => [],
            'skipped_question_ids' => [],
            'remaining_time_seconds' => 0,
        ]);

        $this->actingAs($this->user)
            ->postJson("/test/{$test->id}/complete", ['remaining_time' => -30])
            ->assertOk()
            ->assertJson(['passed' => false]);

        expect($test->fresh()->status)->toBe(TestResult::STATUS_FAILED);
    });

    it('still passes a clean test completed within the time limit', function () {
        $test = TestResult::create([
            'user_id' => $this->user->id,
            'test_type' => 'thematic',
            'configuration' => ['question_count' => 10, 'time_per_question' => 60, 'failure_threshold' => 10],
            'questions_with_answers' => [],
            'total_questions' => 10,
            'correct_count' => 10,
            'wrong_count' => 0,
            'score_percentage' => 100,
            'status' => TestResult::STATUS_IN_PROGRESS,
            'started_at' => now()->subSeconds(120),
            'current_question_index' => 9,
            'answers_given' => [],
            'skipped_question_ids' => [],
            'remaining_time_seconds' => 480,
        ]);

        $this->actingAs($this->user)
            ->postJson("/test/{$test->id}/complete", ['remaining_time' => 480])
            ->assertOk()
            ->assertJson(['passed' => true]);

        expect($test->fresh()->status)->toBe(TestResult::STATUS_PASSED);
    });
});

describe('Question browser answer validation (M1)', function () {
    it('rejects an answer id belonging to a different question without a 500', function () {
        $question = $this->questions->first();
        $foreignAnswer = $this->questions->last()->answers->first();

        $this->actingAs($this->user)
            ->postJson("/questions/{$question->id}/answer", [
                'answer_id' => $foreignAnswer->id,
            ])
            ->assertStatus(422);
    });

    it('accepts an answer id belonging to the question', function () {
        $question = $this->questions->first();
        $ownAnswer = $question->answers->firstWhere('is_correct', true);

        $this->actingAs($this->user)
            ->postJson("/questions/{$question->id}/answer", [
                'answer_id' => $ownAnswer->id,
            ])
            ->assertOk()
            ->assertJson(['is_correct' => true]);
    });
});
