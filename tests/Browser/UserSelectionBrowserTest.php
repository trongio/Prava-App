<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

test('home page displays user selection screen', function () {
    $page = visit('/');

    $page->assertSee('აირჩიეთ მომხმარებელი')
        ->assertNoJavaScriptErrors();
});

test('users are displayed on the home page', function () {
    User::factory()->create(['name' => 'Test User One']);
    User::factory()->create(['name' => 'Test User Two']);

    $page = visit('/');

    $page->assertSee('Test User One')
        ->assertSee('Test User Two')
        ->assertNoJavaScriptErrors();
});

test('clicking a user without password logs in directly', function () {
    User::factory()->create([
        'name' => 'No Password User',
        'password' => null,
        'has_password' => false,
    ]);

    $page = visit('/');

    $page->click('No Password User')
        ->assertPathIs('/dashboard')
        ->assertNoJavaScriptErrors();
});

test('clicking a user with password shows password modal', function () {
    User::factory()->create([
        'name' => 'Password User',
        'password' => Hash::make('secret123'),
        'has_password' => true,
    ]);

    $page = visit('/');

    $page->click('Password User')
        ->assertSee('შესვლა')
        ->assertNoJavaScriptErrors();
});

test('user can log in with correct password', function () {
    User::factory()->create([
        'name' => 'Password User',
        'password' => Hash::make('secret123'),
        'has_password' => true,
    ]);

    $page = visit('/');

    $page->click('Password User')
        ->fill('input[type="password"]', 'secret123')
        ->click('შესვლა')
        ->assertPathIs('/dashboard')
        ->assertNoJavaScriptErrors();
});

test('user can create a new profile', function () {
    $page = visit('/');

    $page->click('ახალი მომხმარებელი')
        ->assertSee('ახალი მომხმარებელი')
        ->fill('input[placeholder="სახელი / მეტსახელი"]', 'Brand New User')
        ->click('დაწყება')
        ->assertPathIs('/dashboard')
        ->assertNoJavaScriptErrors();
});
