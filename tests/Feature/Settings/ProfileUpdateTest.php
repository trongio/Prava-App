<?php

use App\Models\User;

test('profile name can be updated', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->post(route('profile.update'), [
            'name' => 'Test User',
        ]);

    $response->assertSessionHasNoErrors();

    $user->refresh();

    expect($user->name)->toBe('Test User');
});

test('user can delete their account', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->delete(route('profile.destroy'), [
            'password' => 'password',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('home'));

    $this->assertGuest();
    expect($user->fresh())->toBeNull();
});

test('correct password must be provided to delete account', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->delete(route('profile.destroy'), [
            'password' => 'wrong-password',
        ]);

    $response->assertSessionHasErrors('password');

    expect($user->fresh())->not->toBeNull();
});

test('user without password can delete account without providing password', function () {
    $user = User::factory()->create([
        'password' => null,
        'has_password' => false,
    ]);

    $response = $this
        ->actingAs($user)
        ->delete(route('profile.destroy'));

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('home'));

    $this->assertGuest();
    expect($user->fresh())->toBeNull();
});
