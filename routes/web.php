<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\OnboardingController;
use App\Http\Controllers\QuestionBrowserController;
use App\Http\Controllers\SignsController;
use App\Http\Controllers\TestController;
use App\Http\Controllers\TestHistoryController;
use App\Http\Controllers\TestTemplateController;
use App\Http\Controllers\UserSelectionController;
use Illuminate\Support\Facades\Route;

// User Selection (Login/Register)
Route::get('/', [UserSelectionController::class, 'index'])->name('home');
Route::post('/login', [UserSelectionController::class, 'login'])->name('login');
Route::post('/register', [UserSelectionController::class, 'store'])->name('register');
Route::get('/auth/logout', function () {
    // Revoke all Sanctum tokens for the user
    if (auth()->check()) {
        auth()->user()->tokens()->delete();
    }

    auth()->logout();
    request()->session()->invalidate();
    request()->session()->regenerateToken();

    return redirect('/');
})->name('auth.logout');

// Convert native file to base64 data URL for preview (GET to avoid NativePHP POST interception)
Route::get('/native-file/preview', function () {
    $path = request()->query('path');

    if (! $path || ! file_exists($path)) {
        return response()->json(['error' => 'File not found', 'path' => $path], 404);
    }

    // Only allow files from app cache directory for security
    if (! str_contains($path, '/cache/')) {
        return response()->json(['error' => 'Access denied'], 403);
    }

    try {
        $contents = file_get_contents($path);
        $mimeType = mime_content_type($path) ?: 'image/jpeg';
        $base64 = base64_encode($contents);

        return response()->json([
            'dataUrl' => "data:{$mimeType};base64,{$base64}",
        ]);
    } catch (\Exception $e) {
        return response()->json(['error' => $e->getMessage()], 500);
    }
})->name('native.file.preview');

Route::middleware(['auth'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // Onboarding (license selection)
    Route::get('onboarding/license', [OnboardingController::class, 'licenseSelection'])->name('onboarding.license');
    Route::post('onboarding/license', [OnboardingController::class, 'saveLicense'])->name('onboarding.license.save');

    // Test System
    Route::get('test', [TestController::class, 'create'])->name('test.index');
    Route::post('test', [TestController::class, 'store'])->name('test.store');
    Route::post('test/quick', [TestController::class, 'quickStart'])->name('test.quick');

    // Test History (must be before test/{testResult} to prevent route conflict)
    Route::get('test/history', [TestHistoryController::class, 'index'])->name('test.history.index');
    Route::get('test/history/{testResult}', [TestHistoryController::class, 'show'])->name('test.history.show');
    Route::delete('test/history/{testResult}', [TestHistoryController::class, 'destroy'])->name('test.history.destroy');

    // Test taking routes (dynamic testResult parameter)
    Route::get('test/{testResult}', [TestController::class, 'show'])->name('test.show');
    Route::post('test/{testResult}/answer', [TestController::class, 'answer'])->name('test.answer');
    Route::post('test/{testResult}/pause', [TestController::class, 'pause'])->name('test.pause');
    Route::post('test/{testResult}/skip', [TestController::class, 'skip'])->name('test.skip');
    Route::post('test/{testResult}/complete', [TestController::class, 'complete'])->name('test.complete');
    Route::get('test/{testResult}/results', [TestController::class, 'results'])->name('test.results');
    Route::post('test/{testResult}/redo-same', [TestController::class, 'redoSame'])->name('test.redo-same');
    Route::post('test/{testResult}/new-similar', [TestController::class, 'newSimilar'])->name('test.new-similar');

    // Test Templates
    Route::get('templates', [TestTemplateController::class, 'index'])->name('templates.index');
    Route::post('templates', [TestTemplateController::class, 'store'])->name('templates.store');
    Route::put('templates/{testTemplate}', [TestTemplateController::class, 'update'])->name('templates.update');
    Route::delete('templates/{testTemplate}', [TestTemplateController::class, 'destroy'])->name('templates.destroy');

    // Question Browser
    Route::get('questions', [QuestionBrowserController::class, 'index'])->name('questions.index');
    Route::post('questions/{question}/answer', [QuestionBrowserController::class, 'answer'])->name('questions.answer');
    Route::post('questions/{question}/bookmark', [QuestionBrowserController::class, 'bookmark'])->name('questions.bookmark');

    // Signs Browser
    Route::get('signs', [SignsController::class, 'index'])->name('signs.index');
    Route::get('signs/{sign}', [SignsController::class, 'show'])->name('signs.show');

    // Profile image update
    Route::post('/profile/image', [UserSelectionController::class, 'updateImage'])->name('profile.image.update');
});

require __DIR__.'/settings.php';
