<?php

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

// ============================================
// GET /api/users - List users
// ============================================

test('api can get list of users', function () {
    User::factory()->count(3)->create();

    $response = $this->getJson('/api/users');

    $response->assertOk();
    $response->assertJsonStructure([
        'users' => [
            '*' => ['id', 'name', 'profile_image_url', 'has_password'],
        ],
    ]);
    $response->assertJsonCount(3, 'users');
});

test('api users list is ordered by name', function () {
    User::factory()->create(['name' => 'Charlie']);
    User::factory()->create(['name' => 'Alice']);
    User::factory()->create(['name' => 'Bob']);

    $response = $this->getJson('/api/users');

    $response->assertOk();
    $users = $response->json('users');
    expect($users[0]['name'])->toBe('Alice');
    expect($users[1]['name'])->toBe('Bob');
    expect($users[2]['name'])->toBe('Charlie');
});

test('api users list returns empty array when no users exist', function () {
    $response = $this->getJson('/api/users');

    $response->assertOk();
    $response->assertJson(['users' => []]);
});

// ============================================
// POST /api/login - Login
// ============================================

test('api can login user without password', function () {
    $user = User::factory()->create([
        'password' => null,
        'has_password' => false,
    ]);

    $response = $this->postJson('/api/login', [
        'user_id' => $user->id,
    ]);

    $response->assertOk();
    $response->assertJsonStructure([
        'user' => ['id', 'name', 'profile_image_url', 'has_password'],
        'token',
    ]);
    expect($response->json('user.id'))->toBe($user->id);
    expect($response->json('token'))->not->toBeEmpty();
});

test('api can login user with correct password', function () {
    $user = User::factory()->create([
        'password' => Hash::make('secret123'),
        'has_password' => true,
    ]);

    $response = $this->postJson('/api/login', [
        'user_id' => $user->id,
        'password' => 'secret123',
    ]);

    $response->assertOk();
    $response->assertJsonStructure([
        'user' => ['id', 'name', 'profile_image_url', 'has_password'],
        'token',
    ]);
    expect($response->json('user.id'))->toBe($user->id);
});

test('api login fails with incorrect password', function () {
    $user = User::factory()->create([
        'password' => Hash::make('secret123'),
        'has_password' => true,
    ]);

    $response = $this->postJson('/api/login', [
        'user_id' => $user->id,
        'password' => 'wrongpassword',
    ]);

    $response->assertUnprocessable();
    $response->assertJson([
        'message' => 'პაროლი არასწორია',
        'errors' => ['password' => ['პაროლი არასწორია']],
    ]);
});

test('api login fails with missing password when user has password', function () {
    $user = User::factory()->create([
        'password' => Hash::make('secret123'),
        'has_password' => true,
    ]);

    $response = $this->postJson('/api/login', [
        'user_id' => $user->id,
    ]);

    $response->assertUnprocessable();
});

test('api login requires valid user id', function () {
    $response = $this->postJson('/api/login', [
        'user_id' => 999,
    ]);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors('user_id');
});

test('api login requires user id', function () {
    $response = $this->postJson('/api/login', []);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors('user_id');
});

test('api login creates sanctum token', function () {
    $user = User::factory()->create([
        'password' => null,
        'has_password' => false,
    ]);

    $response = $this->postJson('/api/login', [
        'user_id' => $user->id,
    ]);

    $response->assertOk();

    // Verify token was created in database
    expect($user->tokens()->count())->toBe(1);
    expect($user->tokens()->first()->name)->toBe('mobile');
});

// ============================================
// POST /api/register - Register
// ============================================

test('api can register user without password', function () {
    $response = $this->postJson('/api/register', [
        'name' => 'New User',
    ]);

    $response->assertOk();
    $response->assertJsonStructure([
        'user' => ['id', 'name', 'profile_image_url', 'has_password'],
        'token',
    ]);
    expect($response->json('user.name'))->toBe('New User');
    expect($response->json('user.has_password'))->toBeFalse();
    expect($response->json('token'))->not->toBeEmpty();

    $this->assertDatabaseHas('users', [
        'name' => 'New User',
        'has_password' => false,
    ]);
});

