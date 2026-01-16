<?php

use App\Models\User;

test('settings root redirects to profile', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->get('/settings');

    $response->assertRedirect();
});

test('guests cannot access any settings page', function () {
    $this->get('/settings')->assertRedirect('/');
    $this->get(route('profile.edit'))->assertRedirect('/');
    $this->get(route('user-password.edit'))->assertRedirect('/');
    $this->get(route('appearance.edit'))->assertRedirect('/');
});

test('all settings pages share common data structure', function () {
    $user = User::factory()->create();

    $pages = [
        'profile.edit' => 'settings/profile',
        'user-password.edit' => 'settings/password',
        'appearance.edit' => 'settings/appearance',
    ];

    foreach ($pages as $route => $component) {
        $response = $this->actingAs($user)->get(route($route));
        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component($component)
        );
    }
});
