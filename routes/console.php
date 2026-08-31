<?php

use App\Support\Platform;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Only the web build hands out guest accounts, and only the web build runs a
// scheduler. The device app has no cron.
if (Platform::isWeb()) {
    Schedule::command('app:prune-guest-users')->dailyAt('03:15');
}
