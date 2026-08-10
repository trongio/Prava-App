<?php

use App\Support\QuestionBankSync;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * SQLite refuses ATTACH and DETACH inside a transaction, and the sync needs
     * both. Opt this migration out of the wrapping transaction explicitly rather
     * than relying on the framework's default.
     */
    public $withinTransaction = false;

    /**
     * Apply the question-bank content pack shipped with this release.
     *
     * The initial database migration copies a prebuilt SQLite file over the
     * whole database, so it can only ever run on a fresh install. Existing users
     * would otherwise stay on the bank they first installed. This migration is
     * the upgrade path: it merges reference data in place and leaves every table
     * a user owns alone.
     *
     * Deliberately fail-soft. A missing or malformed pack must leave the app
     * usable with the content it already has, never block boot.
     */
    public function up(): void
    {
        if (! Schema::hasTable('content_packs')) {
            Schema::create('content_packs', function (Blueprint $table): void {
                $table->id();
                $table->string('version');
                $table->timestamp('applied_at');
            });
        }

        $fileName = config('content_pack.file');

        if (! is_string($fileName) || $fileName === '') {
            return;
        }

        $packPath = QuestionBankSync::locate($fileName);

        if ($packPath === null) {
            Log::info('No question bank content pack shipped with this release', ['file' => $fileName]);

            return;
        }

        $result = (new QuestionBankSync)->apply($packPath);

        if (! $result['applied']) {
            Log::warning('Question bank content pack was not applied', [
                'file' => $fileName,
                'reason' => $result['reason'],
            ]);

            return;
        }

        DB::table('content_packs')->insert([
            'version' => $result['version'],
            'applied_at' => now(),
        ]);

        Log::info('Question bank content pack applied', [
            'version' => $result['version'],
            'retired' => $result['retired'],
            'tables' => $result['tables'],
        ]);
    }

    /**
     * Content is not rolled back. Reverting the bank would not restore the
     * previous questions and could only lose data, so this drops the tracking
     * table and nothing else.
     */
    public function down(): void
    {
        Schema::dropIfExists('content_packs');
    }
};
