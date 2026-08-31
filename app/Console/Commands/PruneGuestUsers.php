<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;

/**
 * Deletes guest accounts nobody has come back to.
 *
 * The web build hands out a throwaway user row to anyone who chooses to
 * practise without registering, so without this the table grows for every
 * visitor who never returns. A guest counts as active while they are still
 * taking tests; the cutoff is measured from their most recent test, falling
 * back to when the session was created.
 */
class PruneGuestUsers extends Command
{
    protected $signature = 'app:prune-guest-users {--days= : Override the retention window}';

    protected $description = 'Delete guest accounts that have been inactive past the retention window';

    public function handle(): int
    {
        $days = (int) ($this->option('days') ?? config('auth.guest_retention_days'));
        $cutoff = now()->subDays($days);

        $stale = User::query()
            ->where('is_guest', true)
            ->where('created_at', '<', $cutoff)
            ->whereDoesntHave('testResults', fn (Builder $query) => $query->where('created_at', '>=', $cutoff));

        $deleted = 0;

        // Chunked so a large backlog does not load every row at once. Related
        // rows go with the user through the cascading foreign keys.
        $stale->select('id')->chunkById(500, function ($users) use (&$deleted) {
            $deleted += User::whereIn('id', $users->pluck('id'))->delete();
        });

        $this->info("Pruned {$deleted} guest account(s) inactive since {$cutoff->toDateString()}.");

        return self::SUCCESS;
    }
}
