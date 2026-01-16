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
            'profile_image_path' => ['nullable', 'string'], // NativePHP camera path
        ]);

        $profileImagePath = null;

        // Handle file upload (web)
        if ($request->hasFile('profile_image')) {
            $profileImagePath = $request->file('profile_image')->store('profile-images', 'public');
        }
        // Handle NativePHP camera path (mobile)
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

        // Also log out from session for Inertia navigation
        Auth::logout();

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
}
