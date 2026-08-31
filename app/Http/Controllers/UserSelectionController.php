<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\NativeMediaFile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class UserSelectionController extends Controller
{
    public function index(): Response|RedirectResponse
    {
        // If already logged in, go to dashboard
        if (Auth::check()) {
            return redirect()->route('dashboard');
        }

        $users = User::selectable()
            ->select(['id', 'name', 'profile_image', 'has_password'])
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'profile_image_url' => $user->profile_image_url,
                'has_password' => $user->has_password,
            ]);

        return Inertia::render('auth/user-selection', [
            'users' => $users,
        ]);
    }

    public function login(Request $request): JsonResponse|RedirectResponse
    {
        $request->validate([
            'user_id' => ['required', 'exists:users,id'],
            'password' => ['nullable', 'string'],
        ]);

        $user = User::selectable()->findOrFail($request->user_id);

        // If user has a password, verify it
        if ($user->has_password) {
            if (! $request->password || ! Hash::check($request->password, $user->password)) {
                return response()->json([
                    'error' => 'პაროლი არასწორია',
                ], 422);
            }
        }

        // Login and remember the user
        Auth::login($user, true);

        return redirect()->intended(route('dashboard'));
    }

    public function store(Request $request): JsonResponse|RedirectResponse
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:users,name'],
            'password' => ['nullable', 'string', 'min:4'],
            'profile_image' => ['nullable', 'image', 'max:2048'],
            'profile_image_path' => ['nullable', 'string'], // NativePHP camera path
            'default_license_type_id' => ['nullable', 'exists:license_types,id'],
        ]);

        $profileImagePath = null;

        // Handle file upload (web)
        if ($request->hasFile('profile_image')) {
            $profileImagePath = $request->file('profile_image')->store('profile-images', 'public');
        }
        // Handle NativePHP camera path (mobile)
        elseif ($request->filled('profile_image_path')) {
            $resolved = NativeMediaFile::resolveImage($request->input('profile_image_path'));

            if ($resolved !== null) {
                $contents = file_get_contents($resolved['path']);

                if ($contents !== false) {
                    $filename = 'profile-images/'.uniqid().'.'.$resolved['extension'];
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

        // Login and remember the new user
        Auth::login($user, true);

        return redirect()->route('dashboard');
    }

    public function updateImage(Request $request): JsonResponse
    {
        $request->validate([
            'profile_image' => ['required', 'image', 'max:2048'],
        ]);

        $user = Auth::user();

        // Delete old image if exists
        if ($user->profile_image) {
            Storage::disk('public')->delete($user->profile_image);
        }

        $profileImagePath = $request->file('profile_image')->store('profile-images', 'public');
        $user->update(['profile_image' => $profileImagePath]);

        return response()->json([
            'profile_image_url' => $user->profile_image_url,
        ]);
    }
}
