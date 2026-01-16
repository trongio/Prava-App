<?php

use App\Models\Answer;
use App\Models\LicenseType;
use App\Models\Question;
use App\Models\QuestionCategory;
use App\Models\User;
use App\Models\UserQuestionProgress;

test('guests are redirected to home page when accessing questions', function () {
    $this->get(route('questions.index'))->assertRedirect('/');
});

test('authenticated users can view the questions browser page', function () {
    $this->actingAs(User::factory()->create());

    $response = $this->get(route('questions.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('questions/index')
        ->has('questions')
        ->has('licenseTypes')
        ->has('categories')
        ->has('filters')
        ->has('stats')
    );
});

test('questions page returns paginated questions', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();
    Question::factory()->count(25)->for($category, 'questionCategory')->create();

    $response = $this->actingAs($user)->get(route('questions.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->has('questions.data', 20) // Default per_page is 20
        ->has('questions.links')
    );
});

test('questions page only shows active questions by default', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();

    // Count existing active questions
    $existingActiveCount = Question::where('is_active', true)->count();

    Question::factory()->count(3)->for($category, 'questionCategory')->create();
    Question::factory()->count(2)->inactive()->for($category, 'questionCategory')->create();

    $response = $this->actingAs($user)->get(route('questions.index'));

    $response->assertOk();

    // Verify inactive questions are not included (only active ones count)
    $totalActiveQuestions = Question::where('is_active', true)->count();
    expect($totalActiveQuestions)->toBe($existingActiveCount + 3);
});

test('questions page can show inactive questions when filter is applied', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();

    // Count existing questions
    $existingCount = Question::count();

    Question::factory()->count(3)->for($category, 'questionCategory')->create();
    Question::factory()->count(2)->inactive()->for($category, 'questionCategory')->create();

    $response = $this->actingAs($user)->get(route('questions.index', ['show_inactive' => true]));

    $response->assertOk();

    // Verify all questions (including inactive) are shown
    $totalQuestions = Question::count();
    expect($totalQuestions)->toBe($existingCount + 5);
});

test('questions can be filtered by category', function () {
    $user = User::factory()->create();
    $category1 = QuestionCategory::factory()->create();
    $category2 = QuestionCategory::factory()->create();

    Question::factory()->count(3)->for($category1, 'questionCategory')->create();
    Question::factory()->count(2)->for($category2, 'questionCategory')->create();

    $response = $this->actingAs($user)->get(route('questions.index', ['categories' => [$category1->id]]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->has('questions.data', 3)
    );
});

test('questions can be filtered by license type', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();
    $licenseType = LicenseType::factory()->create();

    $questionsWithLicense = Question::factory()->count(2)->for($category, 'questionCategory')->create();
    foreach ($questionsWithLicense as $question) {
        $question->licenseTypes()->attach($licenseType);
    }

    Question::factory()->count(3)->for($category, 'questionCategory')->create();

    $response = $this->actingAs($user)->get(route('questions.index', ['license_type' => $licenseType->id]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->has('questions.data', 2)
    );
});

test('questions can be filtered by bookmarked status', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();

    $question1 = Question::factory()->for($category, 'questionCategory')->create();
    $question2 = Question::factory()->for($category, 'questionCategory')->create();
    Question::factory()->count(3)->for($category, 'questionCategory')->create();

    UserQuestionProgress::create([
        'user_id' => $user->id,
        'question_id' => $question1->id,
        'is_bookmarked' => true,
    ]);
    UserQuestionProgress::create([
        'user_id' => $user->id,
        'question_id' => $question2->id,
        'is_bookmarked' => true,
    ]);

    $response = $this->actingAs($user)->get(route('questions.index', ['bookmarked' => true]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->has('questions.data', 2)
    );
});

test('questions filter preferences are saved to user', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();
    Question::factory()->for($category, 'questionCategory')->create();

    $this->actingAs($user)->get(route('questions.index', [
        'categories' => [$category->id],
        'bookmarked' => true,
        'per_page' => 10,
    ]));

    $user->refresh();
    expect($user->question_filter_preferences)->toBe([
        'license_type' => null,
        'categories' => [$category->id],
        'show_inactive' => false,
        'bookmarked' => true,
        'unanswered' => false,
        'per_page' => 10,
    ]);
});

