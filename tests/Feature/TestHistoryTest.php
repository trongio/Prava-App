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

    // Create questions with answers
    $this->questions = collect();
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

        $question->load(['answers', 'questionCategory']);
        $this->questions->push($question);
    }

    // Build questions_with_answers array
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

    // Create a completed test
    $this->completedTest = TestResult::create([
        'user_id' => $this->user->id,
        'test_type' => 'quick',
        'configuration' => [
            'question_count' => 5,
            'time_per_question' => 60,
            'failure_threshold' => 10,
            'shuffle_seed' => 0.5,
        ],
        'questions_with_answers' => $questionsWithAnswers,
        'total_questions' => 5,
        'correct_count' => 3,
        'wrong_count' => 2,
        'score_percentage' => 60,
        'status' => TestStatus::Passed,
        'started_at' => now()->subMinutes(5),
        'finished_at' => now(),
        'current_question_index' => 5,
        'answers_given' => [],
        'skipped_question_ids' => [],
        'remaining_time_seconds' => 0,
        'time_taken_seconds' => 180,
    ]);
});

describe('History Index Page', function () {
    it('shows history list for authenticated user', function () {
        $response = $this->actingAs($this->user)
            ->get('/test/history');

        $response->assertSuccessful();
        $response->assertInertia(fn ($page) => $page
            ->component('test/history/index')
            ->has('testResults')
            ->has('stats')
        );
    });

    it('shows correct stats', function () {
        // Create another failed test
        TestResult::create([
            'user_id' => $this->user->id,
            'test_type' => 'quick',
            'configuration' => ['question_count' => 5, 'time_per_question' => 60, 'failure_threshold' => 10],
            'questions_with_answers' => [],
            'total_questions' => 5,
            'correct_count' => 1,
            'wrong_count' => 4,
            'score_percentage' => 20,
            'status' => TestStatus::Failed,
            'started_at' => now()->subMinutes(10),
            'finished_at' => now()->subMinutes(5),
            'current_question_index' => 5,
            'answers_given' => [],
            'skipped_question_ids' => [],
            'remaining_time_seconds' => 0,
        ]);

        $response = $this->actingAs($this->user)
            ->get('/test/history');

        $response->assertInertia(fn ($page) => $page
            ->where('stats.total', 2)
            ->where('stats.passed', 1)
            ->where('stats.failed', 1)
        );
    });

    it('filters by status', function () {
        $response = $this->actingAs($this->user)
            ->get('/test/history?status=passed');

        $response->assertSuccessful();
        $response->assertInertia(fn ($page) => $page
            ->where('filters.status', 'passed')
        );
    });

    it('filters by test type', function () {
        $response = $this->actingAs($this->user)
            ->get('/test/history?test_type=quick');

        $response->assertSuccessful();
        $response->assertInertia(fn ($page) => $page
            ->where('filters.test_type', 'quick')
        );
    });

    it('requires authentication', function () {
        $response = $this->get('/test/history');

        $response->assertRedirect();
    });
});

describe('History Show Page', function () {
    it('shows test details for owner', function () {
        $response = $this->actingAs($this->user)
            ->get("/test/history/{$this->completedTest->id}");

        $response->assertSuccessful();
        $response->assertInertia(fn ($page) => $page
            ->component('test/history/show')
            ->has('testResult')
            ->where('testResult.id', $this->completedTest->id)
            ->where('testResult.status', 'passed')
            ->where('testResult.correct_count', 3)
            ->where('testResult.wrong_count', 2)
        );
    });

    it('prevents access by non-owner', function () {
        $otherUser = User::factory()->create();

        $response = $this->actingAs($otherUser)
            ->get("/test/history/{$this->completedTest->id}");

        $response->assertStatus(403);
    });

    it('redirects to active test if not completed', function () {
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

        $response = $this->actingAs($this->user)
            ->get("/test/history/{$inProgressTest->id}");

        $response->assertRedirect();
    });
});

describe('History Delete', function () {
    it('allows owner to delete test', function () {
        $response = $this->actingAs($this->user)
            ->deleteJson("/test/history/{$this->completedTest->id}");

        $response->assertSuccessful()
            ->assertJson(['success' => true]);

        expect(TestResult::find($this->completedTest->id))->toBeNull();
    });

    it('prevents non-owner from deleting', function () {
        $otherUser = User::factory()->create();

        $response = $this->actingAs($otherUser)
            ->deleteJson("/test/history/{$this->completedTest->id}");

        $response->assertStatus(403);

        expect(TestResult::find($this->completedTest->id))->not->toBeNull();
    });
});
