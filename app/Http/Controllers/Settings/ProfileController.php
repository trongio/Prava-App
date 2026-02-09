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
        // Handle base64 image from NativePHP (mobile) - preferred method
        elseif ($request->filled('profile_image_base64')) {
            $base64Data = $request->input('profile_image_base64');

            // Parse data URL: data:image/jpeg;base64,/9j/4AAQ...
            if (preg_match('/^data:image\/(\w+);base64,(.+)$/', $base64Data, $matches)) {
                // Delete old image if exists
                if ($user->profile_image) {
                    Storage::disk('public')->delete($user->profile_image);
                }

                $extension = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
                $contents = base64_decode($matches[2]);

                if ($contents !== false) {
                    $filename = 'profile-images/'.uniqid().'.'.$extension;
                    Storage::disk('public')->put($filename, $contents);
                    $validated['profile_image'] = $filename;
                }
            }
        }
        // Handle NativePHP camera path (mobile) - fallback for legacy
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

        // Remove non-model attributes from validated data
        unset($validated['profile_image_path'], $validated['profile_image_base64']);

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

        // Revoke all Sanctum tokens
        $user->tokens()->delete();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
