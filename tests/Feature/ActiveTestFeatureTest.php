<?php

use App\Enums\TestStatus;
use App\Models\Question;
use App\Models\QuestionCategory;
use App\Models\TestResult;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    // Create a category and questions for testing
    $category = QuestionCategory::factory()->create();
    Question::factory()->count(10)->create([
        'question_category_id' => $category->id,
    ]);
});

describe('Auto-advance defaults', function () {
    it('defaults test_auto_advance to true for new users', function () {
        $user = User::factory()->create();

        expect($user->test_auto_advance)->toBeTrue();
    });

    it('includes auto_advance true in test configuration by default', function () {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/test', [
            'test_type' => 'thematic',
            'question_count' => 5,
            'time_per_question' => 60,
            'failure_threshold' => 10,
            'category_ids' => [],
        ]);

        $response->assertRedirect();

        $testResult = TestResult::where('user_id', $user->id)->first();
        expect($testResult)->not->toBeNull();
        expect($testResult->configuration['auto_advance'])->toBeTrue();
    });

    it('respects user setting when auto_advance is explicitly set to false', function () {
        $user = User::factory()->create(['test_auto_advance' => false]);

        $response = $this->actingAs($user)->post('/test', [
            'test_type' => 'thematic',
            'question_count' => 5,
            'time_per_question' => 60,
            'failure_threshold' => 10,
            'category_ids' => [],
            'auto_advance' => false,
        ]);

        $response->assertRedirect();

        $testResult = TestResult::where('user_id', $user->id)->first();
        expect($testResult->configuration['auto_advance'])->toBeFalse();
    });

    it('uses user default when auto_advance not in request', function () {
        $user = User::factory()->create(['test_auto_advance' => true]);

        $response = $this->actingAs($user)->post('/test', [
            'test_type' => 'thematic',
            'question_count' => 5,
            'time_per_question' => 60,
            'failure_threshold' => 10,
            'category_ids' => [],
            // auto_advance not provided - should use user default
        ]);

        $response->assertRedirect();

        $testResult = TestResult::where('user_id', $user->id)->first();
        expect($testResult->configuration['auto_advance'])->toBeTrue();
    });
});

describe('Resume position logic', function () {
    it('returns test data with correct current_question_index for fresh test', function () {
        $user = User::factory()->create();

        // Start a test
        $this->actingAs($user)->post('/test', [
            'test_type' => 'thematic',
            'question_count' => 5,
            'time_per_question' => 60,
            'failure_threshold' => 10,
            'category_ids' => [],
        ]);

        $testResult = TestResult::where('user_id', $user->id)->first();

        // Access the active test page
        $response = $this->actingAs($user)->get("/test/{$testResult->id}");

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('test/active')
            ->has('testResult')
            ->where('testResult.current_question_index', 0)
        );
    });

    it('saves current_question_index when pausing test', function () {
        $user = User::factory()->create();

        // Start a test
        $this->actingAs($user)->post('/test', [
            'test_type' => 'thematic',
            'question_count' => 5,
            'time_per_question' => 60,
            'failure_threshold' => 10,
            'category_ids' => [],
        ]);

        $testResult = TestResult::where('user_id', $user->id)->first();

        // Pause at question index 3
        $response = $this->actingAs($user)->post("/test/{$testResult->id}/pause", [
            'current_question_index' => 3,
            'remaining_time' => 250,
        ]);

        $response->assertOk();

        $testResult->refresh();
        expect($testResult->current_question_index)->toBe(3);
        expect($testResult->status)->toBe(TestStatus::Paused);
    });

    it('tracks answered questions correctly', function () {
        $user = User::factory()->create();

        // Start a test
        $this->actingAs($user)->post('/test', [
            'test_type' => 'thematic',
            'question_count' => 5,
            'time_per_question' => 60,
            'failure_threshold' => 10,
            'category_ids' => [],
        ]);

        $testResult = TestResult::where('user_id', $user->id)->first();
        $questions = $testResult->questions_with_answers;

        // Answer first question
        $firstQuestion = $questions[0];
        $correctAnswer = collect($firstQuestion['answers'])->firstWhere('is_correct', true);

        $response = $this->actingAs($user)->post("/test/{$testResult->id}/answer", [
            'question_id' => $firstQuestion['id'],
            'answer_id' => $correctAnswer['id'],
            'remaining_time' => 290,
        ]);

        $response->assertOk();

        $testResult->refresh();
        expect($testResult->answers_given)->toHaveKey((string) $firstQuestion['id']);
        expect($testResult->correct_count)->toBe(1);
    });

    it('tracks skipped questions correctly', function () {
        $user = User::factory()->create();

        // Start a test
        $this->actingAs($user)->post('/test', [
            'test_type' => 'thematic',
            'question_count' => 5,
            'time_per_question' => 60,
            'failure_threshold' => 10,
            'category_ids' => [],
        ]);

        $testResult = TestResult::where('user_id', $user->id)->first();
        $questions = $testResult->questions_with_answers;

        // Skip first question
        $firstQuestion = $questions[0];

        $response = $this->actingAs($user)->post("/test/{$testResult->id}/skip", [
            'question_id' => $firstQuestion['id'],
        ]);

        $response->assertOk();

        $testResult->refresh();
        expect($testResult->skipped_question_ids)->toContain($firstQuestion['id']);
    });

    it('provides all data needed for frontend resume calculation', function () {
        $user = User::factory()->create();

        // Start a test
        $this->actingAs($user)->post('/test', [
            'test_type' => 'thematic',
            'question_count' => 5,
            'time_per_question' => 60,
            'failure_threshold' => 10,
            'category_ids' => [],
        ]);

        $testResult = TestResult::where('user_id', $user->id)->first();
        $questions = $testResult->questions_with_answers;

        // Capture all question and answer IDs upfront
        $questionData = [];
        foreach ($questions as $i => $q) {
            $questionData[$i] = [
                'id' => $q['id'],
                'answer_id' => $q['answers'][0]['id'],
            ];
        }

        // Answer questions 0, 1
        foreach ([0, 1] as $index) {
            $this->actingAs($user)->post("/test/{$testResult->id}/answer", [
                'question_id' => $questionData[$index]['id'],
                'answer_id' => $questionData[$index]['answer_id'],
                'remaining_time' => 280 - ($index * 10),
            ]);
        }

        // Skip question 2
        $this->actingAs($user)->post("/test/{$testResult->id}/skip", [
            'question_id' => $questionData[2]['id'],
        ]);

        // Answer question 3
        $this->actingAs($user)->post("/test/{$testResult->id}/answer", [
            'question_id' => $questionData[3]['id'],
            'answer_id' => $questionData[3]['answer_id'],
            'remaining_time' => 250,
        ]);

        // Pause at question 4
        $this->actingAs($user)->post("/test/{$testResult->id}/pause", [
            'current_question_index' => 4,
            'remaining_time' => 240,
        ]);

        // Resume and check all data is provided
        $response = $this->actingAs($user)->get("/test/{$testResult->id}");

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('test/active')
            ->has('testResult.answers_given')
            ->has('testResult.skipped_question_ids')
            ->has('testResult.current_question_index')
            ->has('testResult.questions')
            ->where('testResult.current_question_index', 4)
        );

        // Verify the counts
        $testResult->refresh();
        expect(count($testResult->answers_given))->toBe(3);
        expect(count($testResult->skipped_question_ids))->toBe(1);
    });
});

