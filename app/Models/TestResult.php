<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TestResult extends Model
{
    // Status constants
    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_PAUSED = 'paused';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_PASSED = 'passed';

    public const STATUS_FAILED = 'failed';

    public const STATUS_ABANDONED = 'abandoned';

    protected $fillable = [
        'user_id',
        'test_template_id',
        'test_type',
        'license_type_id',
        'configuration',
        'questions_with_answers',
        'correct_count',
        'wrong_count',
        'total_questions',
        'score_percentage',
        'status',
        'started_at',
        'finished_at',
        'time_taken_seconds',
        'current_question_index',
        'answers_given',
        'skipped_question_ids',
        'paused_at',
        'remaining_time_seconds',
    ];

    protected function casts(): array
    {
        return [
            'configuration' => 'array',
            'questions_with_answers' => 'array',
            'answers_given' => 'array',
            'skipped_question_ids' => 'array',
            'score_percentage' => 'decimal:2',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'paused_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function testTemplate(): BelongsTo
    {
        return $this->belongsTo(TestTemplate::class);
    }

    public function licenseType(): BelongsTo
    {
        return $this->belongsTo(LicenseType::class);
    }

    // Status check methods
    public function isInProgress(): bool
    {
        return $this->status === self::STATUS_IN_PROGRESS;
    }

    public function isPaused(): bool
    {
        return $this->status === self::STATUS_PAUSED;
    }

    public function isCompleted(): bool
    {
        return in_array($this->status, [self::STATUS_COMPLETED, self::STATUS_PASSED, self::STATUS_FAILED, self::STATUS_ABANDONED]);
    }

    public function isAbandoned(): bool
    {
        return $this->status === self::STATUS_ABANDONED;
    }

    public function isActive(): bool
    {
        return in_array($this->status, [self::STATUS_IN_PROGRESS, self::STATUS_PAUSED]);
    }

    public function isPassed(): bool
    {
        return $this->status === self::STATUS_PASSED;
    }

    public function isFailed(): bool
    {
        return $this->status === self::STATUS_FAILED;
    }

    public function isOvertime(): bool
    {
        return $this->time_taken_seconds !== null && $this->time_taken_seconds < 0;
    }

    public function canBeResumed(): bool
    {
        return in_array($this->status, [self::STATUS_IN_PROGRESS, self::STATUS_PAUSED]);
    }

    // Scopes
    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    public function scopeInProgress(Builder $query): Builder
    {
        return $query->whereIn('status', [self::STATUS_IN_PROGRESS, self::STATUS_PAUSED]);
    }

    public function scopeCompleted(Builder $query): Builder
    {
        return $query->whereIn('status', [self::STATUS_COMPLETED, self::STATUS_PASSED, self::STATUS_FAILED]);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', [self::STATUS_IN_PROGRESS, self::STATUS_PAUSED]);
    }

    public function scopePassed(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PASSED);
    }

    public function scopeFailed(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_FAILED);
    }

    // Helper methods
    public function getTimeRemainingAttribute(): ?int
    {
        if ($this->remaining_time_seconds !== null) {
            return $this->remaining_time_seconds;
        }

        if ($this->started_at && $this->configuration) {
            $totalTime = ($this->configuration['question_count'] ?? 30) * ($this->configuration['time_per_question'] ?? 60);
            $elapsed = now()->diffInSeconds($this->started_at);

            return $totalTime - $elapsed;
        }

        return null;
    }

    /**
     * The number of mistakes allowed before this test is failed.
     *
     * An explicit `allowed_wrong` in the stored configuration wins: it carries
     * the legal mistake allowance of the licence category the test was started
     * for. Tests saved before that key existed only have the legacy percentage
     * `failure_threshold`, so those keep being scored with the old formula and
     * their historical results never shift.
     */
    public function getAllowedWrong(): int
    {
        $config = $this->configuration ?? [];

        if (isset($config['allowed_wrong']) && is_numeric($config['allowed_wrong'])) {
            return (int) $config['allowed_wrong'];
        }

        $questionCount = $config['question_count'] ?? $this->total_questions ?? 30;
        $threshold = $config['failure_threshold'] ?? 10;

        return (int) floor($questionCount * ($threshold / 100));
    }

    public function hasExceededMistakes(): bool
    {
        return $this->wrong_count > $this->getAllowedWrong();
    }

    public function getAnsweredCount(): int
    {
        return count($this->answers_given ?? []);
    }

    public function getSkippedCount(): int
    {
        return count($this->skipped_question_ids ?? []);
    }

    public function getProgressPercentage(): float
    {
        $total = $this->total_questions ?? 0;
        if ($total === 0) {
            return 0;
        }

        return ($this->getAnsweredCount() / $total) * 100;
    }

    /**
     * Abandon an active test.
     */
    public function abandon(): bool
    {
        if (! $this->isActive()) {
            return false;
        }

        // Calculate time taken so far
        $totalTime = ($this->configuration['question_count'] ?? 30) * ($this->configuration['time_per_question'] ?? 60);
        $timeTaken = $totalTime - ($this->remaining_time_seconds ?? 0);

        $this->update([
            'status' => self::STATUS_ABANDONED,
            'finished_at' => now(),
            'time_taken_seconds' => $timeTaken,
            'score_percentage' => $this->total_questions > 0
                ? ($this->correct_count / $this->total_questions) * 100
                : 0,
        ]);

        return true;
    }
}