test('user can answer a question correctly', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();
    $question = Question::factory()->for($category, 'questionCategory')->create();

    $correctAnswer = Answer::factory()->for($question)->correct()->create();
    Answer::factory()->count(3)->for($question)->create();

    $response = $this->actingAs($user)->postJson(route('questions.answer', $question), [
        'answer_id' => $correctAnswer->id,
    ]);

    $response->assertOk();
    $response->assertJson([
        'is_correct' => true,
        'correct_answer_id' => $correctAnswer->id,
    ]);

    $progress = UserQuestionProgress::where('user_id', $user->id)
        ->where('question_id', $question->id)
        ->first();

    expect($progress)->not->toBeNull();
    expect($progress->times_correct)->toBe(1);
    expect($progress->times_wrong)->toBe(0);
});

test('user can answer a question incorrectly', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();
    $question = Question::factory()->for($category, 'questionCategory')->create();

    $correctAnswer = Answer::factory()->for($question)->correct()->create();
    $wrongAnswer = Answer::factory()->for($question)->create();

    $response = $this->actingAs($user)->postJson(route('questions.answer', $question), [
        'answer_id' => $wrongAnswer->id,
    ]);

    $response->assertOk();
    $response->assertJson([
        'is_correct' => false,
        'correct_answer_id' => $correctAnswer->id,
    ]);

    $progress = UserQuestionProgress::where('user_id', $user->id)
        ->where('question_id', $question->id)
        ->first();

    expect($progress)->not->toBeNull();
    expect($progress->times_correct)->toBe(0);
    expect($progress->times_wrong)->toBe(1);
});

test('answering a question updates existing progress', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();
    $question = Question::factory()->for($category, 'questionCategory')->create();

    $correctAnswer = Answer::factory()->for($question)->correct()->create();

    // Create existing progress
    $progress = UserQuestionProgress::create([
        'user_id' => $user->id,
        'question_id' => $question->id,
        'times_correct' => 2,
        'times_wrong' => 1,
    ]);

    $this->actingAs($user)->postJson(route('questions.answer', $question), [
        'answer_id' => $correctAnswer->id,
    ]);

    $progress->refresh();
    expect($progress->times_correct)->toBe(3);
    expect($progress->times_wrong)->toBe(1);
});

test('answer response includes explanation', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();
    $question = Question::factory()->for($category, 'questionCategory')->create([
        'full_description' => 'This is the full explanation for the question.',
    ]);

    $correctAnswer = Answer::factory()->for($question)->correct()->create();

    $response = $this->actingAs($user)->postJson(route('questions.answer', $question), [
        'answer_id' => $correctAnswer->id,
    ]);

    $response->assertOk();
    $response->assertJson([
        'explanation' => 'This is the full explanation for the question.',
    ]);
});

test('answer requires valid answer id', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();
    $question = Question::factory()->for($category, 'questionCategory')->create();

    Answer::factory()->for($question)->correct()->create();

    $response = $this->actingAs($user)->postJson(route('questions.answer', $question), [
        'answer_id' => 999999,
    ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors('answer_id');
});

test('user can bookmark a question', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();
    $question = Question::factory()->for($category, 'questionCategory')->create();

    $response = $this->actingAs($user)->postJson(route('questions.bookmark', $question));

    $response->assertOk();
    $response->assertJson([
        'is_bookmarked' => true,
    ]);

    $progress = UserQuestionProgress::where('user_id', $user->id)
        ->where('question_id', $question->id)
        ->first();

    expect($progress)->not->toBeNull();
    expect($progress->is_bookmarked)->toBeTrue();
});

test('user can unbookmark a question', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();
    $question = Question::factory()->for($category, 'questionCategory')->create();

    // Create existing bookmarked progress
    UserQuestionProgress::create([
        'user_id' => $user->id,
        'question_id' => $question->id,
        'is_bookmarked' => true,
    ]);

    $response = $this->actingAs($user)->postJson(route('questions.bookmark', $question));

    $response->assertOk();
    $response->assertJson([
        'is_bookmarked' => false,
    ]);
});

