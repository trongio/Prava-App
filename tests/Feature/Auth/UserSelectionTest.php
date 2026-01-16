<?php

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

test('home page shows user selection when not logged in', function () {
    $response = $this->get('/');

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('auth/user-selection')
        ->has('users')
    );
});

test('home page redirects to dashboard when logged in', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get('/')
        ->assertRedirect(route('dashboard'));
});

test('home page displays all existing users', function () {
    User::factory()->count(3)->create();

    $response = $this->get('/');

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('auth/user-selection')
        ->has('users', 3)
    );
});

test('user data includes name and profile image url', function () {
    Storage::fake('public');
    $user = User::factory()->create([
        'name' => 'Test User',
        'profile_image' => 'profile-images/test.jpg',
    ]);

    $response = $this->get('/');

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->where('users.0.name', 'Test User')
        ->has('users.0.profile_image_url')
    );
});

test('user can login without password when user has no password', function () {
    $user = User::factory()->create([
        'password' => null,
        'has_password' => false,
    ]);

    $response = $this->post('/login', [
        'user_id' => $user->id,
    ]);

    $response->assertRedirect(route('dashboard'));
    $this->assertAuthenticatedAs($user);
});

test('user can login with correct password when user has password', function () {
    $user = User::factory()->create([
        'password' => Hash::make('secret123'),
        'has_password' => true,
    ]);

    $response = $this->post('/login', [
        'user_id' => $user->id,
        'password' => 'secret123',
    ]);

    $response->assertRedirect(route('dashboard'));
    $this->assertAuthenticatedAs($user);
});

test('user cannot login with incorrect password', function () {
    $user = User::factory()->create([
        'password' => Hash::make('secret123'),
        'has_password' => true,
    ]);

    $response = $this->postJson('/login', [
        'user_id' => $user->id,
        'password' => 'wrongpassword',
    ]);

    $response->assertStatus(422);
    $response->assertJson(['error' => 'პაროლი არასწორია']);
    $this->assertGuest();
});

test('login requires valid user id', function () {
    $response = $this->postJson('/login', [
        'user_id' => 999,
    ]);

    $response->assertStatus(422);
    $this->assertGuest();
});

test('user can register without password', function () {
    $response = $this->post('/register', [
        'name' => 'New User',
    ]);

    $response->assertRedirect(route('dashboard'));
    $this->assertAuthenticated();

    $user = User::where('name', 'New User')->first();
    expect($user)->not->toBeNull();
    expect($user->has_password)->toBeFalse();
});

test('user can register with password', function () {
    $response = $this->post('/register', [
        'name' => 'New User',
        'password' => 'secret123',
    ]);

    $response->assertRedirect(route('dashboard'));
    $this->assertAuthenticated();

    $user = User::where('name', 'New User')->first();
    expect($user)->not->toBeNull();
    expect($user->has_password)->toBeTrue();
    expect(Hash::check('secret123', $user->password))->toBeTrue();
});

test('user can register with profile image', function () {
    Storage::fake('public');

    $response = $this->post('/register', [
        'name' => 'New User',
        'profile_image' => UploadedFile::fake()->image('avatar.jpg'),
    ]);

    $response->assertRedirect(route('dashboard'));

    $user = User::where('name', 'New User')->first();
    expect($user)->not->toBeNull();
    expect($user->profile_image)->not->toBeNull();
    Storage::disk('public')->assertExists($user->profile_image);
});

test('registration requires unique name', function () {
    User::factory()->create(['name' => 'Existing User']);

    $response = $this->postJson('/register', [
        'name' => 'Existing User',
    ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors('name');
});

test('registration requires name to be provided', function () {
    $response = $this->postJson('/register', []);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors('name');
});

test('registration validates password minimum length', function () {
    $response = $this->postJson('/register', [
        'name' => 'Test User',
        'password' => '123', // Less than 4 characters
    ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors('password');
});

test('registration validates profile image is an image', function () {
    Storage::fake('public');

    $response = $this->postJson('/register', [
        'name' => 'Test User',
        'profile_image' => UploadedFile::fake()->create('document.pdf', 100),
    ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors('profile_image');
});

test('registration validates profile image size', function () {
    Storage::fake('public');

    $response = $this->postJson('/register', [
        'name' => 'Test User',
        'profile_image' => UploadedFile::fake()->image('large.jpg')->size(3000), // > 2048 KB
    ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors('profile_image');
});

test('authenticated user can update profile image', function () {
    Storage::fake('public');
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->postJson('/profile/image', [
            'profile_image' => UploadedFile::fake()->image('new-avatar.jpg'),
        ]);

    $response->assertOk();
    $response->assertJsonStructure(['profile_image_url']);

    $user->refresh();
    expect($user->profile_image)->not->toBeNull();
    Storage::disk('public')->assertExists($user->profile_image);
});

test('updating profile image deletes old image', function () {
    Storage::fake('public');
    $oldPath = 'profile-images/old-avatar.jpg';
    Storage::disk('public')->put($oldPath, 'old content');

    $user = User::factory()->create(['profile_image' => $oldPath]);

    $this->actingAs($user)
        ->postJson('/profile/image', [
            'profile_image' => UploadedFile::fake()->image('new-avatar.jpg'),
        ]);

    Storage::disk('public')->assertMissing($oldPath);
});

test('user can logout', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post('/logout')
        ->assertRedirect('/');

    $this->assertGuest();
});
