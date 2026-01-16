<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

test('password can be updated', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->put(route('user-password.update'), [
            'current_password' => 'password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ]);

    $response->assertSessionHasNoErrors();

    $user->refresh();
    expect(Hash::check('new-password', $user->password))->toBeTrue();
    expect($user->has_password)->toBeTrue();
});

test('correct password must be provided to update password', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->put(route('user-password.update'), [
            'current_password' => 'wrong-password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ]);

    $response->assertSessionHasErrors('current_password');
});

test('user without password can set a new password', function () {
    $user = User::factory()->create([
        'password' => null,
        'has_password' => false,
    ]);

    $response = $this
        ->actingAs($user)
        ->put(route('user-password.update'), [
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ]);

    $response->assertSessionHasNoErrors();

    $user->refresh();
    expect(Hash::check('new-password', $user->password))->toBeTrue();
    expect($user->has_password)->toBeTrue();
});
