<?php

namespace App\Http\Controllers\Auth;

use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Turns a guest session into a real account, keeping the test history,
 * bookmarks and statistics the visitor built up while browsing anonymously.
 * Without this a guest's progress is a dead end.
 */
class GuestUpgradeController extends Controller
{
    use PasswordValidationRules, ProfileValidationRules;

    public function create(Request $request): Response|RedirectResponse
    {
        if (! $request->user()->is_guest) {
            return redirect()->route('dashboard');
        }

        return Inertia::render('auth/guest-upgrade');
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        abort_unless($user->is_guest, 403);

        $validated = $request->validate([
            'name' => $this->nameRules(),
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique(User::class)],
            'password' => $this->passwordRules(),
        ]);

        $user->forceFill([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => $validated['password'],
            'has_password' => true,
            'is_guest' => false,
        ])->save();

        return redirect()->route('dashboard');
    }
}
