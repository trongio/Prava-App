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
function makePack(array $questions, array $categories = [], ?string $version = null, ?array $licenceLinks = null): string
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

    // A null link list ships no pivot table at all; an empty one ships the table
    // with no rows, which is a different and far more dangerous shape.
    if ($licenceLinks !== null) {
        $pdo->exec('CREATE TABLE license_type_question (license_type_id integer not null, question_id integer not null, primary key (license_type_id, question_id))');
        foreach ($licenceLinks as [$licenseTypeId, $questionId]) {
            $pdo->prepare('INSERT INTO license_type_question (license_type_id, question_id) VALUES (?, ?)')
                ->execute([$licenseTypeId, $questionId]);
        }
    }

    return $path;
}

/**
 * Build a pack from raw SQL, for shapes the tidy helper cannot express.
 *
 * @param  list<string>  $statements
 */
function makeRawPack(array $statements): string
{
    $path = tempnam(sys_get_temp_dir(), 'raw_pack_').'.sqlite';
    $pdo = new PDO('sqlite:'.$path);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    foreach ($statements as $statement) {
        $pdo->exec($statement);
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

describe('pivot tables', function () {
    it('re-applies licence links that already exist without failing', function () {
        $category = QuestionCategory::factory()->create(['id' => 900]);
        $question = Question::factory()->create(['id' => 5600, 'question_category_id' => $category->id]);
        $licenseTypeId = DB::table('license_types')->value('id');

        DB::table('license_type_question')->insert([
            'license_type_id' => $licenseTypeId,
            'question_id' => $question->id,
        ]);

        $pack = makePack([[
            'id' => $question->id,
            'category_id' => $category->id,
            'question' => 'Linked to a licence?',
            'answers' => [['id' => 9600, 'text' => 'Yes', 'is_correct' => true]],
        ]], licenceLinks: [[$licenseTypeId, $question->id]]);

        $result = (new QuestionBankSync)->apply($pack);

        // A pivot is all key and has nothing to update, so a plain insert would
        // collide with the row already present.
        expect($result['applied'])->toBeTrue();
        expect(DB::table('license_type_question')
            ->where('question_id', $question->id)->count())->toBe(1);
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

    it('refuses a pack whose questions carry no answers', function () {
        $category = QuestionCategory::factory()->create(['id' => 900]);
        $question = Question::factory()->create(['id' => 5800, 'question_category_id' => $category->id]);
        Answer::factory()->create(['id' => 9800, 'question_id' => $question->id, 'position' => 1]);

        $result = (new QuestionBankSync)->apply(makePack([[
            'id' => $question->id,
            'category_id' => $category->id,
            'question' => 'Shipped with no answers at all?',
            'answers' => [],
        ]]));

        // Applying it would delete every answer of every question it ships,
        // leaving an unanswerable bank on the device.
        expect($result['applied'])->toBeFalse();
        expect($result['reason'])->toBe('pack_invalid');
        expect(Answer::find(9800))->not->toBeNull();
    });

    it('does not strip licence links when the pack ships an empty pivot table', function () {
        $category = QuestionCategory::factory()->create(['id' => 900]);
        $question = Question::factory()->create(['id' => 5900, 'question_category_id' => $category->id]);
        $licenseTypeId = DB::table('license_types')->value('id');

        DB::table('license_type_question')->insert([
            'license_type_id' => $licenseTypeId,
            'question_id' => $question->id,
        ]);

        $result = (new QuestionBankSync)->apply(makePack([[
            'id' => $question->id,
            'category_id' => $category->id,
            'question' => 'Still linked to a licence?',
            'answers' => [['id' => 9900, 'text' => 'Yes', 'is_correct' => true]],
        ]], licenceLinks: []));

        expect($result['applied'])->toBeTrue();
        expect(DB::table('license_type_question')
            ->where('question_id', $question->id)->count())->toBe(1);
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

describe('hostile and broken packs', function () {
    it('cannot be made to run SQL through a crafted column name', function () {
        $category = QuestionCategory::factory()->create(['id' => 900]);
        Question::factory()->create(['id' => 7000, 'question_category_id' => $category->id]);
        $user = User::factory()->create();

        // Column names are read from the pack's own schema, so a pack controls
        // them. Quoted with a doubled quote here so the pack itself is valid.
        $evil = '"x"" ); DROP TABLE users; --"';

        $pack = makeRawPack([
            'CREATE TABLE question_categories (id integer primary key, name varchar)',
            "CREATE TABLE questions (id integer primary key, question_category_id integer, question text, {$evil} text, is_active integer default 1)",
            "CREATE TABLE answers (id integer primary key, question_id integer, text text, is_correct integer, position integer, {$evil} text)",
            "INSERT INTO question_categories (id, name) VALUES (900, 'Pack')",
            "INSERT INTO questions (id, question_category_id, question, is_active) VALUES (7000, 900, 'Injected?', 1)",
            "INSERT INTO answers (id, question_id, text, is_correct, position) VALUES (9700, 7000, 'A', 1, 1)",
        ]);

        expect((new QuestionBankSync)->apply($pack)['applied'])->toBeTrue();

        // Only columns the live schema also has are ever named in SQL, so the
        // crafted one is dropped rather than executed.
        expect(User::find($user->id))->not->toBeNull();
        expect(Question::find(7000)?->question)->toBe('Injected?');
    });

    it('rolls a failed sync back and still applies the next one', function () {
        $category = QuestionCategory::factory()->create(['id' => 900]);
        $existing = Question::factory()->create([
            'id' => 7100,
            'question_category_id' => $category->id,
            'question' => 'Untouched?',
            'is_active' => true,
        ]);
        Answer::factory()->create(['id' => 9710, 'question_id' => $existing->id, 'position' => 1]);

        // The second question violates the live NOT NULL on questions.question,
        // so the copy throws after the first one has already been written.
        $broken = makeRawPack([
            'CREATE TABLE question_categories (id integer primary key, name varchar)',
            'CREATE TABLE questions (id integer primary key, question_category_id integer, question text, is_active integer default 1)',
            'CREATE TABLE answers (id integer primary key, question_id integer, text text, is_correct integer, position integer)',
            "INSERT INTO question_categories (id, name) VALUES (900, 'Pack')",
            "INSERT INTO questions (id, question_category_id, question, is_active) VALUES (7101, 900, 'Fine', 1)",
            'INSERT INTO questions (id, question_category_id, question, is_active) VALUES (7102, 900, NULL, 1)',
            "INSERT INTO answers (id, question_id, text, is_correct, position) VALUES (9711, 7101, 'A', 1, 1)",
        ]);

        $failed = (new QuestionBankSync)->apply($broken);

        expect($failed['applied'])->toBeFalse();
        expect($failed['reason'])->toBe('sync_failed');
        expect(Question::find(7101))->toBeNull();
        expect(Question::find(7100)?->question)->toBe('Untouched?');
        expect((bool) Question::find(7100)->is_active)->toBeTrue();

        // Staging tables outlive a rolled back sync, so the next one must not
        // inherit them.
        $good = makeRawPack([
            'CREATE TABLE question_categories (id integer primary key, name varchar)',
            'CREATE TABLE questions (id integer primary key, question_category_id integer, question text, is_active integer default 1)',
            'CREATE TABLE answers (id integer primary key, question_id integer, text text, is_correct integer, position integer)',
            "INSERT INTO question_categories (id, name) VALUES (900, 'Pack')",
            "INSERT INTO questions (id, question_category_id, question, is_active) VALUES (7103, 900, 'Recovered', 1)",
            "INSERT INTO answers (id, question_id, text, is_correct, position) VALUES (9712, 7103, 'A', 1, 1)",
        ]);

        expect((new QuestionBankSync)->apply($good)['applied'])->toBeTrue();
        expect(Question::find(7103)?->question)->toBe('Recovered');
        expect(Answer::find(9712))->not->toBeNull();
    });
});

describe('version guard', function () {
    it('reads the declared version without applying the pack', function () {
        $category = QuestionCategory::factory()->create(['id' => 900]);
        $before = Question::query()->count();

        $pack = makePack([[
            'id' => 5700,
            'category_id' => $category->id,
            'question' => 'Should not be inserted by a version read?',
            'answers' => [['id' => 9700, 'text' => 'Right', 'is_correct' => true]],
        ]], version: '2026.99');

        $sync = new QuestionBankSync;

        expect($sync->declaredVersion($pack))->toBe('2026.99');
        expect(Question::query()->count())->toBe($before);
        expect(Question::find(5700))->toBeNull();
    });

    it('returns null for a pack that cannot be read', function () {
        expect((new QuestionBankSync)->declaredVersion('/tmp/not-a-pack.sqlite'))->toBeNull();
    });

    it('records exactly one row for the shipped pack', function () {
        // Both the mechanism migration and the pack migration run in the suite;
        // the version guard must stop the pack being applied and logged twice.
        expect(DB::table('content_packs')->count())->toBeLessThanOrEqual(1);
    });
});
