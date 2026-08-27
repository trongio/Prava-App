<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('review_prompt_dismissed_at')->nullable()->after('test_auto_advance');
            $table->timestamp('review_prompt_last_shown_at')->nullable()->after('review_prompt_dismissed_at');
            $table->unsignedInteger('review_prompt_shown_count')->default(0)->after('review_prompt_last_shown_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'review_prompt_dismissed_at',
                'review_prompt_last_shown_at',
                'review_prompt_shown_count',
            ]);
        });
    }
};
