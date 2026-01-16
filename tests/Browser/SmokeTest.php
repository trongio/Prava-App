<?php

use App\Models\User;

test('all public pages load without javascript errors', function () {
    $page = visit('/');

    $page->assertNoJavaScriptErrors();
});

test('all authenticated pages load without javascript errors', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $pages = visit([
        '/dashboard',
        '/questions',
        '/signs',
        '/settings/profile',
        '/settings/password',
        '/settings/appearance',
    ]);

    $pages->assertNoJavaScriptErrors();
});

test('home page screenshot matches', function () {
    $page = visit('/');

    $page->assertScreenshotMatches();
})->skip('Run manually to establish baseline');

test('dashboard screenshot matches', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $page = visit('/dashboard');

    $page->assertScreenshotMatches();
})->skip('Run manually to establish baseline');
