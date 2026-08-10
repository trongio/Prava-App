<?php

use App\Models\Answer;
use App\Models\Question;
use App\Models\QuestionCategory;
use App\Models\TestResult;
use App\Models\TestTemplate;
use App\Models\User;
use App\Models\UserQuestionProgress;
use App\Models\UserStatistic;
use App\Support\QuestionBankSync;
use Illuminate\Support\Facades\DB;

/**
 * Build a standalone content pack on disk.
 *
 * @param  list<array{id: int, category_id: int, question: string, answers: list<array{id: int, text: string, is_correct: bool}>}>  $questions
 * @param  list<array{id: int, name: string}>  $categories
 */
function makePack(array $questions, array $categories = [], ?string $version = null): string
{
    $path = tempnam(sys_get_temp_dir(), 'pack_').'.sqlite';
    $pdo = new PDO('sqlite:'.$path);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $pdo->exec('CREATE TABLE question_categories (id integer primary key, name varchar not null, created_at datetime, updated_at datetime)');
    $pdo->exec('CREATE TABLE questions (id integer primary key, question_category_id integer not null, question text not null, description text, full_description text, image varchar, image_custom varchar, is_short_image tinyint(1) not null default 0, has_small_answers tinyint(1) not null default 0, is_active tinyint(1) not null default 1, created_at datetime, updated_at datetime)');
    $pdo->exec('CREATE TABLE answers (id integer primary key, question_id integer not null, text text not null, is_correct tinyint(1) not null default 0, position integer not null, created_at datetime, updated_at datetime)');

    if ($version !== null) {
        $pdo->exec('CREATE TABLE content_meta (key varchar primary key, value varchar)');
        $pdo->prepare('INSERT INTO content_meta (key, value) VALUES (?, ?)')->execute(['version', $version]);
    }

    $categories = $categories === [] ? [['id' => 900, 'name' => 'Pack category']] : $categories;

    foreach ($categories as $category) {
        $pdo->prepare('INSERT INTO question_categories (id, name) VALUES (?, ?)')
            ->execute([$category['id'], $category['name']]);
    }

    foreach ($questions as $question) {
        $pdo->prepare('INSERT INTO questions (id, question_category_id, question, is_active) VALUES (?, ?, ?, 1)')
            ->execute([$question['id'], $question['category_id'], $question['question']]);

        foreach ($question['answers'] as $position => $answer) {
            $pdo->prepare('INSERT INTO answers (id, question_id, text, is_correct, position) VALUES (?, ?, ?, ?, ?)')
                ->execute([$answer['id'], $question['id'], $answer['text'], (int) $answer['is_correct'], $position + 1]);
        }
    }

    return $path;
}

/**
 * Create a user carrying every kind of data the sync must never disturb.
 *
 * @return array{user: User, question: Question, progress: UserQuestionProgress, result: TestResult, template: TestTemplate}
 */
function seedUserWithProgress(Question $question): array
{
    $user = User::factory()->create();

    $progress = UserQuestionProgress::create([
        'user_id' => $user->id,
        'question_id' => $question->id,
        'times_correct' => 7,
        'times_wrong' => 2,
        'is_bookmarked' => true,
        'is_learned' => true,
        'notes' => 'Remember the priority rule here',
        'last_answered_at' => now(),
        'first_answered_at' => now()->subDay(),
    ]);

    UserStatistic::create([
        'user_id' => $user->id,
        'total_tests_taken' => 12,
        'total_correct_answers' => 300,
    ]);

    $result = TestResult::create([
        'user_id' => $user->id,
        'test_type' => 'thematic',
        'configuration' => ['question_count' => 30, 'time_per_question' => 60, 'failure_threshold' => 10],
        'questions_with_answers' => [[
            'id' => $question->id,
            'question' => $question->question,
            'answers' => [['id' => 1, 'text' => 'Snapshotted answer', 'is_correct' => true, 'position' => 1]],
        ]],
        'correct_count' => 25,
        'wrong_count' => 5,
        'total_questions' => 30,
        'score_percentage' => 83.3,
        'status' => TestResult::STATUS_PASSED,
        'started_at' => now()->subHour(),
        'finished_at' => now(),
    ]);

    $template = TestTemplate::create([
        'user_id' => $user->id,
        'name' => 'My drill',
        'question_count' => 30,
        'time_per_question' => 60,
        'failure_threshold' => 10,
    ]);

    return compact('user', 'question', 'progress', 'result', 'template');
}

