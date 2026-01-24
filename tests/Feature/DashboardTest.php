<?php

use App\Models\User;

test('guests are redirected to the home page', function () {
    $this->get(route('dashboard'))->assertRedirect('/');
});

test('authenticated users can visit the dashboard', function () {
    $this->actingAs($user = User::factory()->create());

    $this->get(route('dashboard'))->assertOk();
});
