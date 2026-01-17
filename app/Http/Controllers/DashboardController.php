<?php

namespace App\Http\Controllers;

use App\Models\LicenseType;
use App\Models\Question;
use App\Models\TestResult;
use App\Models\UserQuestionProgress;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        // Get overall statistics
        $testStats = TestResult::forUser($user->id)
            ->whereIn('status', [TestResult::STATUS_PASSED, TestResult::STATUS_FAILED])
            ->selectRaw('
                COUNT(*) as total,
                SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as passed,
                SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as failed,
                SUM(correct_count) as total_correct,
                SUM(wrong_count) as total_wrong
            ', [TestResult::STATUS_PASSED, TestResult::STATUS_FAILED])
            ->first();

        // Get active test to continue
        $activeTest = TestResult::forUser($user->id)
            ->active()
            ->with('licenseType')
            ->first();

        // Get questions progress
        $totalQuestions = Question::where('is_active', true)->count();
        $studiedQuestions = UserQuestionProgress::where('user_id', $user->id)
            ->where(function ($q) {
                $q->where('times_correct', '>', 0)
                    ->orWhere('times_wrong', '>', 0);
            })
            ->count();

        // Get performance per license type with pass chance
        $licensePerformance = $this->calculateLicensePerformance($user->id);

        // Get recent test results for chart (last 10 tests)
        $recentTests = TestResult::forUser($user->id)
            ->whereIn('status', [TestResult::STATUS_PASSED, TestResult::STATUS_FAILED])
            ->orderBy('finished_at', 'desc')
            ->limit(10)
            ->get(['id', 'status', 'score_percentage', 'finished_at', 'license_type_id'])
            ->reverse()
            ->values();

        // Get weekly activity (tests per day for last 7 days)
        $weeklyActivity = TestResult::forUser($user->id)
            ->whereIn('status', [TestResult::STATUS_PASSED, TestResult::STATUS_FAILED])
            ->where('finished_at', '>=', now()->subDays(7))
            ->selectRaw('DATE(finished_at) as date, COUNT(*) as count, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as passed', [TestResult::STATUS_PASSED])
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // Get user's default license type
        $defaultLicenseType = $user->default_license_type_id
            ? LicenseType::with('children')->find($user->default_license_type_id)
            : null;

        // Calculate pass chance based on question mastery for default license type
        $passChance = $defaultLicenseType
            ? $this->calculateQuestionBasedPassChance($user->id, $defaultLicenseType)
            : null;

        // Get available license types for selection
        $licenseTypes = LicenseType::parents()->with('children')->get();

        return Inertia::render('dashboard', [
            'stats' => [
                'total_tests' => (int) ($testStats->total ?? 0),
                'passed' => (int) ($testStats->passed ?? 0),
                'failed' => (int) ($testStats->failed ?? 0),
                'pass_rate' => $testStats->total > 0
                    ? round(($testStats->passed / $testStats->total) * 100)
                    : 0,
                'total_correct' => (int) ($testStats->total_correct ?? 0),
                'total_wrong' => (int) ($testStats->total_wrong ?? 0),
            ],
            'progress' => [
                'studied' => $studiedQuestions,
                'total' => $totalQuestions,
                'percentage' => $totalQuestions > 0
                    ? round(($studiedQuestions / $totalQuestions) * 100)
                    : 0,
            ],
            'activeTest' => $activeTest ? [
                'id' => $activeTest->id,
                'test_type' => $activeTest->test_type,
                'status' => $activeTest->status,
                'total_questions' => $activeTest->total_questions,
                'answered_count' => $activeTest->getAnsweredCount(),
                'correct_count' => $activeTest->correct_count,
                'wrong_count' => $activeTest->wrong_count,
                'remaining_time_seconds' => $activeTest->remaining_time_seconds,
                'license_type' => $activeTest->licenseType?->only(['id', 'code', 'name']),
            ] : null,
            'licensePerformance' => $licensePerformance,
            'recentTests' => $recentTests,
            'weeklyActivity' => $weeklyActivity,
            'defaultLicenseType' => $defaultLicenseType?->only(['id', 'code', 'name']),
            'licenseTypes' => $licenseTypes,
            'passChance' => $passChance,
        ]);
    }

    /**
     * Calculate performance and pass chance per license type.
     */
    private function calculateLicensePerformance(int $userId): array
    {
        // Get test results grouped by license type
        $results = TestResult::forUser($userId)
            ->whereIn('status', [TestResult::STATUS_PASSED, TestResult::STATUS_FAILED])
            ->whereNotNull('license_type_id')
            ->with('licenseType')
            ->get()
            ->groupBy('license_type_id');

        $performance = [];

        foreach ($results as $licenseTypeId => $tests) {
            $licenseType = $tests->first()->licenseType;
            if (! $licenseType) {
                continue;
            }

            $total = $tests->count();
            $passed = $tests->where('status', TestResult::STATUS_PASSED)->count();
            $avgScore = $tests->avg('score_percentage');

            // Calculate pass chance based on:
            // - Recent performance (last 5 tests weight more)
            // - Overall pass rate
            // - Average score trend
            $recentTests = $tests->sortByDesc('finished_at')->take(5);
            $recentPassRate = $recentTests->count() > 0
                ? ($recentTests->where('status', TestResult::STATUS_PASSED)->count() / $recentTests->count()) * 100
                : 0;
            $recentAvgScore = $recentTests->avg('score_percentage') ?? 0;

            // Weighted pass chance calculation
            // 40% recent pass rate, 30% overall pass rate, 30% average score
            $overallPassRate = $total > 0 ? ($passed / $total) * 100 : 0;
            $passChance = round(
                ($recentPassRate * 0.4) +
                ($overallPassRate * 0.3) +
                ($recentAvgScore * 0.3)
            );

            // Clamp between 0-100
            $passChance = max(0, min(100, $passChance));

            $performance[] = [
                'license_type' => [
                    'id' => $licenseType->id,
                    'code' => $licenseType->code,
                    'name' => $licenseType->name,
                ],
                'total_tests' => $total,
                'passed' => $passed,
                'failed' => $total - $passed,
                'pass_rate' => round($overallPassRate),
                'avg_score' => round($avgScore),
                'pass_chance' => $passChance,
                'trend' => $this->calculateTrend($tests),
            ];
        }

        // Sort by total tests descending
        usort($performance, fn ($a, $b) => $b['total_tests'] <=> $a['total_tests']);

        return $performance;
    }

    /**
     * Calculate performance trend (improving, declining, stable).
     */
    private function calculateTrend($tests): string
    {
        if ($tests->count() < 3) {
            return 'stable';
        }

        $sorted = $tests->sortBy('finished_at')->values();
        $half = (int) floor($sorted->count() / 2);

        $firstHalfAvg = $sorted->take($half)->avg('score_percentage');
        $secondHalfAvg = $sorted->skip($half)->avg('score_percentage');

        $diff = $secondHalfAvg - $firstHalfAvg;

        if ($diff > 5) {
            return 'improving';
        }
        if ($diff < -5) {
            return 'declining';
        }

        return 'stable';
    }

    /**
     * Calculate pass chance based on per-question mastery.
     *
     * Variant B: Require 2+ correct for full mastery
     * - If wrong = 0 and correct >= 2: score = 1 (fully mastered)
     * - If wrong = 0 and correct = 1: score = 0.5 (partially proven)
     * - If correct = 0: score = 0 (unanswered or only wrongs)
     * - Otherwise: score = correct / (correct + wrong)
     *
     * Pass chance = average score across all questions × 100
     */
    private function calculateQuestionBasedPassChance(int $userId, LicenseType $licenseType): array
    {
        // Get all license type IDs (parent + children)
        $licenseTypeIds = collect([$licenseType->id]);
        if ($licenseType->children) {
            $licenseTypeIds = $licenseTypeIds->merge($licenseType->children->pluck('id'));
        }

        // Get all active questions for these license types
        $questions = Question::where('is_active', true)
            ->whereHas('licenseTypes', fn ($q) => $q->whereIn('license_types.id', $licenseTypeIds))
            ->pluck('id');

        $totalQuestions = $questions->count();

        if ($totalQuestions === 0) {
            return [
                'percentage' => 0,
                'total_questions' => 0,
                'studied_questions' => 0,
                'mastered_questions' => 0,
            ];
        }

        // Get user's progress for these questions
        $progress = UserQuestionProgress::where('user_id', $userId)
            ->whereIn('question_id', $questions)
            ->get()
            ->keyBy('question_id');

        $totalScore = 0;
        $studiedCount = 0;
        $masteredCount = 0; // Questions with 100% mastery

        foreach ($questions as $questionId) {
            $userProgress = $progress->get($questionId);

            $correct = $userProgress->times_correct ?? 0;
            $wrong = $userProgress->times_wrong ?? 0;

            if ($correct === 0) {
                // Never answered correctly (or only wrong answers)
                $score = 0;
            } elseif ($wrong === 0 && $correct >= 2) {
                // Fully mastered: 2+ correct, no wrongs
                $score = 1;
                $studiedCount++;
                $masteredCount++;
            } elseif ($wrong === 0 && $correct === 1) {
                // Partially proven: 1 correct, no wrongs
                $score = 0.5;
                $studiedCount++;
            } else {
                // Mixed: calculate ratio
                $score = $correct / ($correct + $wrong);
                $studiedCount++;
                if ($score >= 1) {
                    $masteredCount++;
                }
            }

            $totalScore += $score;
        }

        $passChance = $totalQuestions > 0 ? round(($totalScore / $totalQuestions) * 100) : 0;

        return [
            'percentage' => $passChance,
            'total_questions' => $totalQuestions,
            'studied_questions' => $studiedCount,
            'mastered_questions' => $masteredCount,
        ];
    }
}
