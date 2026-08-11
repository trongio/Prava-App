<?php

use App\Models\Answer;
use App\Models\LicenseType;
use App\Models\Question;
use App\Models\QuestionCategory;
use App\Models\TestResult;
use App\Models\User;

/**
 * Seed answerable questions, optionally tied to a licence category.
 *
 * @return list<Question>
 */
function seedAnswerableQuestions(int $categoryId, int $count, ?LicenseType $licenseType = null): array
{
    $questions = [];

    for ($i = 0; $i < $count; $i++) {
        $question = Question::factory()->create(['question_category_id' => $categoryId]);

        Answer::factory()->correct()->create(['question_id' => $question->id, 'position' => 1]);
        Answer::factory()->create(['question_id' => $question->id, 'position' => 2]);

        if ($licenseType !== null) {
            $question->licenseTypes()->attach($licenseType->id);
        }

        $questions[] = $question;
    }

    return $questions;
}

describe('the mistake allowance cannot be set by the client', function () {
    beforeEach(function () {
        $this->category = QuestionCategory::factory()->create();
        $this->user = User::factory()->create();
    });

    it('ignores an allowed_wrong posted with a new test', function () {
        seedAnswerableQuestions($this->category->id, 10);

        $this->actingAs($this->user)->postJson('/test', [
            'test_type' => 'thematic',
            'question_count' => 10,
            'time_per_question' => 60,
            'failure_threshold' => 10,
            'allowed_wrong' => 10,
        ])->assertRedirect();

        $testResult = TestResult::forUser($this->user->id)->active()->firstOrFail();

        // Derived from the threshold the user chose, not from what was posted.
        expect($testResult->configuration['allowed_wrong'])->toBe(1)
            ->and($testResult->getAllowedWrong())->toBe(1);
    });

    it('fails a test whose every answer was wrong even when allowed_wrong was rigged', function () {
        seedAnswerableQuestions($this->category->id, 5);

        $this->actingAs($this->user)->postJson('/test', [
            'test_type' => 'thematic',
            'question_count' => 5,
            'time_per_question' => 60,
            'failure_threshold' => 10,
            'allowed_wrong' => 5,
        ])->assertRedirect();

        $testResult = TestResult::forUser($this->user->id)->active()->firstOrFail();

        foreach ($testResult->questions_with_answers as $question) {
            $wrongAnswer = collect($question['answers'])->firstWhere('is_correct', false);

            $this->actingAs($this->user)->postJson("/test/{$testResult->id}/answer", [
                'question_id' => $question['id'],
                'answer_id' => $wrongAnswer['id'],
                'remaining_time' => 100,
            ])->assertOk();
        }

        $this->actingAs($this->user)
            ->postJson("/test/{$testResult->id}/complete", ['remaining_time' => 100])
            ->assertOk()
            ->assertJson(['passed' => false]);

        expect($testResult->refresh()->status)->toBe(TestResult::STATUS_FAILED);
    });

    it('ignores an allowed_wrong posted with a quick start', function () {
        $licenseType = LicenseType::factory()->create(['code' => 'B']);
        seedAnswerableQuestions($this->category->id, 30, $licenseType);

        $user = User::factory()->create(['default_license_type_id' => $licenseType->id]);

        $this->actingAs($user)->postJson('/test/quick', ['allowed_wrong' => 30])->assertRedirect();

        $testResult = TestResult::forUser($user->id)->active()->firstOrFail();

        expect($testResult->getAllowedWrong())->toBe(5);
    });

    it('ignores an allowed_wrong posted when repeating a similar test', function () {
        seedAnswerableQuestions($this->category->id, 10);

        $sat = TestResult::create([
            'user_id' => $this->user->id,
            'test_type' => 'thematic',
            'configuration' => [
                'question_count' => 10,
                'time_per_question' => 60,
                'failure_threshold' => 10,
                'allowed_wrong' => 2,
                'category_ids' => [],
            ],
            'questions_with_answers' => [],
            'correct_count' => 8,
            'wrong_count' => 2,
            'total_questions' => 10,
            'score_percentage' => 80,
            'status' => TestResult::STATUS_PASSED,
            'started_at' => now()->subMinutes(10),
            'finished_at' => now(),
        ]);

        $this->actingAs($this->user)
            ->postJson("/test/{$sat->id}/new-similar", ['allowed_wrong' => 10])
            ->assertRedirect();

        $testResult = TestResult::forUser($this->user->id)->active()->firstOrFail();

        // The allowance of the sitting being repeated, not the posted one.
        expect($testResult->getAllowedWrong())->toBe(2);
    });

    it('still clamps a server resolved allowance to the questions actually drawn', function () {
        $licenseType = LicenseType::factory()->create(['code' => 'AM']);
        seedAnswerableQuestions($this->category->id, 1, $licenseType);

        $user = User::factory()->create(['default_license_type_id' => $licenseType->id]);

        $this->actingAs($user)->postJson('/test/quick')->assertRedirect();

        $testResult = TestResult::forUser($user->id)->active()->firstOrFail();

        // The AM paper allows 2 mistakes, but only one question could be drawn.
        expect($testResult->total_questions)->toBe(1)
            ->and($testResult->getAllowedWrong())->toBe(1);
    });
});