describe('applying a pack', function () {
    it('inserts questions and answers the pack ships', function () {
        $category = QuestionCategory::factory()->create(['id' => 900]);

        $pack = makePack([[
            'id' => 5001,
            'category_id' => $category->id,
            'question' => 'A brand new 2026 question?',
            'answers' => [
                ['id' => 9001, 'text' => 'Correct', 'is_correct' => true],
                ['id' => 9002, 'text' => 'Wrong', 'is_correct' => false],
            ],
        ]]);

        $result = (new QuestionBankSync)->apply($pack);

        expect($result['applied'])->toBeTrue();
        expect(Question::find(5001)?->question)->toBe('A brand new 2026 question?');
        expect(Answer::where('question_id', 5001)->count())->toBe(2);
        expect(Answer::find(9001)?->is_correct)->toBeTrue();
    });

    it('updates the text of a question that already exists', function () {
        $category = QuestionCategory::factory()->create(['id' => 900]);
        $question = Question::factory()->create([
            'id' => 5002,
            'question_category_id' => $category->id,
            'question' => 'Outdated wording?',
        ]);

        $pack = makePack([[
            'id' => $question->id,
            'category_id' => $category->id,
            'question' => 'Corrected 2026 wording?',
            'answers' => [['id' => 9010, 'text' => 'Yes', 'is_correct' => true]],
        ]]);

        (new QuestionBankSync)->apply($pack);

        expect(Question::find(5002)?->question)->toBe('Corrected 2026 wording?');
    });

    it('reads the version declared by the pack', function () {
        $category = QuestionCategory::factory()->create(['id' => 900]);

        $pack = makePack([[
            'id' => 5003,
            'category_id' => $category->id,
            'question' => 'Versioned?',
            'answers' => [['id' => 9020, 'text' => 'Yes', 'is_correct' => true]],
        ]], version: '2026.08');

        expect((new QuestionBankSync)->apply($pack)['version'])->toBe('2026.08');
    });

    it('drops answers the pack no longer ships for that question', function () {
        $category = QuestionCategory::factory()->create(['id' => 900]);
        $question = Question::factory()->create(['id' => 5004, 'question_category_id' => $category->id]);
        Answer::factory()->create(['id' => 9030, 'question_id' => $question->id, 'position' => 1]);
        Answer::factory()->create(['id' => 9031, 'question_id' => $question->id, 'position' => 2]);

        $pack = makePack([[
            'id' => $question->id,
            'category_id' => $category->id,
            'question' => 'Now only one option?',
            'answers' => [['id' => 9030, 'text' => 'The only survivor', 'is_correct' => true]],
        ]]);

        (new QuestionBankSync)->apply($pack);

        expect(Answer::find(9030))->not->toBeNull();
        expect(Answer::find(9031))->toBeNull();
    });
});

describe('idempotency', function () {
    it('produces identical state when applied twice', function () {
        $category = QuestionCategory::factory()->create(['id' => 900]);

        $pack = makePack([[
            'id' => 5100,
            'category_id' => $category->id,
            'question' => 'Applied twice?',
            'answers' => [
                ['id' => 9100, 'text' => 'Correct', 'is_correct' => true],
                ['id' => 9101, 'text' => 'Wrong', 'is_correct' => false],
            ],
        ]]);

        $sync = new QuestionBankSync;
        $sync->apply($pack);

        $afterFirst = [
            'questions' => Question::orderBy('id')->get(['id', 'question', 'is_active'])->toArray(),
            'answers' => Answer::orderBy('id')->get(['id', 'question_id', 'text', 'is_correct'])->toArray(),
        ];

        $sync->apply($pack);

        expect([
            'questions' => Question::orderBy('id')->get(['id', 'question', 'is_active'])->toArray(),
            'answers' => Answer::orderBy('id')->get(['id', 'question_id', 'text', 'is_correct'])->toArray(),
        ])->toEqual($afterFirst);
    });
});

describe('retiring questions', function () {
    it('deactivates a question the pack no longer ships instead of deleting it', function () {
        $category = QuestionCategory::factory()->create(['id' => 900]);
        $retired = Question::factory()->create([
            'id' => 5200,
            'question_category_id' => $category->id,
            'is_active' => true,
        ]);

        $pack = makePack([[
            'id' => 5201,
            'category_id' => $category->id,
            'question' => 'The only question still in the bank?',
            'answers' => [['id' => 9200, 'text' => 'Yes', 'is_correct' => true]],
        ]]);

        (new QuestionBankSync)->apply($pack);

        $retired->refresh();

        expect($retired->exists)->toBeTrue();
        expect((bool) $retired->is_active)->toBeFalse();
    });

    it('keeps a user bookmark and note on a retired question', function () {
        $category = QuestionCategory::factory()->create(['id' => 900]);
        $retired = Question::factory()->create(['id' => 5300, 'question_category_id' => $category->id]);
        $seeded = seedUserWithProgress($retired);

        $pack = makePack([[
            'id' => 5301,
            'category_id' => $category->id,
            'question' => 'Replacement question?',
            'answers' => [['id' => 9300, 'text' => 'Yes', 'is_correct' => true]],
        ]]);

        (new QuestionBankSync)->apply($pack);

        $progress = UserQuestionProgress::find($seeded['progress']->id);

        expect($progress)->not->toBeNull();
        expect($progress->is_bookmarked)->toBeTrue();
        expect($progress->notes)->toBe('Remember the priority rule here');
        expect($progress->times_correct)->toBe(7);
    });
});