test('questions page returns category counts', function () {
    $user = User::factory()->create();
    $category1 = QuestionCategory::factory()->create();
    $category2 = QuestionCategory::factory()->create();

    Question::factory()->count(3)->for($category1, 'questionCategory')->create();
    Question::factory()->count(5)->for($category2, 'questionCategory')->create();

    $response = $this->actingAs($user)->get(route('questions.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->has('categoryCounts')
        ->where("categoryCounts.{$category1->id}", 3)
        ->where("categoryCounts.{$category2->id}", 5)
    );
});

test('questions page returns stats', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();

    $initialTotal = Question::where('is_active', true)->count();
    Question::factory()->count(10)->for($category, 'questionCategory')->create();

    // Mark some as answered
    $answeredQuestions = Question::take(3)->get();
    foreach ($answeredQuestions as $question) {
        UserQuestionProgress::create([
            'user_id' => $user->id,
            'question_id' => $question->id,
        ]);
    }

    $response = $this->actingAs($user)->get(route('questions.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->has('stats')
        ->where('stats.total', $initialTotal + 10)
        ->where('stats.answered', 3)
    );
});

test('questions include user progress data', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();
    $question = Question::factory()->for($category, 'questionCategory')->create();

    UserQuestionProgress::create([
        'user_id' => $user->id,
        'question_id' => $question->id,
        'times_correct' => 5,
        'times_wrong' => 2,
        'is_bookmarked' => true,
    ]);

    // Filter to only get this specific question by category
    $response = $this->actingAs($user)->get(route('questions.index', ['categories' => [$category->id]]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->has('userProgress')
        ->where("userProgress.{$question->id}.times_correct", 5)
        ->where("userProgress.{$question->id}.times_wrong", 2)
        ->where("userProgress.{$question->id}.is_bookmarked", true)
    );
});

test('per page filter changes pagination', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();
    Question::factory()->count(30)->for($category, 'questionCategory')->create();

    $response = $this->actingAs($user)->get(route('questions.index', ['per_page' => 10]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->has('questions.data', 10)
    );
});

test('questions load with answers', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();
    $question = Question::factory()->for($category, 'questionCategory')->create();

    Answer::factory()->count(4)->for($question)->sequence(
        ['position' => 1],
        ['position' => 2],
        ['position' => 3],
        ['position' => 4],
    )->create();

    // Filter to only get questions from this specific category
    $response = $this->actingAs($user)->get(route('questions.index', ['categories' => [$category->id]]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->has('questions.data.0.answers', 4)
    );
});

test('questions can be filtered by unanswered status', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();

    $answeredQuestion = Question::factory()->for($category, 'questionCategory')->create();
    $unansweredQuestion1 = Question::factory()->for($category, 'questionCategory')->create();
    $unansweredQuestion2 = Question::factory()->for($category, 'questionCategory')->create();

    // Mark one question as answered
    UserQuestionProgress::create([
        'user_id' => $user->id,
        'question_id' => $answeredQuestion->id,
    ]);

    $response = $this->actingAs($user)->get(route('questions.index', [
        'categories' => [$category->id],
        'unanswered' => true,
    ]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->has('questions.data', 2)
    );
});

test('questions can be filtered by related sign', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();

    $sign = \App\Models\Sign::first();

    // Count existing questions with this sign
    $existingCount = $sign->questions()->where('is_active', true)->count();

    $questionWithSign = Question::factory()->for($category, 'questionCategory')->create();
    $questionWithSign->signs()->attach($sign);

    Question::factory()->count(3)->for($category, 'questionCategory')->create();

    $response = $this->actingAs($user)->get(route('questions.index', ['sign_id' => $sign->id]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->has('questions.data', $existingCount + 1)
        ->has('filterSign')
        ->where('filterSign.id', $sign->id)
    );
});

test('correct only filter returns empty when no session correct ids provided', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();
    Question::factory()->count(5)->for($category, 'questionCategory')->create();

    $response = $this->actingAs($user)->get(route('questions.index', [
        'correct_only' => true,
    ]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->has('questions.data', 0)
    );
});

test('wrong only filter returns empty when no session wrong ids provided', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();
    Question::factory()->count(5)->for($category, 'questionCategory')->create();

    $response = $this->actingAs($user)->get(route('questions.index', [
        'wrong_only' => true,
    ]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->has('questions.data', 0)
    );
});

test('correct only filter with session ids returns matching questions', function () {
    $user = User::factory()->create();
    $category = QuestionCategory::factory()->create();
    $question1 = Question::factory()->for($category, 'questionCategory')->create();
    $question2 = Question::factory()->for($category, 'questionCategory')->create();
    Question::factory()->count(3)->for($category, 'questionCategory')->create();

    $response = $this->actingAs($user)->get(route('questions.index', [
        'correct_only' => true,
        'session_correct_ids' => "{$question1->id},{$question2->id}",
    ]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->has('questions.data', 2)
    );
});

test('answer endpoint requires authentication', function () {
    $category = QuestionCategory::factory()->create();
    $question = Question::factory()->for($category, 'questionCategory')->create();
    $answer = Answer::factory()->for($question)->correct()->create();

    $response = $this->postJson(route('questions.answer', $question), [
        'answer_id' => $answer->id,
    ]);

    $response->assertUnauthorized();
});

test('bookmark endpoint requires authentication', function () {
    $category = QuestionCategory::factory()->create();
    $question = Question::factory()->for($category, 'questionCategory')->create();

    $response = $this->postJson(route('questions.bookmark', $question));

    $response->assertUnauthorized();
});
