<?php

namespace App\Support;

use App\Models\LicenseType;

/**
 * Resolves the official theory exam specification for a licence category.
 *
 * The rules themselves live in config/exam_rules.php, which is the single
 * source of truth for this app. Nothing is stored on the `license_types`
 * table, so a rule change is a config change and never a migration.
 *
 * @phpstan-type ExamSpec array{
 *     code: string|null,
 *     question_count: int,
 *     allowed_wrong: int,
 *     correct_to_pass: int,
 *     time_per_question: int,
 *     total_time_seconds: int,
 *     failure_threshold: int,
 * }
 */
class ExamRules
{
    /**
     * Resolve the exam specification for a licence code.
     *
     * Matching is case-insensitive; unknown or missing codes fall back to the
     * configured `default` entry, whose `code` is null so callers can tell a
     * published category apart from the fallback.
     *
     * @return ExamSpec
     */
    public static function forCode(?string $code): array
    {
        if ($code !== null && $code !== '') {
            foreach (self::configuredCodes() as $configuredCode => $rules) {
                if (strcasecmp($configuredCode, $code) === 0) {
                    return self::buildSpec($configuredCode, $rules);
                }
            }
        }

        return self::buildSpec(null, config('exam_rules.default'));
    }

    /**
     * Resolve the exam specification for a licence type model.
     *
     * @return ExamSpec
     */
    public static function forLicenseType(?LicenseType $licenseType): array
    {
        return self::forCode($licenseType?->code);
    }

    /**
     * Resolve the exam specification for a licence type primary key.
     *
     * @return ExamSpec
     */
    public static function forLicenseTypeId(?int $licenseTypeId): array
    {
        if ($licenseTypeId === null) {
            return self::forCode(null);
        }

        $code = LicenseType::query()
            ->whereKey($licenseTypeId)
            ->value('code');

        return self::forCode(is_string($code) ? $code : null);
    }

    /**
     * The specification applied to categories with no published rules.
     *
     * @return ExamSpec
     */
    public static function default(): array
    {
        return self::forCode(null);
    }

    /**
     * Every configured specification, keyed by licence code.
     *
     * The `default` entry is included under the `default` key so clients can
     * render the same fallback the backend applies.
     *
     * @return array<string, ExamSpec>
     */
    public static function all(): array
    {
        $specs = ['default' => self::default()];

        foreach (self::configuredCodes() as $code => $rules) {
            $specs[$code] = self::buildSpec($code, $rules);
        }

        return $specs;
    }

    /**
     * @return array<string, array{question_count: int, allowed_wrong: int, time_per_question: int}>
     */
    private static function configuredCodes(): array
    {
        return config('exam_rules.codes', []);
    }

    /**
     * Expand raw config rules into the full specification callers consume.
     *
     * @param  array{question_count: int, allowed_wrong: int, time_per_question: int}  $rules
     * @return ExamSpec
     */
    private static function buildSpec(?string $code, array $rules): array
    {
        $questionCount = (int) $rules['question_count'];
        $allowedWrong = (int) $rules['allowed_wrong'];
        $timePerQuestion = (int) $rules['time_per_question'];

        return [
            'code' => $code,
            'question_count' => $questionCount,
            'allowed_wrong' => $allowedWrong,
            'correct_to_pass' => $questionCount - $allowedWrong,
            'time_per_question' => $timePerQuestion,
            'total_time_seconds' => $questionCount * $timePerQuestion,
            'failure_threshold' => self::failureThresholdPercent($questionCount, $allowedWrong),
        ];
    }

    /**
     * The percentage equivalent of an absolute mistake allowance.
     *
     * Kept only for backwards compatibility with the legacy percentage-based
     * `failure_threshold` stored on tests and templates: rounding up means
     * floor($questionCount * $percent / 100) reproduces $allowedWrong exactly
     * for every configured category. `allowed_wrong` remains authoritative.
     */
    private static function failureThresholdPercent(int $questionCount, int $allowedWrong): int
    {
        if ($questionCount <= 0) {
            return 1;
        }

        $percent = (int) ceil($allowedWrong / $questionCount * 100);

        return max(1, min(50, $percent));
    }
}
