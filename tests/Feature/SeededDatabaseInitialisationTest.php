<?php

use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

/**
 * The first migration seeds the question bank by copying the bundled
 * seeded.sqlite over the freshly created database file.
 *
 * Under WAL - which the web build turns on - the write-ahead log left behind
 * by the connection that created the migrations table used to be replayed on
 * the next open, silently restoring the empty database over the copy and
 * leaving every later migration failing with "no such table: test_results".
 *
 * Migrations run in a separate process here because they have to operate on a
 * real file with a real journal, which the in-memory test connection and its
 * surrounding transaction cannot provide.
 */
function migrateIntoTemporarySqlite(array $env = []): string
{
    $path = sys_get_temp_dir().'/seed-check-'.Str::random(8).'.sqlite';
    File::put($path, '');

    $process = new Process(
        ['php', 'artisan', 'migrate', '--force', '--no-interaction'],
        base_path(),
        array_merge($_ENV, [
            'APP_ENV' => 'local',
            'DB_CONNECTION' => 'sqlite',
            'DB_DATABASE' => $path,
        ], $env),
        null,
        120,
    );

    $process->run();

    expect($process->isSuccessful())->toBeTrue($process->getOutput().$process->getErrorOutput());

    return $path;
}

afterEach(function () {
    foreach (File::glob(sys_get_temp_dir().'/seed-check-*.sqlite*') as $leftover) {
        File::delete($leftover);
    }
});

it('seeds the question bank on a fresh database', function () {
    $pdo = new PDO('sqlite:'.migrateIntoTemporarySqlite());

    expect((int) $pdo->query('SELECT COUNT(*) FROM questions')->fetchColumn())
        ->toBeGreaterThan(1000);
});

it('seeds the question bank when the connection uses WAL', function () {
    $pdo = new PDO('sqlite:'.migrateIntoTemporarySqlite([
        'DB_JOURNAL_MODE' => 'WAL',
        'DB_SYNCHRONOUS' => 'NORMAL',
        'DB_BUSY_TIMEOUT' => '5000',
    ]));

    expect((int) $pdo->query('SELECT COUNT(*) FROM questions')->fetchColumn())
        ->toBeGreaterThan(1000)
        // Every later migration depends on the copied schema being visible.
        ->and($pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='test_results'")->fetchColumn())
        ->toBe('test_results');
});