describe('user data is never touched', function () {
    it('preserves progress, statistics, history and templates across a sync', function () {
        $category = QuestionCategory::factory()->create(['id' => 900]);
        $question = Question::factory()->create(['id' => 5400, 'question_category_id' => $category->id]);
        $seeded = seedUserWithProgress($question);

        $pack = makePack([[
            'id' => 5401,
            'category_id' => $category->id,
            'question' => 'Entirely new bank?',
            'answers' => [['id' => 9400, 'text' => 'Yes', 'is_correct' => true]],
        ]]);

        $result = (new QuestionBankSync)->apply($pack);

        // Guard against a vacuous pass: the preservation claim only means
        // something if the sync actually did work.
        expect($result['applied'])->toBeTrue();
        expect(Question::find(5401))->not->toBeNull();

        expect(User::find($seeded['user']->id))->not->toBeNull();
        expect(UserStatistic::where('user_id', $seeded['user']->id)->first()?->total_tests_taken)->toBe(12);
        expect(TestResult::find($seeded['result']->id))->not->toBeNull();
        expect(TestTemplate::find($seeded['template']->id)?->name)->toBe('My drill');
    });

    it('leaves a stored test result snapshot readable after its question changes', function () {
        $category = QuestionCategory::factory()->create(['id' => 900]);
        $question = Question::factory()->create([
            'id' => 5500,
            'question_category_id' => $category->id,
            'question' => 'Original wording?',
        ]);
        $seeded = seedUserWithProgress($question);

        $pack = makePack([[
            'id' => $question->id,
            'category_id' => $category->id,
            'question' => 'Rewritten wording?',
            'answers' => [['id' => 9500, 'text' => 'Replaced answer', 'is_correct' => true]],
        ]]);

        expect((new QuestionBankSync)->apply($pack)['applied'])->toBeTrue();

        // The live question really was rewritten...
        expect(Question::find(5500)?->question)->toBe('Rewritten wording?');

        // ...while the stored result still renders exactly what was sat.
        $snapshot = TestResult::find($seeded['result']->id)->questions_with_answers;

        expect($snapshot[0]['question'])->toBe('Original wording?');
        expect($snapshot[0]['answers'][0]['text'])->toBe('Snapshotted answer');
    });

    it('never lists a user-owned table as syncable', function () {
        $reflection = new ReflectionClass(QuestionBankSync::class);
        $synced = array_keys($reflection->getConstant('SYNCED_TABLES'));

        expect(array_intersect($synced, QuestionBankSync::PROTECTED_TABLES))->toBe([]);
    });
});

describe('refusing bad packs', function () {
    it('skips a pack that does not exist', function () {
        $result = (new QuestionBankSync)->apply('/tmp/definitely-not-a-pack.sqlite');

        expect($result['applied'])->toBeFalse();
        expect($result['reason'])->toBe('pack_not_found');
    });

    it('refuses a pack with no questions so the live bank is not wiped', function () {
        $category = QuestionCategory::factory()->create(['id' => 900]);
        Question::factory()->count(3)->create(['question_category_id' => $category->id, 'is_active' => true]);

        $activeBefore = Question::where('is_active', true)->count();
        $result = (new QuestionBankSync)->apply(makePack([]));

        expect($result['applied'])->toBeFalse();
        expect($result['reason'])->toBe('pack_invalid');
        expect(Question::where('is_active', true)->count())->toBe($activeBefore);
    });

    it('skips a file that is not a usable pack without throwing', function () {
        $path = tempnam(sys_get_temp_dir(), 'junk_').'.sqlite';
        file_put_contents($path, 'this is not a database');

        $result = (new QuestionBankSync)->apply($path);

        expect($result['applied'])->toBeFalse();
        expect(Question::query()->count())->toBeGreaterThanOrEqual(0);
    });

    it('leaves the connection usable after a failed sync', function () {
        (new QuestionBankSync)->apply('/tmp/definitely-not-a-pack.sqlite');

        expect(DB::table('questions')->count())->toBeGreaterThanOrEqual(0);
    });
});
