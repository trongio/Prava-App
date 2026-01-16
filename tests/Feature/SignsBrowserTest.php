<?php

use App\Models\Sign;
use App\Models\SignCategory;
use App\Models\User;

test('guests are redirected to home page when accessing signs', function () {
    $this->get(route('signs.index'))->assertRedirect('/');
});

test('authenticated users can view the signs browser page', function () {
    $this->actingAs(User::factory()->create());

    $response = $this->get(route('signs.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('signs/index')
        ->has('categories')
        ->has('totalSigns')
    );
});

test('signs page returns all categories with their signs', function () {
    $this->actingAs(User::factory()->create());

    $response = $this->get(route('signs.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('signs/index')
        ->has('categories', SignCategory::count())
    );
});

test('signs page returns correct total sign count', function () {
    $this->actingAs(User::factory()->create());

    $expectedCount = Sign::count();

    $response = $this->get(route('signs.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->where('totalSigns', $expectedCount)
    );
});

test('sign detail endpoint returns sign data with related questions count', function () {
    $this->actingAs(User::factory()->create());

    $sign = Sign::first();

    $response = $this->getJson(route('signs.show', $sign));

    $response->assertOk();
    $response->assertJsonStructure([
        'sign' => [
            'id',
            'title',
            'image',
            'description',
        ],
        'related_questions_count',
    ]);
});

test('sign detail includes category information', function () {
    $this->actingAs(User::factory()->create());

    $sign = Sign::with('signCategory')->first();

    $response = $this->getJson(route('signs.show', $sign));

    $response->assertOk();
    $response->assertJsonStructure([
        'sign' => [
            'sign_category',
        ],
    ]);
});

test('sign detail endpoint requires authentication', function () {
    $sign = Sign::first();

    $response = $this->getJson(route('signs.show', $sign));

    $response->assertUnauthorized();
});

test('categories are ordered by group number', function () {
    $this->actingAs(User::factory()->create());

    $response = $this->get(route('signs.index'));

    $response->assertOk();

    $categories = $response->original->getData()['page']['props']['categories'];

    // Verify categories are ordered by group_number
    $groupNumbers = collect($categories)->pluck('group_number')->toArray();
    $sortedGroupNumbers = collect($categories)->pluck('group_number')->sort()->values()->toArray();

    expect($groupNumbers)->toBe($sortedGroupNumbers);
});
