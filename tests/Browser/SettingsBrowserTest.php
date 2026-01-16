<?php

use App\Models\User;

test('user can access profile settings', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $page = visit('/settings/profile');

    $page->assertSee($user->name)
        ->assertNoJavaScriptErrors();
});

test('profile settings page loads', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $page = visit('/settings/profile');

    $page->assertPathIs('/settings/profile')
        ->assertNoJavaScriptErrors();
});

test('user can access password settings', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $page = visit('/settings/password');

    $page->assertPathIs('/settings/password')
        ->assertNoJavaScriptErrors();
});

test('user can access appearance settings', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $page = visit('/settings/appearance');

    $page->assertPathIs('/settings/appearance')
        ->assertNoJavaScriptErrors();
});

test('settings pages load without javascript errors', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $pages = visit(['/settings/profile', '/settings/password', '/settings/appearance']);

    $pages->assertNoJavaScriptErrors();
});
