<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Landing page for the web build. The device build shows a profile picker
 * here instead; on the web that would list every account on the server, so
 * visitors get sign in / register / continue as guest.
 */
class WebEntryController extends Controller
{
    public function index(): Response|RedirectResponse
    {
        if (Auth::check()) {
            return redirect()->route('dashboard');
        }

        return Inertia::render('auth/welcome');
    }
}
