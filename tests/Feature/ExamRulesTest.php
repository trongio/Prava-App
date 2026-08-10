<?php

use App\Models\Answer;
use App\Models\LicenseType;
use App\Models\Question;
use App\Models\QuestionCategory;
use App\Models\TestResult;
use App\Models\User;
use App\Support\ExamRules;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * Seed active, answerable questions, optionally tied to a licence category.
 */
function seedExamQuestions(int $categoryId, int $count, ?LicenseType $licenseType = null): void
{
    for ($i = 0; $i < $count; $i++) {
        $question = Question::factory()->create([
            'question_category_id' => $categoryId,
        ]);

        Answer::factory()->correct()->create(['question_id' => $question->id, 'position' => 1]);
        Answer::factory()->create(['question_id' => $question->id, 'position' => 2]);

        if ($licenseType !== null) {
            $question->licenseTypes()->attach($licenseType->id);
        }
    }
}

/**
 * Create a test result carrying the given configuration.
 */
function examTest(User $user, array $configuration, int $totalQuestions = 30, int $wrongCount = 0): TestResult
{
    return TestResult::create([
        'user_id' => $user->id,
        'test_type' => 'thematic',
        'configuration' => $configuration,
        'questions_with_answers' => [],
        'total_questions' => $totalQuestions,
        'correct_count' => 0,
        'wrong_count' => $wrongCount,
        'score_percentage' => 0,
        'status' => TestResult::STATUS_IN_PROGRESS,
        'started_at' => now(),
        'current_question_index' => 0,
        'answers_given' => [],
        'skipped_question_ids' => [],
        'remaining_time_seconds' => $totalQuestions * 60,
    ]);
}

describe('Official exam rules per licence category', function () {
    it('resolves the published rules for each licence code', function (string $code, int $questionCount, int $correctToPass, int $allowedWrong) {
        $spec = ExamRules::forCode($code);

        expect($spec['question_count'])->toBe($questionCount)
            ->and($spec['allowed_wrong'])->toBe($allowedWrong)
            ->and($spec['correct_to_pass'])->toBe($correctToPass);
    })->with([
        'B' => ['B', 30, 25, 5],
        'B1' => ['B1', 30, 25, 5],
        'A' => ['A', 30, 27, 3],
        'A1' => ['A1', 30, 27, 3],
        'A2' => ['A2', 30, 27, 3],
        'T' => ['T', 30, 27, 3],
        'S' => ['S', 30, 27, 3],
        'AM' => ['AM', 20, 18, 2],
        'C' => ['C', 40, 36, 4],
        'C1' => ['C1', 35, 32, 3],
        'D' => ['D', 40, 36, 4],
        'D1' => ['D1', 35, 32, 3],
    ]);

    it('falls back to the default spec for categories with no published rules', function (?string $code) {
        expect(ExamRules::forCode($code))
            ->question_count->toBe(30)
            ->allowed_wrong->toBe(3)
            ->correct_to_pass->toBe(27);
    })->with([
        'tram' => ['Tram'],
        'military' => ['Mil'],
        'unknown code' => ['ZZ'],
        'empty code' => [''],
        'missing code' => [null],
    ]);

    it('matches licence codes case-insensitively', function () {
        expect(ExamRules::forCode('b'))->toBe(ExamRules::forCode('B'));
    });

    it('grants 30 minutes for a 30 question paper', function () {
        $spec = ExamRules::forCode('B');

        expect($spec['time_per_question'])->toBe(60)
            ->and($spec['total_time_seconds'])->toBe(1800);
    });

    it('derives a percentage threshold that reproduces the mistake allowance', function () {
        foreach (ExamRules::all() as $spec) {
            $derived = (int) floor($spec['question_count'] * ($spec['failure_threshold'] / 100));

            expect($derived)->toBe($spec['allowed_wrong']);
        }
    });

    it('resolves the spec from a license type model and id', function () {
        $licenseType = LicenseType::factory()->create(['code' => 'AM']);

        expect(ExamRules::forLicenseType($licenseType)['allowed_wrong'])->toBe(2)
            ->and(ExamRules::forLicenseTypeId($licenseType->id)['allowed_wrong'])->toBe(2)
            ->and(ExamRules::forLicenseType(null)['allowed_wrong'])->toBe(3)
            ->and(ExamRules::forLicenseTypeId(null)['allowed_wrong'])->toBe(3)
            ->and(ExamRules::forLicenseTypeId(999999)['allowed_wrong'])->toBe(3);
    });

    it('exposes every spec keyed by code including the default', function () {
        $all = ExamRules::all();

        expect($all)->toHaveKeys(['default', 'B', 'AM', 'C', 'D1'])
            ->and($all['default']['allowed_wrong'])->toBe(3)
            ->and($all['B']['allowed_wrong'])->toBe(5);
    });
});

