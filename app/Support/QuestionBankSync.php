<?php

namespace App\Support;

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Applies a versioned question-bank content pack to the live database.
 *
 * A pack is a standalone SQLite file holding reference data only. Applying one
 * upserts an explicit allowlist of reference tables and never writes to the
 * tables that hold a user's own data, so a released app update can refresh the
 * question bank without discarding progress, bookmarks, notes or test history.
 *
 * Retired questions are deactivated rather than deleted: `user_question_progress`
 * has an `on delete cascade` foreign key to `questions`, so deleting a question
 * would silently destroy that user's bookmark, note and correct/wrong counters.
 *
 * The pack is read through a second database connection rather than SQLite's
 * ATTACH. ATTACH is faster but refuses to run inside a transaction, which would
 * make the sync silently skip whenever a caller happened to hold one open. For a
 * mechanism whose whole job is delivering content to installed users, a silent
 * no-op is the worst available failure mode.
 */
class QuestionBankSync
{
    private const PACK_CONNECTION = 'question_bank_pack';

    private const CHUNK_SIZE = 500;

    /**
     * Reference tables copied from a pack, ordered parents before children so
     * foreign keys stay satisfied. A table absent from this list is never
     * written to, no matter what the pack contains.
     *
     * @var array<string, list<string>> table name => primary key columns
     */
    private const SYNCED_TABLES = [
        'question_categories' => ['id'],
        'license_types' => ['id'],
        'questions' => ['id'],
        'answers' => ['id'],
        'sign_categories' => ['id'],
        'signs' => ['id'],
        'sign_category_notes' => ['id'],
        'license_type_question' => ['license_type_id', 'question_id'],
        'question_sign' => ['question_id', 'sign_id'],
    ];

    /**
     * Child tables keyed by question, pruned for every question the pack ships
     * so an answer or licence link dropped upstream disappears here too.
     *
     * @var array<string, string> table name => column referencing questions.id
     */
    private const QUESTION_OWNED_TABLES = [
        'answers' => 'question_id',
        'license_type_question' => 'question_id',
        'question_sign' => 'question_id',
    ];

    /**
     * Tables owned by the user. Declared so the guarantee can be asserted in
     * tests rather than only described in a comment.
     *
     * @var list<string>
     */
    public const PROTECTED_TABLES = [
        'users',
        'sessions',
        'test_results',
        'test_templates',
        'user_question_progress',
        'user_statistics',
        'personal_access_tokens',
        'password_reset_tokens',
        'migrations',
    ];

