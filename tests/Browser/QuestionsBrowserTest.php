<?php

use App\Models\User;

test('questions page loads successfully', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $page = visit('/questions');

    $page->assertNoJavaScriptErrors();
});

test('questions page shows filters', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $page = visit('/questions');

    // The page should have filter elements
    $page->assertPresent('[data-slot="card"]')
        ->assertNoJavaScriptErrors();
});

test('questions page has content', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $page = visit('/questions');

    // Page should have card elements for filters/content
    $page->assertPresent('[data-slot="card"]')
        ->assertNoJavaScriptErrors();
});