describe('TestResult mistake allowance', function () {
    beforeEach(function () {
        $this->user = User::factory()->create();
    });

    it('allows 5 mistakes on a new B category exam', function () {
        $spec = ExamRules::forCode('B');

        $testResult = examTest($this->user, [
            'question_count' => $spec['question_count'],
            'time_per_question' => $spec['time_per_question'],
            'failure_threshold' => $spec['failure_threshold'],
            'allowed_wrong' => $spec['allowed_wrong'],
        ]);

        expect($testResult->getAllowedWrong())->toBe(5);
    });

    it('keeps the legacy percentage result for tests saved without allowed_wrong', function (int $questionCount, int $threshold, int $expected) {
        $testResult = examTest($this->user, [
            'question_count' => $questionCount,
            'time_per_question' => 60,
            'failure_threshold' => $threshold,
        ], $questionCount);

        expect($testResult->getAllowedWrong())->toBe($expected);
    })->with([
        'old B exam stays at 3' => [30, 10, 3],
        'short practice test' => [5, 10, 0],
        'lenient practice test' => [20, 25, 5],
        'strict practice test' => [40, 5, 2],
    ]);

    it('prefers a stored allowed_wrong over the legacy percentage', function () {
        $testResult = examTest($this->user, [
            'question_count' => 30,
            'time_per_question' => 60,
            'failure_threshold' => 10,
            'allowed_wrong' => 5,
        ]);

        expect($testResult->getAllowedWrong())->toBe(5);
    });

    it('honours a stored allowance of zero mistakes', function () {
        $testResult = examTest($this->user, [
            'question_count' => 30,
            'time_per_question' => 60,
            'failure_threshold' => 10,
            'allowed_wrong' => 0,
        ]);

        expect($testResult->getAllowedWrong())->toBe(0);
    });

    it('fails a B category exam only on the 6th mistake', function () {
        $spec = ExamRules::forCode('B');
        $config = [
            'question_count' => $spec['question_count'],
            'time_per_question' => $spec['time_per_question'],
            'failure_threshold' => $spec['failure_threshold'],
            'allowed_wrong' => $spec['allowed_wrong'],
        ];

        expect(examTest($this->user, $config, 30, 5)->hasExceededMistakes())->toBeFalse()
            ->and(examTest($this->user, $config, 30, 6)->hasExceededMistakes())->toBeTrue();
    });

    it('fails an AM category exam on the 3rd mistake', function () {
        $spec = ExamRules::forCode('AM');
        $config = [
            'question_count' => $spec['question_count'],
            'time_per_question' => $spec['time_per_question'],
            'failure_threshold' => $spec['failure_threshold'],
            'allowed_wrong' => $spec['allowed_wrong'],
        ];

        expect(examTest($this->user, $config, 20, 2)->hasExceededMistakes())->toBeFalse()
            ->and(examTest($this->user, $config, 20, 3)->hasExceededMistakes())->toBeTrue();
    });
});

