<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileDeleteRequest;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Show the user's profile settings page.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/profile', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Update the user's profile settings.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $user = $request->user();
        $validated = $request->validated();

        // Handle profile image upload (web)
        if ($request->hasFile('profile_image')) {
            // Delete old image if exists
            if ($user->profile_image) {
                Storage::disk('public')->delete($user->profile_image);
            }

            $path = $request->file('profile_image')->store('profile-images', 'public');
            $validated['profile_image'] = $path;
        }
        // Handle NativePHP camera path (mobile)
        elseif ($request->filled('profile_image_path')) {
            $nativePath = $request->input('profile_image_path');

            // Copy the native file to our storage
            if (file_exists($nativePath)) {
                // Delete old image if exists
                if ($user->profile_image) {
                    Storage::disk('public')->delete($user->profile_image);
                }

                $extension = pathinfo($nativePath, PATHINFO_EXTENSION) ?: 'jpg';
                $filename = 'profile-images/'.uniqid().'.'.$extension;
                $contents = file_get_contents($nativePath);

                if ($contents !== false) {
                    Storage::disk('public')->put($filename, $contents);
                    $validated['profile_image'] = $filename;
                }
            }
        }

        // Remove profile_image_path from validated data (not a model attribute)
        unset($validated['profile_image_path']);

        $user->fill($validated);
        $user->save();

        return back();
    }

    /**
     * Delete the user's account.
     */
    public function destroy(ProfileDeleteRequest $request): RedirectResponse
    {
        $user = $request->user();

        // Delete profile image if exists
        if ($user->profile_image) {
            Storage::disk('public')->delete($user->profile_image);
        }

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