test('api can register user with password', function () {
    $response = $this->postJson('/api/register', [
        'name' => 'New User',
        'password' => 'secret123',
    ]);

    $response->assertOk();
    expect($response->json('user.has_password'))->toBeTrue();

    $user = User::where('name', 'New User')->first();
    expect(Hash::check('secret123', $user->password))->toBeTrue();
});

test('api can register user with profile image', function () {
    Storage::fake('public');

    $response = $this->postJson('/api/register', [
        'name' => 'New User',
        'profile_image' => UploadedFile::fake()->image('avatar.jpg'),
    ]);

    $response->assertOk();

    $user = User::where('name', 'New User')->first();
    expect($user->profile_image)->not->toBeNull();
    Storage::disk('public')->assertExists($user->profile_image);
});

test('api registration requires name', function () {
    $response = $this->postJson('/api/register', []);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors('name');
});

test('api registration requires unique name', function () {
    User::factory()->create(['name' => 'Existing User']);

    $response = $this->postJson('/api/register', [
        'name' => 'Existing User',
    ]);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors('name');
});

test('api registration validates password minimum length', function () {
    $response = $this->postJson('/api/register', [
        'name' => 'New User',
        'password' => '123', // Less than 4 characters
    ]);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors('password');
});

test('api registration validates profile image is an image', function () {
    Storage::fake('public');

    $response = $this->postJson('/api/register', [
        'name' => 'New User',
        'profile_image' => UploadedFile::fake()->create('document.pdf', 100),
    ]);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors('profile_image');
});

test('api registration validates profile image size', function () {
    Storage::fake('public');

    $response = $this->postJson('/api/register', [
        'name' => 'New User',
        'profile_image' => UploadedFile::fake()->image('large.jpg')->size(3000), // > 2048 KB
    ]);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors('profile_image');
});

test('api registration creates sanctum token', function () {
    $response = $this->postJson('/api/register', [
        'name' => 'New User',
    ]);

    $response->assertOk();

    $user = User::where('name', 'New User')->first();
    expect($user->tokens()->count())->toBe(1);
    expect($user->tokens()->first()->name)->toBe('mobile');
});

// ============================================
// GET /api/user - Get authenticated user
// ============================================

test('api can get authenticated user with token', function () {
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    $response = $this->getJson('/api/user');

    $response->assertOk();
    $response->assertJsonStructure([
        'user' => ['id', 'name', 'profile_image_url', 'has_password'],
    ]);
    expect($response->json('user.id'))->toBe($user->id);
});

test('api user endpoint requires authentication', function () {
    $response = $this->getJson('/api/user');

    $response->assertUnauthorized();
});

// ============================================
// POST /api/logout - Logout
// ============================================

test('api can logout and revoke token', function () {
    $user = User::factory()->create();
    $token = $user->createToken('mobile')->plainTextToken;

    $response = $this->withHeader('Authorization', "Bearer {$token}")
        ->postJson('/api/logout');

    $response->assertOk();
    $response->assertJson(['message' => 'Logged out successfully']);

    // Verify token was revoked
    expect($user->tokens()->count())->toBe(0);
});

test('api logout requires authentication', function () {
    $response = $this->postJson('/api/logout');

    $response->assertUnauthorized();
});

test('api logout only revokes current token', function () {
    $user = User::factory()->create();
    $token1 = $user->createToken('mobile')->plainTextToken;
    $user->createToken('another-device');

    $this->withHeader('Authorization', "Bearer {$token1}")
        ->postJson('/api/logout');

    // Only one token should remain
    expect($user->tokens()->count())->toBe(1);
});
