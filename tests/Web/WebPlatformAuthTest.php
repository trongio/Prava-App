<?php

use App\Models\TestResult;
use App\Models\User;

it('shows the landing page instead of the device profile picker', function () {
    User::factory()->create(['name' => 'Existing Person']);

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('auth/welcome'))
        ->assertDontSee('Existing Person');
});

it('advertises the play store listing and the author links', function () {
    config([
        'review_prompt.store_web_url' => 'https://play.google.com/store/apps/details?id=com.prava.trongio',
        'author.github' => 'https://github.com/trongio',
        'author.linkedin' => null,
    ]);

    $this->get('/')->assertInertia(fn ($page) => $page
        ->component('auth/welcome')
        ->where('storeUrl', 'https://play.google.com/store/apps/details?id=com.prava.trongio')
        ->where('author.github', 'https://github.com/trongio')
        // Unset links are filtered out rather than rendered dead.
        ->missing('author.linkedin')
    );
});

it('does not expose the device profile listing or password-free login', function () {
    $user = User::factory()->create();

    $this->getJson('/api/users')->assertNotFound();
    $this->postJson('/api/login', ['user_id' => $user->id])->assertNotFound();
    $this->postJson('/api/register', ['name' => 'Someone'])->assertNotFound();
    $this->get('/native-file/preview?path=/etc/passwd')->assertNotFound();
});

it('registers a real account through fortify', function () {
    $this->post('/register', [
        'name' => 'New Person',
        'email' => 'new@example.com',
        'password' => 'super-secret-password',
        'password_confirmation' => 'super-secret-password',
    ])->assertRedirect();

    $user = User::where('email', 'new@example.com')->sole();

    expect($user->has_password)->toBeTrue()
        ->and($user->is_guest)->toBeFalse()
        ->and($this->isAuthenticated())->toBeTrue();
});

it('rejects registration without a unique email', function () {
    User::factory()->create(['email' => 'taken@example.com']);

    $this->post('/register', [
        'name' => 'New Person',
        'email' => 'taken@example.com',
        'password' => 'super-secret-password',
        'password_confirmation' => 'super-secret-password',
    ])->assertSessionHasErrors('email');

    $this->post('/register', [
        'name' => 'No Email',
        'password' => 'super-secret-password',
        'password_confirmation' => 'super-secret-password',
    ])->assertSessionHasErrors('email');
});

it('logs in with an email and password', function () {
    $user = User::factory()->create([
        'email' => 'person@example.com',
        'password' => 'super-secret-password',
    ]);

    $this->post('/login', [
        'email' => 'person@example.com',
        'password' => 'wrong-password',
    ])->assertSessionHasErrors();

    $this->assertGuest();

    $this->post('/login', [
        'email' => 'person@example.com',
        'password' => 'super-secret-password',
    ])->assertRedirect();

    $this->assertAuthenticatedAs($user);
});

it('starts a guest session without registering', function () {
    $this->post('/guest')->assertRedirect(route('onboarding.license'));

    $guest = User::where('is_guest', true)->sole();

    expect($guest->email)->toBeNull()
        ->and($guest->has_password)->toBeFalse();

    $this->assertAuthenticatedAs($guest);
    $this->get('/dashboard')->assertOk();
});

it('hides guests from every user listing', function () {
    User::factory()->create(['name' => 'Real Person']);
    User::factory()->create(['name' => 'Guest Person', 'is_guest' => true]);

    expect(User::selectable()->pluck('name')->all())->toBe(['Real Person']);
});

it('upgrades a guest to a real account, keeping their progress', function () {
    $this->post('/guest');
    $guest = User::where('is_guest', true)->sole();

    $result = TestResult::create([
        'user_id' => $guest->id,
        'test_type' => 'quick',
        'configuration' => ['question_count' => 1, 'time_per_question' => 60, 'failure_threshold' => 1, 'shuffle_seed' => 0.5],
        'questions_with_answers' => [],
        'total_questions' => 1,
        'correct_count' => 1,
        'wrong_count' => 0,
        'score_percentage' => 100,
        'status' => TestResult::STATUS_PASSED,
        'started_at' => now()->subMinute(),
        'finished_at' => now(),
        'current_question_index' => 1,
        'answers_given' => [],
        'skipped_question_ids' => [],
        'remaining_time_seconds' => 0,
        'time_taken_seconds' => 30,
    ]);

    $this->post('/guest/upgrade', [
        'name' => 'Converted Person',
        'email' => 'converted@example.com',
        'password' => 'super-secret-password',
        'password_confirmation' => 'super-secret-password',
    ])->assertRedirect(route('dashboard'));

    $guest->refresh();

    expect($guest->is_guest)->toBeFalse()
        ->and($guest->has_password)->toBeTrue()
        ->and($guest->email)->toBe('converted@example.com')
        ->and($guest->testResults()->whereKey($result->id)->exists())->toBeTrue();
});

it('refuses to upgrade an account that is not a guest', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post('/guest/upgrade', [
        'name' => 'Nope',
        'email' => 'nope@example.com',
        'password' => 'super-secret-password',
        'password_confirmation' => 'super-secret-password',
    ])->assertForbidden();
});

it('prunes guests that have gone stale but keeps active ones and real accounts', function () {
    $stale = User::factory()->create(['is_guest' => true, 'created_at' => now()->subDays(60)]);
    $recent = User::factory()->create(['is_guest' => true, 'created_at' => now()->subDay()]);
    $realAccount = User::factory()->create(['created_at' => now()->subYear()]);

    $stillPractising = User::factory()->create(['is_guest' => true, 'created_at' => now()->subDays(60)]);
    TestResult::create([
        'user_id' => $stillPractising->id,
        'test_type' => 'quick',
        'configuration' => ['question_count' => 1, 'time_per_question' => 60, 'failure_threshold' => 1, 'shuffle_seed' => 0.5],
        'questions_with_answers' => [],
        'total_questions' => 1,
        'correct_count' => 1,
        'wrong_count' => 0,
        'score_percentage' => 100,
        'status' => TestResult::STATUS_PASSED,
        'started_at' => now()->subMinute(),
        'finished_at' => now(),
        'current_question_index' => 1,
        'answers_given' => [],
        'skipped_question_ids' => [],
        'remaining_time_seconds' => 0,
        'time_taken_seconds' => 30,
        'created_at' => now()->subDay(),
    ]);

    $this->artisan('app:prune-guest-users')->assertSuccessful();

    expect(User::whereKey($stale->id)->exists())->toBeFalse()
        ->and(User::whereKey($recent->id)->exists())->toBeTrue()
        ->and(User::whereKey($realAccount->id)->exists())->toBeTrue()
        ->and(User::whereKey($stillPractising->id)->exists())->toBeTrue();
});
