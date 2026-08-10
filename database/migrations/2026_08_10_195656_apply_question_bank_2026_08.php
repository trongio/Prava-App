<?php

use App\Support\QuestionBankSync;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Apply the content pack shipped with this release, unless its version is
     * already recorded.
     *
     * The preceding migration shipped the sync mechanism before any pack
     * existed. On an install that already ran it, Laravel records it as done
     * and it can never apply a pack added later, so that release's content
     * would silently never arrive. Every pack therefore gets its own migration,
     * and each one is guarded by the pack's declared version so re-running or
     * running out of order is harmless.
     */
    public $withinTransaction = false;

    public function up(): void
    {
        if (! Schema::hasTable('content_packs')) {
            return;
        }

        $fileName = config('content_pack.file');

        if (! is_string($fileName) || $fileName === '') {
            return;
        }

        $packPath = QuestionBankSync::locate($fileName);

        if ($packPath === null) {
            Log::info('Question bank content pack not bundled with this release', ['file' => $fileName]);

            return;
        }

        $sync = new QuestionBankSync;
        $version = $sync->declaredVersion($packPath);

        if ($version !== null && DB::table('content_packs')->where('version', $version)->exists()) {
            return;
        }

        $result = $sync->apply($packPath);

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
        ]);
    }

    /**
     * Content is not rolled back: reverting would not restore the previous
     * questions and could only lose data.
     */
    public function down(): void
    {
        //
    }
};
