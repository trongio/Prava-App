<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    /**
     * Copy pre-built database file.
     */
    public function up(): void
    {
        // Try multiple paths - on mobile, bundled files may be in different locations
        // Public directory is most reliable on mobile per NativePHP docs
        $possiblePaths = [
            public_path('seeded.sqlite'),
            base_path('public/seeded.sqlite'),
            base_path('database/seeded.sqlite'),
            database_path('seeded.sqlite'),
            resource_path('database/seeded.sqlite'),
            base_path('seeded.sqlite'),
        ];

        // Log all path resolutions for debugging
        Log::info('Database initialization starting', [
            'public_path' => public_path(),
            'base_path' => base_path(),
            'database_path' => database_path(),
        ]);

        // Collect debug info for mobile
        $debugInfo = [
            'public_path' => public_path(),
            'base_path' => base_path(),
            'database_path' => database_path(),
            'paths_checked' => [],
        ];

        $seededPath = null;
        foreach ($possiblePaths as $path) {
            $exists = file_exists($path);
            $readable = $exists ? is_readable($path) : false;
            $debugInfo['paths_checked'][$path] = ['exists' => $exists, 'readable' => $readable];

            if ($exists && $readable) {
                $seededPath = $path;
                break;
            }
        }

        if (! $seededPath) {
            // Use dd() so it shows in NativePHP WebView
            dd('seeded.sqlite not found!', $debugInfo);
        }

        Log::info('Found seeded.sqlite', ['path' => $seededPath]);

        // Try file copy first (faster ~3ms vs ~430ms for ATTACH)
        // Get actual DB path from connection since database_path() may differ on mobile
        if ($this->tryFileCopy($seededPath)) {
            Log::info('Database copied via file copy');

            return;
        }

        // Fallback to ATTACH method
        Log::info('File copy failed, trying ATTACH method');
        try {
            $this->copyViaAttach($seededPath);
        } catch (Throwable $e) {
            dd('ATTACH method failed!', [
                'seededPath' => $seededPath,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function tryFileCopy(string $seededPath): bool
    {
        try {
            // Get actual database path from the PDO connection
            // This works on NativePHP where database_path() returns wrong location
            $pdo = DB::connection()->getPdo();
            $dbList = $pdo->query('PRAGMA database_list')->fetch(\PDO::FETCH_ASSOC);
            $actualDbPath = $dbList['file'] ?? null;

            if (! $actualDbPath || ! is_writable(dirname($actualDbPath))) {
                Log::info('Cannot determine writable database path', ['dbList' => $dbList]);

                return false;
            }

            Log::info('Actual database path from PDO', ['path' => $actualDbPath]);

            // Disconnect before file operations
            DB::disconnect();

            // Copy seeded database over the current one
            $bytes = @copy($seededPath, $actualDbPath);

            // Reconnect
            DB::reconnect();

            if ($bytes && file_exists($actualDbPath) && filesize($actualDbPath) > 0) {
                Log::info('File copy successful', ['size' => filesize($actualDbPath)]);

                return true;
            }

            return false;
        } catch (Throwable $e) {
            Log::error('File copy failed', ['error' => $e->getMessage()]);
            DB::reconnect();

            return false;
        }
    }

    private function copyViaAttach(string $seededPath): void
    {
        Log::info('Starting ATTACH method', ['seededPath' => $seededPath]);

        try {
            DB::unprepared('PRAGMA foreign_keys = OFF');
            DB::unprepared("ATTACH DATABASE '{$seededPath}' AS seeded");

            $tables = DB::select("SELECT name FROM seeded.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations'");
            Log::info('Found tables in seeded database', ['count' => count($tables), 'tables' => array_map(fn ($t) => $t->name, $tables)]);

            foreach ($tables as $table) {
                $createSql = DB::selectOne("SELECT sql FROM seeded.sqlite_master WHERE type='table' AND name=?", [$table->name]);
                if ($createSql && $createSql->sql) {
                    Log::info("Creating table: {$table->name}");
                    DB::unprepared($createSql->sql);
                    DB::unprepared("INSERT INTO main.{$table->name} SELECT * FROM seeded.{$table->name}");
                    $count = DB::selectOne("SELECT COUNT(*) as cnt FROM main.{$table->name}");
                    Log::info("Inserted rows into {$table->name}", ['count' => $count->cnt ?? 0]);
                }
            }

            DB::unprepared('DETACH DATABASE seeded');
            DB::unprepared('PRAGMA foreign_keys = ON');
            Log::info('ATTACH method completed successfully');
        } catch (Throwable $e) {
            Log::error('ATTACH method failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            throw $e;
        }
    }

    public function down(): void
    {
        //
    }
};
