<?php

use App\Models\User;

test('signs page loads successfully', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $page = visit('/signs');

    $page->assertNoJavaScriptErrors();
});

test('signs page displays content', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $page = visit('/signs');

    // The page should show sign categories or content
    $page->assertSee('ნიშნები')
        ->assertNoJavaScriptErrors();
});
