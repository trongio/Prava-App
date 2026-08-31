<?php

use App\Http\Controllers\Auth\GuestSessionController;
use App\Http\Controllers\Auth\GuestUpgradeController;
use App\Http\Controllers\Auth\WebEntryController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\OnboardingController;
use App\Http\Controllers\QuestionBrowserController;
use App\Http\Controllers\ReviewPromptController;
use App\Http\Controllers\SignsController;
use App\Http\Controllers\TestController;
use App\Http\Controllers\TestHistoryController;
use App\Http\Controllers\TestTemplateController;
use App\Http\Controllers\UserSelectionController;
use App\Support\NativeMediaFile;
use App\Support\Platform;
use Illuminate\Support\Facades\Route;

if (Platform::isWeb()) {
    // Public web build: Fortify owns login/register/password reset. Anyone who
    // does not want an account can start a throwaway guest session instead.
    Route::get('/', [WebEntryController::class, 'index'])->name('home');
    Route::post('/guest', [GuestSessionController::class, 'store'])
        ->middleware('throttle:5,1')
        ->name('guest.store');
    Route::get('/guest/upgrade', [GuestUpgradeController::class, 'create'])
        ->middleware('auth')
        ->name('guest.upgrade.create');
    Route::post('/guest/upgrade', [GuestUpgradeController::class, 'store'])
        ->middleware(['auth', 'throttle:6,1'])
        ->name('guest.upgrade');
} else {
    // Device build: the database is local to one phone, so picking a profile
    // is the whole login. Registering the same URIs on the web would list
    // every account on the server and let anyone sign in as any of them.
    Route::get('/', [UserSelectionController::class, 'index'])->name('home');
    Route::post('/login', [UserSelectionController::class, 'login'])->name('login');
    Route::post('/register', [UserSelectionController::class, 'store'])->name('register');
}
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

// Convert native camera/gallery image to a base64 data URL for preview
// (GET to avoid NativePHP POST interception). The supplied path is resolved
// and validated as an image inside an allowed device location to prevent
// arbitrary file disclosure / path traversal. Device build only: there is no
// device filesystem to preview from on the web.
Route::get('/native-file/preview', function () {
    $resolved = NativeMediaFile::resolveImage(request()->query('path'));

    if ($resolved === null) {
        return response()->json(['error' => 'File not found or not an allowed image'], 404);
    }

    $contents = file_get_contents($resolved['path']);

    if ($contents === false) {
        return response()->json(['error' => 'Unable to read file'], 500);
    }

    return response()->json([
        'dataUrl' => "data:{$resolved['mime']};base64,".base64_encode($contents),
    ]);
})->name('native.file.preview')->middleware('native.only');

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

    // Play Store rating prompt (dismissal is permanent). Device build only.
    Route::middleware('native.only')->group(function () {
        Route::post('review-prompt/dismiss', [ReviewPromptController::class, 'dismiss'])->name('review-prompt.dismiss');
        Route::post('review-prompt/rate', [ReviewPromptController::class, 'rate'])->name('review-prompt.rate');
    });

    // Profile image update
    Route::post('/profile/image', [UserSelectionController::class, 'updateImage'])->name('profile.image.update');
});

require __DIR__.'/settings.php';
