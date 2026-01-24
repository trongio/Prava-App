<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class AuthController extends Controller
{
    /**
     * Get list of users for selection screen.
     */
    public function users(): JsonResponse
    {
        $users = User::select(['id', 'name', 'profile_image', 'has_password'])
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'profile_image_url' => $user->profile_image_url,
                'has_password' => $user->has_password,
            ]);

        return response()->json(['users' => $users]);
    }

    /**
     * Login user and return Sanctum token.
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'user_id' => ['required', 'exists:users,id'],
            'password' => ['nullable', 'string'],
        ]);

        $user = User::findOrFail($request->user_id);

        // If user has a password, verify it
        if ($user->has_password) {
            if (! $request->password || ! Hash::check($request->password, $user->password)) {
                return response()->json([
                    'message' => 'პაროლი არასწორია',
                    'errors' => ['password' => ['პაროლი არასწორია']],
                ], 422);
            }
        }

        // Create Sanctum token
        $token = $user->createToken('mobile')->plainTextToken;

        // Also create a session for Inertia navigation in WebView
        Auth::login($user);

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'profile_image_url' => $user->profile_image_url,
                'has_password' => $user->has_password,
            ],
            'token' => $token,
        ]);
    }

    /**
     * Register new user and return Sanctum token.
     */
    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:users,name'],
            'password' => ['nullable', 'string', 'min:4'],
            'profile_image' => ['nullable', 'image', 'max:2048'],
            'profile_image_base64' => ['nullable', 'string'], // NativePHP base64 image
            'profile_image_path' => ['nullable', 'string'], // NativePHP camera path (legacy)
            'default_license_type_id' => ['nullable', 'exists:license_types,id'],
        ]);

        $profileImagePath = null;

        // Handle file upload (web)
        if ($request->hasFile('profile_image')) {
            $profileImagePath = $request->file('profile_image')->store('profile-images', 'public');
        }
        // Handle base64 image from NativePHP (mobile) - preferred method
        elseif ($request->filled('profile_image_base64')) {
            $base64Data = $request->input('profile_image_base64');

            // Parse data URL: data:image/jpeg;base64,/9j/4AAQ...
            if (preg_match('/^data:image\/(\w+);base64,(.+)$/', $base64Data, $matches)) {
                $extension = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
                $contents = base64_decode($matches[2]);

                if ($contents !== false) {
                    $filename = 'profile-images/'.uniqid().'.'.$extension;
                    Storage::disk('public')->put($filename, $contents);
                    $profileImagePath = $filename;
                }
            }
        }
        // Handle NativePHP camera path (mobile) - fallback for legacy
        elseif ($request->filled('profile_image_path')) {
            $nativePath = $request->input('profile_image_path');

            // Copy the native file to our storage
            if (file_exists($nativePath)) {
                $extension = pathinfo($nativePath, PATHINFO_EXTENSION) ?: 'jpg';
                $filename = 'profile-images/'.uniqid().'.'.$extension;
                $contents = file_get_contents($nativePath);

                if ($contents !== false) {
                    Storage::disk('public')->put($filename, $contents);
                    $profileImagePath = $filename;
                }
            }
        }

        $user = User::create([
            'name' => $request->name,
            'password' => $request->password ? Hash::make($request->password) : null,
            'has_password' => (bool) $request->password,
            'profile_image' => $profileImagePath,
            'default_license_type_id' => $request->default_license_type_id,
        ]);

        // Create Sanctum token
        $token = $user->createToken('mobile')->plainTextToken;

        // Also create a session for Inertia navigation in WebView
        Auth::login($user);

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'profile_image_url' => $user->profile_image_url,
                'has_password' => $user->has_password,
            ],
            'token' => $token,
        ]);
    }

    /**
     * Logout user and revoke current token.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        // Also log out from session for Inertia navigation (only if using web guard)
        if ($request->hasSession()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['message' => 'Logged out successfully']);
    }

    /**
     * Get current authenticated user.
     */
    public function user(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'profile_image_url' => $user->profile_image_url,
                'has_password' => $user->has_password,
            ],
        ]);
    }

    /**
     * Update user profile (for NativePHP mobile).
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'profile_image_base64' => ['nullable', 'string'],
            'default_license_type_id' => ['nullable', 'exists:license_types,id'],
        ]);

        $user = $request->user();

        // Handle base64 image from NativePHP (mobile)
        if ($request->filled('profile_image_base64')) {
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
                    $user->profile_image = $filename;
                }
            }
        }

        // Update name if provided
        if ($request->filled('name')) {
            $user->name = $request->input('name');
        }

        // Update default license type if provided
        if ($request->has('default_license_type_id')) {
            $user->default_license_type_id = $request->input('default_license_type_id');
        }

        $user->save();

        return response()->json([
            'success' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'profile_image_url' => $user->profile_image_url,
                'has_password' => $user->has_password,
                'default_license_type_id' => $user->default_license_type_id,
            ],
        ]);
    }
}
