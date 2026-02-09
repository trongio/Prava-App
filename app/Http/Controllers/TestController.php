<?php

namespace App\Http\Controllers;

use App\Models\LicenseType;
use App\Models\Question;
use App\Models\QuestionCategory;
use App\Models\TestResult;
use App\Models\TestTemplate;
use App\Models\UserQuestionProgress;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TestController extends Controller
{
    /**
     * Get user's active test (in_progress or paused).
     */
    private function getActiveTest(int $userId): ?TestResult
    {
        return TestResult::forUser($userId)
            ->active()
            ->with('licenseType.children')
            ->first();
    }

    /**
     * Abandon active test if requested and one exists.
     *
     * @return bool Whether we should proceed with creating a new test
     */
    private function handleActiveTestConflict(Request $request, int $userId): bool
    {
        $activeTest = $this->getActiveTest($userId);

        if (! $activeTest) {
            return true; // No conflict, proceed
        }

        if ($request->boolean('abandon_active')) {
            $activeTest->abandon();

            return true; // Abandoned, proceed
        }

        return false; // Conflict exists, don't proceed
    }

    /**
     * Display test creation screen with filters and templates.
     */
    public function create(Request $request): Response
    {
        $user = $request->user();

        // Get user's templates
        $templates = TestTemplate::forUser($user->id)
            ->with('licenseType')
            ->latest()
            ->get();

        // Get active test (only one allowed)
        $activeTest = $this->getActiveTest($user->id);

        // Get filter options
        $licenseTypes = LicenseType::parents()->with('children')->get();
        $categories = QuestionCategory::withCount(['questions' => function ($query) {
            $query->where('is_active', true);
        }])->orderBy('id')->get();

        // Get bookmarked questions count for the user
        $bookmarkedCount = UserQuestionProgress::where('user_id', $user->id)
            ->where('is_bookmarked', true)
            ->count();

        // Pre-fill from query params (coming from /questions FAB button)
        $prefilledLicenseType = $request->input('license_type', $user->default_license_type_id);
        $prefilledCategories = [];
        if ($request->has('categories')) {
            $rawCategories = $request->input('categories', '');
            if (is_string($rawCategories)) {
                $prefilledCategories = collect(explode(',', $rawCategories))
                    ->filter(fn ($id) => $id !== '')
                    ->map(fn ($id) => (int) $id)
                    ->filter(fn ($id) => $id > 0)
                    ->values()
                    ->toArray();
            }
        }

        return Inertia::render('test/index', [
            'templates' => $templates,
            'activeTest' => $activeTest ? [
                'id' => $activeTest->id,
                'test_type' => $activeTest->test_type,
                'status' => $activeTest->status,
                'total_questions' => $activeTest->total_questions,
                'correct_count' => $activeTest->correct_count,
                'wrong_count' => $activeTest->wrong_count,
                'answered_count' => $activeTest->getAnsweredCount(),
                'remaining_time_seconds' => $activeTest->remaining_time_seconds,
                'started_at' => $activeTest->started_at->toISOString(),
                'license_type' => $activeTest->licenseType ? [
                    'id' => $activeTest->licenseType->id,
                    'code' => $activeTest->licenseType->code,
                    'name' => $activeTest->licenseType->name,
                    'children' => $activeTest->licenseType->children->map(fn ($c) => [
                        'id' => $c->id,
                        'code' => $c->code,
                    ])->toArray(),
                ] : null,
            ] : null,
            'licenseTypes' => $licenseTypes,
            'categories' => $categories,
            'bookmarkedCount' => $bookmarkedCount,
            'userDefaults' => [
                'license_type_id' => $user->default_license_type_id,
                'auto_advance' => $user->test_auto_advance,
            ],
            'prefilled' => [
                'license_type' => $prefilledLicenseType,
                'categories' => $prefilledCategories,
                'sign_id' => $request->input('sign_id'),
                'from_questions' => $request->boolean('from_questions'),
            ],
        ]);
    }

    /**
     * Start a new test (create TestResult in progress).
     */
    public function store(Request $request): \Illuminate\Http\RedirectResponse|JsonResponse
    {
        $request->validate([
            'test_type' => 'required|in:thematic,bookmarked',
            'license_type_id' => 'nullable|exists:license_types,id',
            'question_count' => 'required|integer|min:5|max:1000',
            'time_per_question' => 'required|integer|min:30|max:180',
            'failure_threshold' => 'required|integer|min:1|max:50',
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'integer|exists:question_categories,id',
            'auto_advance' => 'boolean',
            'abandon_active' => 'boolean',
        ]);

        $user = $request->user();

        // Check for active test conflict
        if (! $this->handleActiveTestConflict($request, $user->id)) {
            $activeTest = $this->getActiveTest($user->id);

            if ($request->wantsJson()) {
                return response()->json([
                    'error' => 'active_test_exists',
                    'message' => 'You have an active test. Abandon it to start a new one.',
                    'active_test' => [
                        'id' => $activeTest->id,
                        'test_type' => $activeTest->test_type,
                        'answered_count' => $activeTest->getAnsweredCount(),
                        'total_questions' => $activeTest->total_questions,
                    ],
                ], 409);
            }

            return back()->withErrors(['active_test' => 'You have an active test. Please finish or abandon it first.']);
        }

        // Update user's auto-advance preference if changed
        if ($request->has('auto_advance')) {
            $user->update(['test_auto_advance' => $request->boolean('auto_advance')]);
        }

        // Build question query based on test type
        $query = Question::query()
            ->where('is_active', true)
            ->with(['answers' => fn ($q) => $q->orderBy('position'), 'signs', 'questionCategory']);

        if ($request->test_type === 'bookmarked') {
            // Bookmarked test: use only bookmarked questions
            $bookmarkedQuestionIds = UserQuestionProgress::where('user_id', $user->id)
                ->where('is_bookmarked', true)
                ->pluck('question_id');

            $query->whereIn('id', $bookmarkedQuestionIds);
        } else {
            // Thematic test: filter by license type and categories
            if ($request->license_type_id) {
                $licenseType = LicenseType::find($request->license_type_id);
                if ($licenseType) {
                    $licenseIds = collect([$licenseType->id]);
                    if ($licenseType->is_parent) {
                        $licenseIds = $licenseIds->merge($licenseType->children->pluck('id'));
                    }
                    $query->whereHas('licenseTypes', fn ($q) => $q->whereIn('license_types.id', $licenseIds));
                }
            }

            if (! empty($request->category_ids)) {
                $query->whereIn('question_category_id', $request->category_ids);
            }
        }

        // Get random questions up to the requested count
        $questions = $query->inRandomOrder()
            ->limit($request->question_count)
            ->get();

        if ($questions->isEmpty()) {
            return back()->withErrors(['questions' => 'No questions found matching your criteria.']);
        }

        // Build questions_with_answers array (ordered list with full question data)
        $questionsWithAnswers = $questions->map(fn ($q) => [
            'id' => $q->id,
            'question' => $q->question,
            'description' => $q->description,
            'full_description' => $q->full_description,
            'image' => $q->image,
            'image_custom' => $q->image_custom,
            'is_short_image' => $q->is_short_image,
            'question_category' => [
                'id' => $q->questionCategory->id,
                'name' => $q->questionCategory->name,
            ],
            'answers' => $q->answers->map(fn ($a) => [
                'id' => $a->id,
                'text' => $a->text,
                'is_correct' => $a->is_correct,
                'position' => $a->position,
            ])->values()->toArray(),
            'signs' => $q->signs->map(fn ($s) => [
                'id' => $s->id,
                'image' => $s->image,
                'title' => $s->title,
                'description' => $s->description,
            ])->values()->toArray(),
        ])->values()->toArray();

        // Calculate total time
        $totalTime = $request->question_count * $request->time_per_question;

        // Create test result
        $testResult = TestResult::create([
            'user_id' => $user->id,
            'test_type' => $request->test_type,
            'license_type_id' => $request->license_type_id,
            'configuration' => [
                'question_count' => count($questionsWithAnswers),
                'time_per_question' => $request->time_per_question,
                'failure_threshold' => $request->failure_threshold,
                'category_ids' => $request->category_ids ?? [],
                'auto_advance' => $request->has('auto_advance') ? $request->boolean('auto_advance') : ($user->test_auto_advance ?? true),
                'shuffle_seed' => mt_rand() / mt_getrandmax(),
            ],
            'questions_with_answers' => $questionsWithAnswers,
            'correct_count' => 0,
            'wrong_count' => 0,
            'total_questions' => count($questionsWithAnswers),
            'score_percentage' => 0,
            'status' => TestResult::STATUS_IN_PROGRESS,
            'started_at' => now(),
            'current_question_index' => 0,
            'answers_given' => [],
            'skipped_question_ids' => [],
            'remaining_time_seconds' => $totalTime,
        ]);

        return redirect()->route('test.show', $testResult);
    }

    /**
     * Display active test screen / resume paused test.
     */
    public function show(Request $request, TestResult $testResult): Response|\Illuminate\Http\RedirectResponse
    {
        $user = $request->user();

        // Verify ownership
        if ($testResult->user_id !== $user->id) {
            abort(403);
        }

        // If test is completed, redirect to results
        if ($testResult->isCompleted()) {
            return redirect()->route('test.results', $testResult);
        }

        // If resuming from paused state, update status
        if ($testResult->isPaused()) {
            $testResult->update([
                'status' => TestResult::STATUS_IN_PROGRESS,
                'paused_at' => null,
            ]);
        }

        return Inertia::render('test/active', [
            'testResult' => [
                'id' => $testResult->id,
                'test_type' => $testResult->test_type,
                'configuration' => $testResult->configuration,
                'questions' => $testResult->questions_with_answers,
                'current_question_index' => $testResult->current_question_index,
                'answers_given' => $testResult->answers_given ?? [],
                'skipped_question_ids' => $testResult->skipped_question_ids ?? [],
                'correct_count' => $testResult->correct_count,
                'wrong_count' => $testResult->wrong_count,
                'total_questions' => $testResult->total_questions,
                'remaining_time_seconds' => $testResult->remaining_time_seconds,
                'allowed_wrong' => $testResult->getAllowedWrong(),
                'started_at' => $testResult->started_at->toISOString(),
            ],
            'userSettings' => [
                'auto_advance' => $user->test_auto_advance,
            ],
        ]);
    }

    /**
     * Submit an answer for a question.
     */
    public function answer(Request $request, TestResult $testResult): JsonResponse
    {
        $request->validate([
            'question_id' => 'required|integer',
            'answer_id' => 'required|integer',
            'remaining_time' => 'required|integer',
        ]);

        $user = $request->user();

        // Verify ownership and status
        if ($testResult->user_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if ($testResult->isCompleted()) {
            return response()->json(['error' => 'Test already completed'], 400);
        }

        $questionId = $request->question_id;
        $answerId = $request->answer_id;

        // Check if question already answered
        $answersGiven = $testResult->answers_given ?? [];
        if (isset($answersGiven[$questionId])) {
            return response()->json(['error' => 'Question already answered'], 400);
        }

        // Find the question in the test
        $question = collect($testResult->questions_with_answers)->firstWhere('id', $questionId);
        if (! $question) {
            return response()->json(['error' => 'Question not found'], 404);
        }

        // Find the selected answer and check if correct
        $selectedAnswer = collect($question['answers'])->firstWhere('id', $answerId);
        if (! $selectedAnswer) {
            return response()->json(['error' => 'Answer not found'], 404);
        }

        $isCorrect = $selectedAnswer['is_correct'];

        // Record the answer
        $answersGiven[$questionId] = [
            'answer_id' => $answerId,
            'is_correct' => $isCorrect,
            'answered_at' => now()->toISOString(),
        ];

        // Remove from skipped if it was skipped
        $skippedIds = $testResult->skipped_question_ids ?? [];
        $skippedIds = array_values(array_filter($skippedIds, fn ($id) => $id !== $questionId));

        // Update counts
        $correctCount = $testResult->correct_count + ($isCorrect ? 1 : 0);
        $wrongCount = $testResult->wrong_count + ($isCorrect ? 0 : 1);

        // Update user's question progress
        $progress = UserQuestionProgress::firstOrCreate(
            ['user_id' => $user->id, 'question_id' => $questionId],
            ['first_answered_at' => now()]
        );

        if ($isCorrect) {
            $progress->increment('times_correct');
        } else {
            $progress->increment('times_wrong');
        }
        $progress->update(['last_answered_at' => now()]);

        // Check if test should be marked as failed
        $allowedWrong = $testResult->getAllowedWrong();
        $hasExceededMistakes = $wrongCount > $allowedWrong;

        $testResult->update([
            'answers_given' => $answersGiven,
            'skipped_question_ids' => $skippedIds,
            'correct_count' => $correctCount,
            'wrong_count' => $wrongCount,
            'remaining_time_seconds' => $request->remaining_time,
        ]);

        // Get correct answer for response
        $correctAnswer = collect($question['answers'])->firstWhere('is_correct', true);

        return response()->json([
            'is_correct' => $isCorrect,
            'correct_answer_id' => $correctAnswer['id'],
            'correct_count' => $correctCount,
            'wrong_count' => $wrongCount,
            'has_exceeded_mistakes' => $hasExceededMistakes,
            'allowed_wrong' => $allowedWrong,
        ]);
    }

    /**
     * Pause the test (save state for later resumption).
     */
    public function pause(Request $request, TestResult $testResult): JsonResponse
    {
        $request->validate([
            'current_question_index' => 'required|integer|min:0',
            'remaining_time' => 'required|integer',
        ]);

        $user = $request->user();

        // Verify ownership
        if ($testResult->user_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if ($testResult->isCompleted()) {
            return response()->json(['error' => 'Test already completed'], 400);
        }

        $testResult->update([
            'status' => TestResult::STATUS_PAUSED,
            'paused_at' => now(),
            'current_question_index' => $request->current_question_index,
            'remaining_time_seconds' => $request->remaining_time,
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * Skip a question.
     */
    public function skip(Request $request, TestResult $testResult): JsonResponse
    {
        $request->validate([
            'question_id' => 'required|integer',
        ]);

        $user = $request->user();

        if ($testResult->user_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if ($testResult->isCompleted()) {
            return response()->json(['error' => 'Test already completed'], 400);
        }

        $questionId = $request->question_id;
        $answersGiven = $testResult->answers_given ?? [];

        // Can't skip if already answered
        if (isset($answersGiven[$questionId])) {
            return response()->json(['error' => 'Question already answered'], 400);
        }

        // Add to skipped list if not already there
        $skippedIds = $testResult->skipped_question_ids ?? [];
        if (! in_array($questionId, $skippedIds)) {
            $skippedIds[] = $questionId;
            $testResult->update(['skipped_question_ids' => $skippedIds]);
        }

        return response()->json(['success' => true, 'skipped_ids' => $skippedIds]);
    }

    /**
     * Complete the test (finish and calculate results).
     */
    public function complete(Request $request, TestResult $testResult): JsonResponse|\Illuminate\Http\RedirectResponse
    {
        $request->validate([
            'remaining_time' => 'nullable|integer',
        ]);

        $user = $request->user();

        // Verify ownership
        if ($testResult->user_id !== $user->id) {
            if ($request->wantsJson()) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }
            abort(403);
        }

        if ($testResult->isCompleted()) {
            if ($request->wantsJson()) {
                return response()->json([
                    'success' => true,
                    'redirect_url' => route('test.results', $testResult),
                ]);
            }

            return redirect()->route('test.results', $testResult);
        }

        // Calculate final results
        $totalQuestions = $testResult->total_questions;
        $correctCount = $testResult->correct_count;
        $wrongCount = $testResult->wrong_count;
        $scorePercentage = $totalQuestions > 0 ? ($correctCount / $totalQuestions) * 100 : 0;

        // Determine pass/fail - unanswered questions count as wrong
        $answeredCount = $correctCount + $wrongCount;
        $unansweredCount = $totalQuestions - $answeredCount;
        $effectiveWrongCount = $wrongCount + $unansweredCount;
        $allowedWrong = $testResult->getAllowedWrong();
        $passed = $effectiveWrongCount <= $allowedWrong;

        // Calculate time taken
        $startedAt = $testResult->started_at;
        $remainingTime = $request->input('remaining_time', $testResult->remaining_time_seconds);
        $totalTime = ($testResult->configuration['question_count'] ?? 30) * ($testResult->configuration['time_per_question'] ?? 60);
        $timeTaken = $totalTime - $remainingTime;

        $testResult->update([
            'status' => $passed ? TestResult::STATUS_PASSED : TestResult::STATUS_FAILED,
            'finished_at' => now(),
            'score_percentage' => $scorePercentage,
            'time_taken_seconds' => $timeTaken,
            'remaining_time_seconds' => $remainingTime,
        ]);

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'passed' => $passed,
                'redirect_url' => route('test.results', $testResult),
            ]);
        }

        return redirect()->route('test.results', $testResult);
    }

    /**
     * Display test results page.
     */
    public function results(Request $request, TestResult $testResult): Response|\Illuminate\Http\RedirectResponse
    {
        $user = $request->user();

        // Verify ownership
        if ($testResult->user_id !== $user->id) {
            abort(403);
        }

        // If test is not completed, redirect to active test
        if (! $testResult->isCompleted()) {
            return redirect()->route('test.show', $testResult);
        }

        // Load license type relationship
        $testResult->load('licenseType');

        return Inertia::render('test/results', [
            'testResult' => [
                'id' => $testResult->id,
                'test_type' => $testResult->test_type,
                'status' => $testResult->status,
                'configuration' => $testResult->configuration,
                'questions' => $testResult->questions_with_answers,
                'answers_given' => $testResult->answers_given ?? [],
                'correct_count' => $testResult->correct_count,
                'wrong_count' => $testResult->wrong_count,
                'total_questions' => $testResult->total_questions,
                'score_percentage' => (float) $testResult->score_percentage,
                'time_taken_seconds' => $testResult->time_taken_seconds,
                'allowed_wrong' => $testResult->getAllowedWrong(),
                'started_at' => $testResult->started_at->toISOString(),
                'finished_at' => $testResult->finished_at?->toISOString(),
                'license_type_id' => $testResult->license_type_id,
                'license_type' => $testResult->licenseType?->only(['id', 'code', 'name']),
            ],
        ]);
    }

    /**
     * Quick test - start with default settings.
     */
    public function quickStart(Request $request): \Illuminate\Http\RedirectResponse|JsonResponse
    {
        $user = $request->user();

        // Default settings: 30 questions, 1 min per question, 10% failure threshold
        $fakeRequest = new Request([
            'test_type' => 'thematic',
            'license_type_id' => $user->default_license_type_id,
            'question_count' => 30,
            'time_per_question' => 60,
            'failure_threshold' => 10,
            'category_ids' => [],
            'auto_advance' => $user->test_auto_advance ?? true,
            'abandon_active' => $request->boolean('abandon_active'),
        ]);

        $fakeRequest->setUserResolver(fn () => $user);
        $fakeRequest->headers->set('Accept', $request->header('Accept'));

        return $this->store($fakeRequest);
    }

    /**
     * Redo the same test (exact same questions, same order).
     */
    public function redoSame(Request $request, TestResult $testResult): \Illuminate\Http\RedirectResponse|JsonResponse
    {
        $user = $request->user();

        if ($testResult->user_id !== $user->id) {
            abort(403);
        }

        // Check for active test conflict
        if (! $this->handleActiveTestConflict($request, $user->id)) {
            $activeTest = $this->getActiveTest($user->id);

            if ($request->wantsJson()) {
                return response()->json([
                    'error' => 'active_test_exists',
                    'message' => 'You have an active test. Abandon it to start a new one.',
                    'active_test' => [
                        'id' => $activeTest->id,
                        'test_type' => $activeTest->test_type,
                        'answered_count' => $activeTest->getAnsweredCount(),
                        'total_questions' => $activeTest->total_questions,
                    ],
                ], 409);
            }

            return back()->withErrors(['active_test' => 'You have an active test. Please finish or abandon it first.']);
        }

        // Create new test with exact same questions
        $config = $testResult->configuration;
        $totalTime = ($config['question_count'] ?? 30) * ($config['time_per_question'] ?? 60);

        $newTestResult = TestResult::create([
            'user_id' => $user->id,
            'test_type' => $testResult->test_type,
            'license_type_id' => $testResult->license_type_id,
            'configuration' => $config,
            'questions_with_answers' => $testResult->questions_with_answers,
            'correct_count' => 0,
            'wrong_count' => 0,
            'total_questions' => $testResult->total_questions,
            'score_percentage' => 0,
            'status' => TestResult::STATUS_IN_PROGRESS,
            'started_at' => now(),
            'current_question_index' => 0,
            'answers_given' => [],
            'skipped_question_ids' => [],
            'remaining_time_seconds' => $totalTime,
        ]);

        return redirect()->route('test.show', $newTestResult);
    }

    /**
     * Create a new similar test (same config, random questions).
     */
    public function newSimilar(Request $request, TestResult $testResult): \Illuminate\Http\RedirectResponse|JsonResponse
    {
        $user = $request->user();

        if ($testResult->user_id !== $user->id) {
            abort(403);
        }

        $config = $testResult->configuration;

        // Create a fake request with the same configuration
        $fakeRequest = new Request([
            'test_type' => $testResult->test_type,
            'license_type_id' => $testResult->license_type_id,
            'question_count' => $config['question_count'] ?? 30,
            'time_per_question' => $config['time_per_question'] ?? 60,
            'failure_threshold' => $config['failure_threshold'] ?? 10,
            'category_ids' => $config['category_ids'] ?? [],
            'auto_advance' => (bool) ($config['auto_advance'] ?? true),
            'abandon_active' => $request->boolean('abandon_active'),
        ]);

        $fakeRequest->setUserResolver(fn () => $user);
        $fakeRequest->headers->set('Accept', $request->header('Accept'));

        return $this->store($fakeRequest);
    }
}
