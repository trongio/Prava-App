import { Check, Clock, X } from 'lucide-react';

import { getLicenseTypeIcon } from '@/components/license-type-select';
import {
    formatTime,
    getTestTypeName,
    type LicenseType,
} from '@/lib/test-utils';
import { cn } from '@/lib/utils';

interface TestResultBannerProps {
    isPassed: boolean;
    correctCount: number;
    totalQuestions: number;
    answeredCount?: number;
    scorePercentage: number;
    timeTakenSeconds: number;
    testType?: string;
    licenseType?: LicenseType | null;
    withTopPadding?: boolean;
}

export function TestResultBanner({
    isPassed,
    correctCount,
    totalQuestions,
    answeredCount,
    scorePercentage,
    timeTakenSeconds,
    testType,
    licenseType,
    withTopPadding = false,
}: TestResultBannerProps) {
    const isOvertime = timeTakenSeconds < 0;
    const showAnsweredCount =
        answeredCount !== undefined && answeredCount < totalQuestions;

    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center gap-2 px-4 py-8',
                isPassed
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-red-100 dark:bg-red-900/30',
            )}
            style={
                withTopPadding
                    ? { paddingTop: 'calc(var(--inset-top) + 2rem)' }
                    : undefined
            }
        >
            <div
                className={cn(
                    'flex h-16 w-16 items-center justify-center rounded-full',
                    isPassed
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white',
                )}
            >
                {isPassed ? (
                    <Check className="h-8 w-8" />
                ) : (
                    <X className="h-8 w-8" />
                )}
            </div>

            <h1
                className={cn(
                    'text-2xl font-bold',
                    isPassed
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-red-700 dark:text-red-300',
                )}
            >
                {isPassed ? 'წარმატებით!' : 'ვერ ჩააბარეთ'}
            </h1>

            <p className="text-lg font-medium">
                {correctCount}/{totalQuestions} სწორი •{' '}
                {Math.round(scorePercentage)}%
                {showAnsweredCount && (
                    <span className="block text-sm opacity-70">
                        ({answeredCount} კითხვაზე პასუხი გაეცა)
                    </span>
                )}
            </p>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span
                    className={cn(
                        'flex items-center gap-1',
                        isOvertime && 'text-red-600 dark:text-red-400',
                    )}
                >
                    <Clock className="h-4 w-4" />
                    {formatTime(timeTakenSeconds)}
                </span>
                {testType && <span>{getTestTypeName(testType)}</span>}
                <span className="flex items-center gap-1">
                    {licenseType ? (
                        <>
                            {getLicenseTypeIcon(licenseType.code)}
                            {licenseType.code}
                        </>
                    ) : (
                        'ყველა'
                    )}
                </span>
            </div>
        </div>
    );
}
