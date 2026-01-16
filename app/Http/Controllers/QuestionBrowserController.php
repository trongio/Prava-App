<?php

namespace App\Http\Controllers;

use App\Models\LicenseType;
use App\Models\Question;
use App\Models\QuestionCategory;
use App\Models\UserQuestionProgress;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class QuestionBrowserController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        // Check if user has filter params in URL (not just page)
        $hasFilterParams = $request->hasAny(['license_type', 'categories', 'show_inactive', 'bookmarked', 'wrong_only', 'correct_only', 'unanswered', 'per_page']);

        // Load saved preferences if no filter params provided
        $savedPreferences = $user?->question_filter_preferences ?? [];

        // Get filter parameters (use saved if no URL params)
        $licenseTypeId = $hasFilterParams
            ? $request->input('license_type')
            : ($savedPreferences['license_type'] ?? null);
        $categoryIds = $hasFilterParams
            ? collect($request->input('categories', []))->map(fn ($id) => (int) $id)->toArray()
            : ($savedPreferences['categories'] ?? []);
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
        $perPage = $hasFilterParams
            ? $request->input('per_page', 20)
            : ($savedPreferences['per_page'] ?? 20);

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
            ],
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
            'answer_id' => 'required|exists:answers,id',
        ]);

        $user = $request->user();
        $answer = $question->answers()->find($request->answer_id);
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
