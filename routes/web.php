<?php

use App\Http\Controllers\QuestionBrowserController;
use App\Http\Controllers\SignsController;
use App\Http\Controllers\UserSelectionController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// User Selection (Login/Register)
Route::get('/', [UserSelectionController::class, 'index'])->name('home');
Route::post('/login', [UserSelectionController::class, 'login'])->name('login');
Route::post('/register', [UserSelectionController::class, 'store'])->name('register');
Route::post('/logout', function () {
    auth()->logout();
    request()->session()->invalidate();
    request()->session()->regenerateToken();

    return redirect()->route('home');
})->name('logout');

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
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

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
