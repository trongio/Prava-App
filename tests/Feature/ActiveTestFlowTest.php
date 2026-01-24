<?php

use App\Enums\TestStatus;
use App\Models\Answer;
use App\Models\Question;
use App\Models\QuestionCategory;
use App\Models\TestResult;
use App\Models\User;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

beforeEach(function () {
    // Create a user
    $this->user = User::factory()->create();

    // Create a question category
    $this->category = QuestionCategory::factory()->create();

    // Create questions with answers
    $this->questions = collect();
    for ($i = 0; $i < 3; $i++) {
        $question = Question::factory()->create([
            'question_category_id' => $this->category->id,
        ]);

        // Create 4 answers for each question (1 correct, 3 wrong)
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

        $question->load(['answers', 'questionCategory']);
        $this->questions->push($question);
    }

    // Build questions_with_answers array as stored in TestResult
    $questionsWithAnswers = $this->questions->map(function ($q) {
        return [
            'id' => $q->id,
            'question' => $q->question,
            'description' => $q->description,
            'full_description' => $q->full_description,
            'image' => $q->image,
            'image_custom' => $q->image_custom,
            'is_short_image' => $q->is_short_image,
            'answers' => $q->answers->map(fn ($a) => [
                'id' => $a->id,
                'text' => $a->text,
                'is_correct' => $a->is_correct,
                'position' => $a->position,
            ])->toArray(),
            'question_category' => [
                'id' => $q->questionCategory->id,
                'name' => $q->questionCategory->name,
            ],
            'signs' => [],
        ];
    })->toArray();

    // Create an active test
    $this->testResult = TestResult::create([
        'user_id' => $this->user->id,
        'test_type' => 'quick',
        'configuration' => [
            'question_count' => 3,
            'time_per_question' => 60,
            'failure_threshold' => 10,
            'shuffle_seed' => 0.5,
        ],
        'questions_with_answers' => $questionsWithAnswers,
        'total_questions' => 3,
        'correct_count' => 0,
        'wrong_count' => 0,
        'score_percentage' => 0,
        'status' => TestStatus::InProgress,
        'started_at' => now(),
        'current_question_index' => 0,
        'answers_given' => [],
        'skipped_question_ids' => [],
        'remaining_time_seconds' => 180,
    ]);
});

describe('Test Answer Submission', function () {
    it('allows answering a question correctly', function () {
        $question = $this->questions->first();
        $correctAnswer = $question->answers->firstWhere('is_correct', true);

        $response = $this->actingAs($this->user)
            ->postJson("/test/{$this->testResult->id}/answer", [
                'question_id' => $question->id,
                'answer_id' => $correctAnswer->id,
                'remaining_time' => 170,
            ]);

        $response->assertSuccessful()
            ->assertJson([
                'is_correct' => true,
                'correct_count' => 1,
                'wrong_count' => 0,
                'has_exceeded_mistakes' => false,
            ]);

        $this->testResult->refresh();
        expect($this->testResult->correct_count)->toBe(1);
        expect($this->testResult->wrong_count)->toBe(0);
        expect($this->testResult->answers_given)->toHaveKey((string) $question->id);
    });

    it('allows answering a question incorrectly', function () {
        $question = $this->questions->first();
        $wrongAnswer = $question->answers->firstWhere('is_correct', false);

        $response = $this->actingAs($this->user)
            ->postJson("/test/{$this->testResult->id}/answer", [
                'question_id' => $question->id,
                'answer_id' => $wrongAnswer->id,
                'remaining_time' => 170,
            ]);

        $response->assertSuccessful()
            ->assertJson([
                'is_correct' => false,
                'correct_count' => 0,
                'wrong_count' => 1,
            ]);

        $this->testResult->refresh();
        expect($this->testResult->wrong_count)->toBe(1);
    });

    it('prevents answering the same question twice', function () {
        $question = $this->questions->first();
        $correctAnswer = $question->answers->firstWhere('is_correct', true);

        // Answer once
        $this->actingAs($this->user)
            ->postJson("/test/{$this->testResult->id}/answer", [
                'question_id' => $question->id,
                'answer_id' => $correctAnswer->id,
                'remaining_time' => 170,
            ]);

        // Try to answer again
        $response = $this->actingAs($this->user)
            ->postJson("/test/{$this->testResult->id}/answer", [
                'question_id' => $question->id,
                'answer_id' => $correctAnswer->id,
                'remaining_time' => 160,
            ]);

        $response->assertStatus(400)
            ->assertJson(['error' => 'Question already answered']);
    });

    it('prevents other users from answering', function () {
        $otherUser = User::factory()->create();
        $question = $this->questions->first();
        $correctAnswer = $question->answers->firstWhere('is_correct', true);

        $response = $this->actingAs($otherUser)
            ->postJson("/test/{$this->testResult->id}/answer", [
                'question_id' => $question->id,
                'answer_id' => $correctAnswer->id,
                'remaining_time' => 170,
            ]);

        $response->assertStatus(403);
    });
});