describe('Skip and answer sequence', function () {
    it('can skip a question and then answer the next one', function () {
        $user = User::factory()->create();

        // Start a test
        $this->actingAs($user)->post('/test', [
            'test_type' => 'thematic',
            'question_count' => 5,
            'time_per_question' => 60,
            'failure_threshold' => 10,
            'category_ids' => [],
        ]);

        $testResult = TestResult::where('user_id', $user->id)->first();
        $questions = $testResult->questions_with_answers;

        // Capture question/answer IDs upfront
        $q0 = ['id' => $questions[0]['id']];
        $q1 = ['id' => $questions[1]['id'], 'answer_id' => $questions[1]['answers'][0]['id']];

        // Skip question 0
        $skipResponse = $this->actingAs($user)->post("/test/{$testResult->id}/skip", [
            'question_id' => $q0['id'],
        ]);
        $skipResponse->assertOk();

        $testResult->refresh();
        expect($testResult->skipped_question_ids)->toContain($q0['id']);

        // Answer question 1
        $answerResponse = $this->actingAs($user)->post("/test/{$testResult->id}/answer", [
            'question_id' => $q1['id'],
            'answer_id' => $q1['answer_id'],
            'remaining_time' => 280,
        ]);
        $answerResponse->assertOk();

        $testResult->refresh();
        expect($testResult->answers_given)->toHaveKey((string) $q1['id']);
    });

    it('can answer after skipping multiple questions', function () {
        $user = User::factory()->create();

        // Start a test
        $this->actingAs($user)->post('/test', [
            'test_type' => 'thematic',
            'question_count' => 5,
            'time_per_question' => 60,
            'failure_threshold' => 10,
            'category_ids' => [],
        ]);

        $testResult = TestResult::where('user_id', $user->id)->first();
        $questions = $testResult->questions_with_answers;

        // Skip questions 0, 1, 2
        foreach ([0, 1, 2] as $i) {
            $this->actingAs($user)->post("/test/{$testResult->id}/skip", [
                'question_id' => $questions[$i]['id'],
            ])->assertOk();
        }

        $testResult->refresh();
        expect(count($testResult->skipped_question_ids))->toBe(3);

        // Answer question 3
        $this->actingAs($user)->post("/test/{$testResult->id}/answer", [
            'question_id' => $questions[3]['id'],
            'answer_id' => $questions[3]['answers'][0]['id'],
            'remaining_time' => 250,
        ])->assertOk();

        $testResult->refresh();
        expect($testResult->answers_given)->toHaveKey((string) $questions[3]['id']);
        expect(count($testResult->skipped_question_ids))->toBe(3);
    });

    it('can interleave skip and answer operations', function () {
        $user = User::factory()->create();

        // Start a test
        $this->actingAs($user)->post('/test', [
            'test_type' => 'thematic',
            'question_count' => 5,
            'time_per_question' => 60,
            'failure_threshold' => 10,
            'category_ids' => [],
        ]);

        $testResult = TestResult::where('user_id', $user->id)->first();
        $questions = $testResult->questions_with_answers;

        // Answer Q0
        $this->actingAs($user)->post("/test/{$testResult->id}/answer", [
            'question_id' => $questions[0]['id'],
            'answer_id' => $questions[0]['answers'][0]['id'],
            'remaining_time' => 290,
        ])->assertOk();

        // Skip Q1
        $this->actingAs($user)->post("/test/{$testResult->id}/skip", [
            'question_id' => $questions[1]['id'],
        ])->assertOk();

        // Answer Q2
        $this->actingAs($user)->post("/test/{$testResult->id}/answer", [
            'question_id' => $questions[2]['id'],
            'answer_id' => $questions[2]['answers'][0]['id'],
            'remaining_time' => 270,
        ])->assertOk();

        // Skip Q3
        $this->actingAs($user)->post("/test/{$testResult->id}/skip", [
            'question_id' => $questions[3]['id'],
        ])->assertOk();

        // Answer Q4
        $this->actingAs($user)->post("/test/{$testResult->id}/answer", [
            'question_id' => $questions[4]['id'],
            'answer_id' => $questions[4]['answers'][0]['id'],
            'remaining_time' => 250,
        ])->assertOk();

        $testResult->refresh();
        expect(count($testResult->answers_given))->toBe(3);
        expect(count($testResult->skipped_question_ids))->toBe(2);
    });
});

