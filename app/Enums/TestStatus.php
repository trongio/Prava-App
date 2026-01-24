<?php

namespace App\Enums;

enum TestStatus: string
{
    case InProgress = 'in_progress';
    case Paused = 'paused';
    case Completed = 'completed';
    case Passed = 'passed';
    case Failed = 'failed';
    case Abandoned = 'abandoned';

    /**
     * Check if this status represents a completed test.
     */
    public function isCompleted(): bool
    {
        return in_array($this, [self::Completed, self::Passed, self::Failed, self::Abandoned]);
    }

    /**
     * Check if this status represents an active test.
     */
    public function isActive(): bool
    {
        return in_array($this, [self::InProgress, self::Paused]);
    }

    /**
     * Check if this status represents a finished test with a result.
     */
    public function hasResult(): bool
    {
        return in_array($this, [self::Completed, self::Passed, self::Failed]);
    }

    /**
     * Get all active statuses.
     *
     * @return array<TestStatus>
     */
    public static function activeStatuses(): array
    {
        return [self::InProgress, self::Paused];
    }

    /**
     * Get all completed statuses.
     *
     * @return array<TestStatus>
     */
    public static function completedStatuses(): array
    {
        return [self::Completed, self::Passed, self::Failed];
    }

    /**
     * Get all finished statuses (including abandoned).
     *
     * @return array<TestStatus>
     */
    public static function finishedStatuses(): array
    {
        return [self::Completed, self::Passed, self::Failed, self::Abandoned];
    }
}