describe('Test Skip Functionality', function () {
    it('allows skipping a question', function () {
        $question = $this->questions->first();

        $response = $this->actingAs($this->user)
            ->postJson("/test/{$this->testResult->id}/skip", [
                'question_id' => $question->id,
            ]);

        $response->assertSuccessful()
            ->assertJson(['success' => true]);

        $this->testResult->refresh();
        expect($this->testResult->skipped_question_ids)->toContain($question->id);
    });

    it('prevents skipping an already answered question', function () {
        $question = $this->questions->first();
        $correctAnswer = $question->answers->firstWhere('is_correct', true);

        // Answer first
        $this->actingAs($this->user)
            ->postJson("/test/{$this->testResult->id}/answer", [
                'question_id' => $question->id,
                'answer_id' => $correctAnswer->id,
                'remaining_time' => 170,
            ]);

        // Try to skip
        $response = $this->actingAs($this->user)
            ->postJson("/test/{$this->testResult->id}/skip", [
                'question_id' => $question->id,
            ]);

        $response->assertStatus(400)
            ->assertJson(['error' => 'Question already answered']);
    });

    it('removes question from skipped list when answered', function () {
        $question = $this->questions->first();
        $correctAnswer = $question->answers->firstWhere('is_correct', true);

        // Skip first
        $this->actingAs($this->user)
            ->postJson("/test/{$this->testResult->id}/skip", [
                'question_id' => $question->id,
            ]);

        $this->testResult->refresh();
        expect($this->testResult->skipped_question_ids)->toContain($question->id);

        // Then answer
        $this->actingAs($this->user)
            ->postJson("/test/{$this->testResult->id}/answer", [
                'question_id' => $question->id,
                'answer_id' => $correctAnswer->id,
                'remaining_time' => 160,
            ]);

        $this->testResult->refresh();
        expect($this->testResult->skipped_question_ids)->not->toContain($question->id);
    });
});

describe('Test Pause Functionality', function () {
    it('allows pausing a test', function () {
        $response = $this->actingAs($this->user)
            ->postJson("/test/{$this->testResult->id}/pause", [
                'current_question_index' => 1,
                'remaining_time' => 150,
            ]);

        $response->assertSuccessful()
            ->assertJson(['success' => true]);

        $this->testResult->refresh();
        expect($this->testResult->status)->toBe(TestStatus::Paused);
        expect($this->testResult->current_question_index)->toBe(1);
        expect($this->testResult->remaining_time_seconds)->toBe(150);
    });
});

describe('Test Complete Functionality', function () {
    it('completes a test and returns JSON for AJAX requests', function () {
        // Answer all questions first
        foreach ($this->questions as $question) {
            $correctAnswer = $question->answers->firstWhere('is_correct', true);
            $this->actingAs($this->user)
                ->postJson("/test/{$this->testResult->id}/answer", [
                    'question_id' => $question->id,
                    'answer_id' => $correctAnswer->id,
                    'remaining_time' => 100,
                ]);
        }

        $response = $this->actingAs($this->user)
            ->postJson("/test/{$this->testResult->id}/complete", [
                'remaining_time' => 100,
            ]);

        $response->assertSuccessful()
            ->assertJson([
                'success' => true,
                'passed' => true,
            ])
            ->assertJsonStructure(['redirect_url']);

        $this->testResult->refresh();
        expect($this->testResult->status)->toBe(TestStatus::Passed);
        expect($this->testResult->finished_at)->not->toBeNull();
    });

    it('marks test as failed when exceeding allowed mistakes', function () {
        // Answer all questions wrong
        foreach ($this->questions as $question) {
            $wrongAnswer = $question->answers->firstWhere('is_correct', false);
            $this->actingAs($this->user)
                ->postJson("/test/{$this->testResult->id}/answer", [
                    'question_id' => $question->id,
                    'answer_id' => $wrongAnswer->id,
                    'remaining_time' => 100,
                ]);
        }

        $response = $this->actingAs($this->user)
            ->postJson("/test/{$this->testResult->id}/complete", [
                'remaining_time' => 100,
            ]);

        $response->assertSuccessful()
            ->assertJson([
                'success' => true,
                'passed' => false,
            ]);

        $this->testResult->refresh();
        expect($this->testResult->status)->toBe(TestStatus::Failed);
    });

    it('returns redirect for non-AJAX requests', function () {
        $response = $this->actingAs($this->user)
            ->post("/test/{$this->testResult->id}/complete", [
                'remaining_time' => 100,
            ]);

        $response->assertRedirect();
    });

    it('prevents completing an already completed test', function () {
        $this->testResult->update(['status' => TestStatus::Passed]);

        $response = $this->actingAs($this->user)
            ->postJson("/test/{$this->testResult->id}/complete", [
                'remaining_time' => 100,
            ]);

        $response->assertSuccessful()
            ->assertJson(['success' => true]);
    });
});

describe('Test Results Page', function () {
    it('shows results for completed test', function () {
        $this->testResult->update([
            'status' => TestStatus::Passed,
            'finished_at' => now(),
            'score_percentage' => 100,
            'time_taken_seconds' => 60,
        ]);

        $response = $this->actingAs($this->user)
            ->get("/test/{$this->testResult->id}/results");

        $response->assertSuccessful();
    });

    it('redirects to active test if not completed', function () {
        $response = $this->actingAs($this->user)
            ->get("/test/{$this->testResult->id}/results");

        $response->assertRedirect();
    });
});