    /**
     * Resolve a pack file name to an absolute path.
     *
     * On device the bundled asset does not sit where `database_path()` points,
     * so the same candidate list the initial database migration relies on is
     * used here. Returns null when the release ships no pack, which is a normal
     * state and not an error.
     */
    public static function locate(string $fileName): ?string
    {
        $candidates = [
            public_path($fileName),
            base_path('public/'.$fileName),
            base_path('database/'.$fileName),
            database_path($fileName),
            resource_path('database/'.$fileName),
            base_path($fileName),
        ];

        foreach ($candidates as $candidate) {
            if (is_file($candidate) && is_readable($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    /**
     * Apply a content pack, returning a summary of what changed.
     *
     * Never throws: a malformed or unreadable pack leaves the existing bank
     * untouched and is reported as a skipped sync. A shipped app must degrade to
     * stale content rather than fail to boot.
     *
     * @return array{applied: bool, reason: string|null, version: string|null, tables: array<string, int>, retired: int}
     */
    public function apply(string $packPath): array
    {
        if (! is_file($packPath) || ! is_readable($packPath)) {
            return $this->skipped('pack_not_found');
        }

        try {
            $pack = $this->connectToPack($packPath);

            if (! $this->packLooksValid($pack)) {
                return $this->skipped('pack_invalid');
            }

            return $this->copyFrom($pack, $packPath);
        } catch (Throwable $e) {
            Log::error('Question bank sync failed', [
                'pack' => $packPath,
                'error' => $e->getMessage(),
            ]);

            return $this->skipped('sync_failed');
        } finally {
            DB::purge(self::PACK_CONNECTION);
        }
    }

    private function connectToPack(string $packPath): ConnectionInterface
    {
        config([
            'database.connections.'.self::PACK_CONNECTION => [
                'driver' => 'sqlite',
                'database' => $packPath,
                'prefix' => '',
                'foreign_key_constraints' => false,
            ],
        ]);

        DB::purge(self::PACK_CONNECTION);

        return DB::connection(self::PACK_CONNECTION);
    }

    /**
     * A pack must carry the core tables and at least one question. An empty
     * questions table would otherwise deactivate the entire live bank.
     */
    private function packLooksValid(ConnectionInterface $pack): bool
    {
        foreach (['questions', 'answers', 'question_categories'] as $table) {
            if ($this->columnsFor($pack, $table) === []) {
                Log::warning('Question bank pack is missing a required table', ['table' => $table]);

                return false;
            }
        }

        if ($pack->table('questions')->count() === 0) {
            Log::warning('Question bank pack contains no questions, refusing to sync');

            return false;
        }

        return true;
    }

    /**
     * @return array{applied: bool, reason: string|null, version: string|null, tables: array<string, int>, retired: int}
     */
    private function copyFrom(ConnectionInterface $pack, string $packPath): array
    {
        $version = $this->resolveVersion($pack, $packPath);
        $tables = [];
        $retired = 0;

        DB::transaction(function () use ($pack, &$tables, &$retired): void {
            $packQuestionIds = $this->stageIds($pack, 'questions', ['id'], 'sync_question_ids');

            foreach (self::SYNCED_TABLES as $table => $primaryKey) {
                $tables[$table] = $this->upsertTable($pack, $table, $primaryKey);
            }

            foreach (self::QUESTION_OWNED_TABLES as $table => $questionColumn) {
                if ($this->columnsFor($pack, $table) !== []) {
                    $this->pruneQuestionOwnedRows($pack, $table, $questionColumn);
                }
            }

            $retired = $this->retireMissingQuestions($packQuestionIds);
        });

        return [
            'applied' => true,
            'reason' => null,
            'version' => $version,
            'tables' => $tables,
            'retired' => $retired,
        ];
    }

    /**
     * Copy a pack table's key columns into a temporary table on the live
     * connection, so membership tests stay set-based instead of binding
     * thousands of parameters into a NOT IN clause.
     */
    private function stageIds(ConnectionInterface $pack, string $table, array $keyColumns, string $stagingTable): string
    {
        $definition = collect($keyColumns)->map(fn (string $c): string => "\"{$c}\"")->implode(', ');

        DB::statement("DROP TABLE IF EXISTS temp.\"{$stagingTable}\"");
        DB::statement("CREATE TEMPORARY TABLE \"{$stagingTable}\" ({$definition})");

        $pack->table($table)
            ->select($keyColumns)
            ->orderBy($keyColumns[0])
            ->chunk(self::CHUNK_SIZE, function ($rows) use ($stagingTable): void {
                DB::table('temp.'.$stagingTable)->insert(
                    $rows->map(fn (object $row): array => (array) $row)->all()
                );
            });

        return $stagingTable;
    }

    /**
     * Insert every pack row, updating rows that already exist. Only columns
     * present in both schemas are touched, so a pack built against an older or
     * newer schema still applies cleanly.
     */
    private function upsertTable(ConnectionInterface $pack, string $table, array $primaryKey): int
    {
        $columns = array_values(array_intersect(
            $this->columnsFor(DB::connection(), $table),
            $this->columnsFor($pack, $table)
        ));

        if ($columns === []) {
            return 0;
        }

        $updatable = array_values(array_diff($columns, $primaryKey));
        $written = 0;

        $pack->table($table)
            ->select($columns)
            ->orderBy($primaryKey[0])
            ->chunk(self::CHUNK_SIZE, function ($rows) use ($table, $primaryKey, $updatable, &$written): void {
                $payload = $rows->map(fn (object $row): array => (array) $row)->all();

                DB::table($table)->upsert($payload, $primaryKey, $updatable);
                $written += count($payload);
            });

        return $written;
    }

    /**
     * Remove rows the pack replaces for the questions it ships. Scoped to
     * questions present in the pack, which leaves retired questions' rows intact.
     */
    private function pruneQuestionOwnedRows(ConnectionInterface $pack, string $table, string $questionColumn): void
    {
        $primaryKey = self::SYNCED_TABLES[$table];
        $staging = $this->stageIds($pack, $table, $primaryKey, 'sync_keys_'.$table);

        $matches = collect($primaryKey)
            ->map(fn (string $c): string => "staged.\"{$c}\" = main.\"{$table}\".\"{$c}\"")
            ->implode(' AND ');

        DB::statement(
            "DELETE FROM main.\"{$table}\"
             WHERE \"{$questionColumn}\" IN (SELECT id FROM temp.sync_question_ids)
               AND NOT EXISTS (
                   SELECT 1 FROM temp.\"{$staging}\" AS staged WHERE {$matches}
               )"
        );
    }

    /**
     * Deactivate questions the pack no longer ships. Never deletes them, because
     * the cascade from `user_question_progress` would take the user's bookmarks
     * and notes with it.
     */
    private function retireMissingQuestions(string $stagingTable): int
    {
        return DB::affectingStatement(
            "UPDATE main.questions
             SET is_active = 0
             WHERE is_active = 1
               AND id NOT IN (SELECT id FROM temp.\"{$stagingTable}\")"
        );
    }

    /**
     * Prefer a version declared by the pack, falling back to its file name.
     */
    private function resolveVersion(ConnectionInterface $pack, string $packPath): string
    {
        if ($this->columnsFor($pack, 'content_meta') !== []) {
            $declared = $pack->table('content_meta')->where('key', 'version')->value('value');

            if (is_string($declared) && $declared !== '') {
                return $declared;
            }
        }

        return pathinfo($packPath, PATHINFO_FILENAME);
    }

    /**
     * @return list<string>
     */
    private function columnsFor(ConnectionInterface $connection, string $table): array
    {
        try {
            return array_map(
                fn (object $column): string => $column->name,
                $connection->select("PRAGMA table_info(\"{$table}\")")
            );
        } catch (Throwable) {
            return [];
        }
    }

    /**
     * @return array{applied: bool, reason: string|null, version: string|null, tables: array<string, int>, retired: int}
     */
    private function skipped(string $reason): array
    {
        return [
            'applied' => false,
            'reason' => $reason,
            'version' => null,
            'tables' => [],
            'retired' => 0,
        ];
    }
}
