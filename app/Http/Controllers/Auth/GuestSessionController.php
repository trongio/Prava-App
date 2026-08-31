<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

/**
 * Lets a web visitor start practising immediately, without registering.
 *
 * A guest gets a real (throwaway) user row so every existing feature - test
 * history, bookmarks, statistics - keeps working unchanged. The row is hidden
 * from every user listing and pruned once it goes stale.
 */
class GuestSessionController extends Controller
{
    public function store(): RedirectResponse
    {
        $guest = User::create([
            'name' => 'სტუმარი '.Str::upper(Str::random(5)),
            'is_guest' => true,
            'has_password' => false,
        ]);

        Auth::login($guest, true);

        return redirect()->route('onboarding.license');
    }
}