describe('Quick start uses the official rules', function () {
    beforeEach(function () {
        $this->category = QuestionCategory::factory()->create();
    });

    it('starts a 30 question B exam with a 5 mistake allowance', function () {
        $licenseType = LicenseType::factory()->create(['code' => 'B']);
        seedExamQuestions($this->category->id, 30, $licenseType);

        $user = User::factory()->create(['default_license_type_id' => $licenseType->id]);

        $this->actingAs($user)->postJson('/test/quick')->assertRedirect();

        $testResult = TestResult::forUser($user->id)->active()->firstOrFail();

        expect($testResult->total_questions)->toBe(30)
            ->and($testResult->configuration['allowed_wrong'])->toBe(5)
            ->and($testResult->configuration['time_per_question'])->toBe(60)
            ->and($testResult->getAllowedWrong())->toBe(5)
            ->and($testResult->remaining_time_seconds)->toBe(1800);
    });

    it('starts a 20 question AM exam with a 2 mistake allowance', function () {
        $licenseType = LicenseType::factory()->create(['code' => 'AM']);
        seedExamQuestions($this->category->id, 25, $licenseType);

        $user = User::factory()->create(['default_license_type_id' => $licenseType->id]);

        $this->actingAs($user)->postJson('/test/quick')->assertRedirect();

        $testResult = TestResult::forUser($user->id)->active()->firstOrFail();

        expect($testResult->total_questions)->toBe(20)
            ->and($testResult->getAllowedWrong())->toBe(2);
    });

    it('starts a 40 question C exam with a 4 mistake allowance', function () {
        $licenseType = LicenseType::factory()->create(['code' => 'C']);
        seedExamQuestions($this->category->id, 40, $licenseType);

        $user = User::factory()->create(['default_license_type_id' => $licenseType->id]);

        $this->actingAs($user)->postJson('/test/quick')->assertRedirect();

        $testResult = TestResult::forUser($user->id)->active()->firstOrFail();

        expect($testResult->total_questions)->toBe(40)
            ->and($testResult->getAllowedWrong())->toBe(4);
    });

    it('falls back to the default spec when the user has no default category', function () {
        $licenseType = LicenseType::factory()->create(['code' => 'B']);
        seedExamQuestions($this->category->id, 30, $licenseType);

        $user = User::factory()->create(['default_license_type_id' => null]);

        $this->actingAs($user)->postJson('/test/quick')->assertRedirect();

        $testResult = TestResult::forUser($user->id)->active()->firstOrFail();

        expect($testResult->total_questions)->toBe(30)
            ->and($testResult->getAllowedWrong())->toBe(3);
    });
});

describe('Custom tests keep their own rules', function () {
    beforeEach(function () {
        $this->category = QuestionCategory::factory()->create();

        seedExamQuestions($this->category->id, 10);
    });

    it('derives the allowance from the user chosen threshold', function () {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/test', [
            'test_type' => 'thematic',
            'question_count' => 10,
            'time_per_question' => 90,
            'failure_threshold' => 20,
        ])->assertRedirect();

        $testResult = TestResult::forUser($user->id)->active()->firstOrFail();

        expect($testResult->configuration['question_count'])->toBe(10)
            ->and($testResult->configuration['time_per_question'])->toBe(90)
            ->and($testResult->configuration['failure_threshold'])->toBe(20)
            ->and($testResult->getAllowedWrong())->toBe(2);
    });

    it('never allows more mistakes than there are questions', function () {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/test', [
            'test_type' => 'thematic',
            'question_count' => 5,
            'time_per_question' => 60,
            'failure_threshold' => 10,
            'allowed_wrong' => 40,
        ])->assertRedirect();

        $testResult = TestResult::forUser($user->id)->active()->firstOrFail();

        expect($testResult->getAllowedWrong())->toBe(5);
    });
});

describe('Exam rules reach the test configuration screen', function () {
    it('sends the full rule set to the test index page', function () {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('/test')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('examRules.default')
                ->where('examRules.B.allowed_wrong', 5)
                ->where('examRules.B.correct_to_pass', 25)
                ->where('examRules.AM.question_count', 20)
                ->where('examRules.C.question_count', 40)
            );
    });

    it('exposes rules for the category the user actually drives', function () {
        $licenseType = LicenseType::query()->where('code', 'B')->firstOrFail();
        $user = User::factory()->create(['default_license_type_id' => $licenseType->id]);

        $this->actingAs($user)
            ->get('/test')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('userDefaults.license_type_id', $licenseType->id)
                ->where('examRules.B.allowed_wrong', 5)
            );
    });
});

describe('Results report the allowance they were marked against', function () {
    it('sends the official allowance to the results screen', function () {
        $licenseType = LicenseType::query()->where('code', 'B')->firstOrFail();
        $user = User::factory()->create(['default_license_type_id' => $licenseType->id]);

        $testResult = TestResult::create([
            'user_id' => $user->id,
            'test_type' => 'thematic',
            'license_type_id' => $licenseType->id,
            'configuration' => [
                'question_count' => 30,
                'time_per_question' => 60,
                'failure_threshold' => 17,
                'allowed_wrong' => 5,
            ],
            'questions_with_answers' => [],
            'correct_count' => 26,
            'wrong_count' => 4,
            'total_questions' => 30,
            'score_percentage' => 86.7,
            'status' => TestResult::STATUS_PASSED,
            'started_at' => now()->subMinutes(20),
            'finished_at' => now(),
        ]);

        $this->actingAs($user)
            ->get("/test/{$testResult->id}/results")
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('testResult.allowed_wrong', 5)
                ->where('testResult.status', TestResult::STATUS_PASSED)
            );
    });
});