describe('Continue after failure', function () {
    it('can continue answering after exceeding failure threshold', function () {
        $user = User::factory()->create();

        // Start a test with low failure threshold
        $this->actingAs($user)->post('/test', [
            'test_type' => 'thematic',
            'question_count' => 5,
            'time_per_question' => 60,
            'failure_threshold' => 5, // 5% = 0 allowed wrong for 5 questions
            'category_ids' => [],
        ]);

        $testResult = TestResult::where('user_id', $user->id)->first();
        $questions = $testResult->questions_with_answers;

        // Answer first question wrong (exceed threshold)
        $wrongAnswer = collect($questions[0]['answers'])->firstWhere('is_correct', false);
        $response = $this->actingAs($user)->post("/test/{$testResult->id}/answer", [
            'question_id' => $questions[0]['id'],
            'answer_id' => $wrongAnswer['id'],
            'remaining_time' => 290,
        ]);

        $response->assertOk();
        $data = $response->json();
        expect($data['has_exceeded_mistakes'])->toBeTrue();

        $testResult->refresh();
        expect($testResult->wrong_count)->toBe(1);

        // User can continue answering (practice mode)
        $response2 = $this->actingAs($user)->post("/test/{$testResult->id}/answer", [
            'question_id' => $questions[1]['id'],
            'answer_id' => $questions[1]['answers'][0]['id'],
            'remaining_time' => 280,
        ]);

        $response2->assertOk();

        $testResult->refresh();
        expect(count($testResult->answers_given))->toBe(2);
    });
});

describe('Test restart with auto_advance', function () {
    it('defaults auto_advance to true when restarting test', function () {
        $user = User::factory()->create();

        // Start a test
        $this->actingAs($user)->post('/test', [
            'test_type' => 'thematic',
            'question_count' => 5,
            'time_per_question' => 60,
            'failure_threshold' => 10,
            'category_ids' => [],
        ]);

        $testResult = TestResult::where('user_id', $user->id)->first();

        // Capture question/answer IDs upfront
        $questionData = [];
        foreach ($testResult->questions_with_answers as $q) {
            $questionData[] = [
                'id' => $q['id'],
                'answer_id' => $q['answers'][0]['id'],
            ];
        }

        // Complete the test (answer all questions)
        foreach ($questionData as $qd) {
            $this->actingAs($user)->post("/test/{$testResult->id}/answer", [
                'question_id' => $qd['id'],
                'answer_id' => $qd['answer_id'],
                'remaining_time' => 200,
            ]);
        }

        // Complete the test
        $this->actingAs($user)->post("/test/{$testResult->id}/complete");

        $testResult->refresh();
        expect($testResult->status)->toBeIn([TestStatus::Completed, TestStatus::Passed, TestStatus::Failed]);

        // Restart the test (using new-similar route)
        $response = $this->actingAs($user)->post("/test/{$testResult->id}/new-similar");

        $response->assertRedirect();

        $newTest = TestResult::where('user_id', $user->id)
            ->where('id', '!=', $testResult->id)
            ->first();

        expect($newTest)->not->toBeNull();
        expect($newTest->configuration['auto_advance'])->toBeTrue();
    });
});
