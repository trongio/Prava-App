<?php

namespace App\Http\Controllers;

use App\Models\LicenseType;
use App\Models\Question;
use App\Models\QuestionCategory;
use App\Models\Sign;
use App\Models\UserQuestionProgress;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class QuestionBrowserController extends Controller
{
    private const DEFAULT_PER_PAGE = 20;

    /**
     * Largest page the browser will serve. Matches the largest option the UI
     * offers (10, 20, 50, 100), so clamping cannot affect legitimate use.
     */
    private const MAX_PER_PAGE = 100;

    /**
     * Coerce a requested page size into a size this device can afford to render.
     *
     * Anything non-numeric falls back to the default rather than to zero, since
     * a zero page size makes the paginator return every row.
     */
    private static function clampPerPage(mixed $requested): int
    {
        if (! is_numeric($requested)) {
            return self::DEFAULT_PER_PAGE;
        }

        return max(1, min((int) $requested, self::MAX_PER_PAGE));
    }

    public function index(Request $request): Response
    {
        $user = $request->user();

        // Check if user has filter params in URL (not just page). sign_id is a
        // session-only filter (from the signs page) and must NOT count here, or
        // it would overwrite the user's saved filter preferences.
        $hasFilterParams = $request->hasAny(['license_type', 'categories', 'show_inactive', 'bookmarked', 'wrong_only', 'correct_only', 'unanswered', 'per_page']);

        // Sign filter (not saved to preferences, used when coming from signs page)
        $signId = $request->input('sign_id');
        $sign = $signId ? Sign::find($signId) : null;

        // Load saved preferences if no filter params provided
        $savedPreferences = $user?->question_filter_preferences ?? [];

        // Get filter parameters (use saved if no URL params, fallback to user's default)
        $licenseTypeId = $hasFilterParams
            ? $request->input('license_type')
            : ($savedPreferences['license_type'] ?? $user?->default_license_type_id);

        // Parse categories - support both comma-separated string (NativePHP) and array (web)
        $rawCategories = $request->input('categories', '');
        if ($hasFilterParams) {
            if (is_string($rawCategories)) {
                // Comma-separated string (NativePHP compatibility)
                $categoryIds = collect(explode(',', $rawCategories))
                    ->filter(fn ($id) => $id !== '' && $id !== null)
                    ->map(fn ($id) => (int) $id)
                    ->filter(fn ($id) => $id > 0)
                    ->values()
                    ->toArray();
            } else {
                // Array format (web browser)
                $categoryIds = collect($rawCategories)
                    ->filter(fn ($id) => $id !== '' && $id !== null && $id !== 0 && $id !== '0')
                    ->map(fn ($id) => (int) $id)
                    ->filter(fn ($id) => $id > 0)
                    ->values()
                    ->toArray();
            }
        } else {
            $categoryIds = collect($savedPreferences['categories'] ?? [])
                ->map(fn ($id) => (int) $id)
                ->filter(fn ($id) => $id > 0)
                ->values()
                ->toArray();
        }

        $showInactive = $hasFilterParams
            ? $request->boolean('show_inactive', false)
            : ($savedPreferences['show_inactive'] ?? false);
        $showBookmarked = $hasFilterParams
            ? $request->boolean('bookmarked', false)
            : ($savedPreferences['bookmarked'] ?? false);
        // correct_only and wrong_only are session-only filters (not saved to preferences)
        // These use session IDs passed from frontend as comma-separated strings (NativePHP compatibility)
        $showCorrect = $request->boolean('correct_only', false);
        $showWrong = $request->boolean('wrong_only', false);
        $sessionCorrectIds = collect(explode(',', $request->input('session_correct_ids', '')))
            ->filter(fn ($id) => $id !== '')
            ->map(fn ($id) => (int) $id)
            ->toArray();
        $sessionWrongIds = collect(explode(',', $request->input('session_wrong_ids', '')))
            ->filter(fn ($id) => $id !== '')
            ->map(fn ($id) => (int) $id)
            ->toArray();
        $showUnanswered = $hasFilterParams
            ? $request->boolean('unanswered', false)
            : ($savedPreferences['unanswered'] ?? false);
        // Clamped, not trusted. The page size reaches paginate() directly and is
        // persisted to the user's saved preferences, so an out-of-range value
        // would load the whole question bank into memory on every later visit.
        // The app runs its PHP runtime on the device, where memory is scarce and
        // exhausting it aborts the process rather than returning an error.
        $perPage = self::clampPerPage($hasFilterParams
            ? $request->input('per_page', self::DEFAULT_PER_PAGE)
            : ($savedPreferences['per_page'] ?? self::DEFAULT_PER_PAGE));

        // Save preferences when user applies filters (excluding session-only filters)
        if ($hasFilterParams && $user) {
            $user->update([
                'question_filter_preferences' => [
                    'license_type' => $licenseTypeId,
                    'categories' => $categoryIds,
                    'show_inactive' => $showInactive,
                    'bookmarked' => $showBookmarked,
                    'unanswered' => $showUnanswered,
                    'per_page' => (int) $perPage,
                ],
            ]);
        }

        // Build query
        $query = Question::query()
            ->with(['answers' => fn ($q) => $q->orderBy('position'), 'questionCategory', 'licenseTypes', 'signs']);

        // Filter by active status
        if (! $showInactive) {
            $query->where('is_active', true);
        }

        // Filter by license type
        if ($licenseTypeId) {
            $licenseType = LicenseType::find($licenseTypeId);
            if ($licenseType) {
                // Get all related license IDs (parent + children)
                $licenseIds = collect([$licenseType->id]);
                if ($licenseType->is_parent) {
                    $licenseIds = $licenseIds->merge($licenseType->children->pluck('id'));
                }
                $query->whereHas('licenseTypes', fn ($q) => $q->whereIn('license_types.id', $licenseIds));
            }
        }

        // Filter by categories
        if (! empty($categoryIds)) {
            $query->whereIn('question_category_id', $categoryIds);
        }

        // Filter by sign (questions related to a specific sign)
        if ($sign) {
            $query->whereHas('signs', fn ($q) => $q->where('signs.id', $sign->id));
        }

        // Filter by session-based correct/wrong IDs (passed from frontend)
        if ($showCorrect && ! empty($sessionCorrectIds)) {
            $query->whereIn('id', $sessionCorrectIds);
        } elseif ($showCorrect) {
            // No correct answers in session, return empty
            $query->whereRaw('1 = 0');
        }

        if ($showWrong && ! empty($sessionWrongIds)) {
            $query->whereIn('id', $sessionWrongIds);
        } elseif ($showWrong) {
            // No wrong answers in session, return empty
            $query->whereRaw('1 = 0');
        }

        // Filter by user progress (bookmarked, unanswered) - these still use database
        if ($user && ($showBookmarked || $showUnanswered)) {
            $query->where(function ($q) use ($user, $showBookmarked, $showUnanswered) {
                if ($showBookmarked) {
                    $q->orWhereHas('userProgress', fn ($uq) => $uq->where('user_id', $user->id)->where('is_bookmarked', true));
                }
                if ($showUnanswered) {
                    $q->orWhereDoesntHave('userProgress', fn ($uq) => $uq->where('user_id', $user->id));
                }
            });
        }

        // Get paginated results
        $questions = $query->paginate($perPage)->withQueryString();

        // Load user progress for questions on current page
        $userProgress = [];
        if ($user) {
            $questionIds = $questions->pluck('id');
            $userProgress = UserQuestionProgress::where('user_id', $user->id)
                ->whereIn('question_id', $questionIds)
                ->get()
                ->keyBy('question_id');
        }

        // Get filter options
        $licenseTypes = LicenseType::parents()->with('children')->get();
        $categories = QuestionCategory::orderBy('id')->get();

        // Get category counts based on license type filter
        $categoryCountsQuery = Question::query();
        if (! $showInactive) {
            $categoryCountsQuery->where('is_active', true);
        }
        if ($licenseTypeId) {
            $licenseType = LicenseType::find($licenseTypeId);
            if ($licenseType) {
                $licenseIds = collect([$licenseType->id]);
                if ($licenseType->is_parent) {
                    $licenseIds = $licenseIds->merge($licenseType->children->pluck('id'));
                }
                $categoryCountsQuery->whereHas('licenseTypes', fn ($q) => $q->whereIn('license_types.id', $licenseIds));
            }
        }
        $categoryCounts = $categoryCountsQuery
            ->selectRaw('question_category_id, count(*) as count')
            ->groupBy('question_category_id')
            ->pluck('count', 'question_category_id')
            ->toArray();

        // Get total counts for stats
        $totalQuestions = Question::where('is_active', true)->count();
        $answeredCount = $user ? UserQuestionProgress::where('user_id', $user->id)->count() : 0;

        return Inertia::render('questions/index', [
            'questions' => $questions,
            'userProgress' => $userProgress,
            'licenseTypes' => $licenseTypes,
            'categories' => $categories,
            'categoryCounts' => $categoryCounts,
            'filters' => [
                'license_type' => $licenseTypeId,
                'categories' => $categoryIds,
                'show_inactive' => $showInactive,
                'bookmarked' => $showBookmarked,
                'correct_only' => $showCorrect,
                'wrong_only' => $showWrong,
                'unanswered' => $showUnanswered,
                'per_page' => (int) $perPage,
                'sign_id' => $sign?->id,
            ],
            'filterSign' => $sign ? [
                'id' => $sign->id,
                'title' => $sign->title,
                'image' => $sign->image,
            ] : null,
            'stats' => [
                'total' => $totalQuestions,
                'answered' => $answeredCount,
                'filtered' => $questions->total(),
            ],
        ]);
    }

    public function answer(Request $request, Question $question): JsonResponse
    {
        $request->validate([
            'answer_id' => [
                'required',
                Rule::exists('answers', 'id')->where('question_id', $question->id),
            ],
        ]);

        $user = $request->user();
        $answer = $question->answers()->findOrFail($request->answer_id);
        $isCorrect = $answer->is_correct;

        // Update or create user progress
        $progress = UserQuestionProgress::firstOrCreate(
            ['user_id' => $user->id, 'question_id' => $question->id],
            ['first_answered_at' => now()]
        );

        if ($isCorrect) {
            $progress->increment('times_correct');
        } else {
            $progress->increment('times_wrong');
        }

        $progress->update(['last_answered_at' => now()]);

        // Get correct answer for response
        $correctAnswer = $question->answers()->where('is_correct', true)->first();

        return response()->json([
            'is_correct' => $isCorrect,
            'correct_answer_id' => $correctAnswer->id,
            'explanation' => $question->full_description,
            'progress' => [
                'times_correct' => $progress->times_correct,
                'times_wrong' => $progress->times_wrong,
                'is_bookmarked' => $progress->is_bookmarked,
            ],
        ]);
    }

    public function bookmark(Request $request, Question $question): JsonResponse
    {
        $user = $request->user();

        $progress = UserQuestionProgress::firstOrCreate(
            ['user_id' => $user->id, 'question_id' => $question->id]
        );

        $progress->update(['is_bookmarked' => ! $progress->is_bookmarked]);

        return response()->json([
            'is_bookmarked' => $progress->is_bookmarked,
        ]);
    }
}
