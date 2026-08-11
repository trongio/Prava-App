<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * The question browser runs on a device where PHP has a small memory budget and
 * exhausting it aborts the process. The page size therefore may not be taken
 * from the request unchecked: it reaches paginate() directly and is persisted to
 * the user's saved preferences, so one bad value would keep loading the whole
 * bank on every later visit.
 */
it('clamps an oversized page size to the largest the UI offers', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/questions?per_page=99999')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('filters.per_page', 100));
});

it('does not persist an oversized page size to the user preferences', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get('/questions?per_page=99999')->assertOk();

    expect($user->fresh()->question_filter_preferences['per_page'])->toBe(100);
});

it('recovers when a previously saved preference is out of range', function () {
    $user = User::factory()->create([
        'question_filter_preferences' => ['per_page' => 99999],
    ]);

    // No filter params, so the saved preference is what gets used.
    $this->actingAs($user)
        ->get('/questions')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('filters.per_page', 100));
});

it('never serves a page size of zero, which would return every row', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/questions?per_page=0')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('filters.per_page', 1));
});

it('leaves the sizes the UI actually offers alone', function (int $size) {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get("/questions?per_page={$size}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('filters.per_page', $size));
})->with([10, 20, 50, 100]);

it('falls back to the default when the page size is not a number', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/questions?per_page=all')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('filters.per_page', 20));
});
