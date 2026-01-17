import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    BookOpen,
    CheckCircle2,
    ChevronRight,
    Clock,
    Gauge,
    Play,
    Target,
    TrendingDown,
    TrendingUp,
    Trophy,
    XCircle,
    Zap,
} from 'lucide-react';
import { useEffect } from 'react';

import {
    getLicenseTypeIcon,
    LicenseTypeSelect,
} from '@/components/license-type-select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MobileLayout from '@/layouts/mobile-layout';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';

interface LicenseType {
    id: number;
    code: string;
    name: string;
    children?: LicenseType[];
}

interface ActiveTest {
    id: number;
    test_type: string;
    status: string;
    total_questions: number;
    answered_count: number;
    correct_count: number;
    wrong_count: number;
    remaining_time_seconds: number;
    license_type: LicenseType | null;
}

interface LicensePerformance {
    license_type: LicenseType;
    total_tests: number;
    passed: number;
    failed: number;
    pass_rate: number;
    avg_score: number;
    pass_chance: number;
    trend: 'improving' | 'declining' | 'stable';
}

interface RecentTest {
    id: number;
    status: string;
    score_percentage: number;
    finished_at: string;
    license_type_id: number | null;
}

interface PassChance {
    percentage: number;
    total_questions: number;
    studied_questions: number;
    mastered_questions: number;
}

interface Props {
    stats: {
        total_tests: number;
        passed: number;
        failed: number;
        pass_rate: number;
        total_correct: number;
        total_wrong: number;
    };
    progress: {
        studied: number;
        total: number;
        percentage: number;
    };
    activeTest: ActiveTest | null;
    licensePerformance: LicensePerformance[];
    recentTests: RecentTest[];
    defaultLicenseType: LicenseType | null;
    licenseTypes: LicenseType[];
    passChance: PassChance | null;
}

const formatTime = (seconds: number) => {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.abs(seconds) % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getTestTypeName = (type: string) => {
    const types: Record<string, string> = {
        thematic: 'თემატური',
        bookmarked: 'შენახული',
        quick: 'სწრაფი',
    };
    return types[type] || type;
};

export default function Dashboard({
    stats,
    progress,
    activeTest,
    licensePerformance,
    recentTests,
    defaultLicenseType,
    licenseTypes,
    passChance,
}: Props) {
    const { auth } = usePage<SharedData>().props;
    const user = auth.user;

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const handleLicenseChange = (licenseId: string) => {
        router.post(
            '/onboarding/license',
            { license_type_id: licenseId === 'none' ? null : parseInt(licenseId) },
            { preserveScroll: true },
        );
    };

    // Reload pass chance and stats when page becomes visible (user returns to tab)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // Partial reload - only fetch updated data, preserve scroll
                router.reload({
                    only: ['passChance', 'stats', 'progress', 'activeTest'],
                    preserveScroll: true,
                });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // Calculate chart data
    const maxScore = Math.max(...recentTests.map((t) => t.score_percentage), 100);
    const chartHeight = 60;

    return (
        <MobileLayout>
            <Head title="მთავარი" />
            <div className="flex flex-col gap-4 p-4">
                {/* User Profile Card */}
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <Avatar className="h-14 w-14">
                            <AvatarImage
                                src={user.profile_image_url || undefined}
                                alt={user.name}
                            />
                            <AvatarFallback className="bg-primary text-lg text-primary-foreground">
                                {getInitials(user.name)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                            <h2 className="truncate text-lg font-semibold">
                                {user.name}
                            </h2>
                            <div className="flex items-center gap-2">
                                <LicenseTypeSelect
                                    value={defaultLicenseType?.id || null}
                                    onValueChange={(id) =>
                                        handleLicenseChange(id?.toString() || 'none')
                                    }
                                    licenseTypes={licenseTypes}
                                    placeholder="აირჩიე კატეგორია"
                                    emptyLabel="არ არის არჩეული"
                                    size="compact"
                                />
                            </div>
                        </div>

                        {/* Pass Chance Indicator */}
                        {passChance && defaultLicenseType && (
                            <div className="flex flex-col items-center">
                                <div className="relative flex h-14 w-14 items-center justify-center">
                                    <svg
                                        className="h-full w-full -rotate-90"
                                        viewBox="0 0 100 100"
                                    >
                                        <circle
                                            cx="50"
                                            cy="50"
                                            r="42"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="8"
                                            className="text-muted/30"
                                        />
                                        <circle
                                            cx="50"
                                            cy="50"
                                            r="42"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="8"
                                            strokeLinecap="round"
                                            strokeDasharray={`${passChance.percentage * 2.64} 264`}
                                            className={cn(
                                                'transition-all duration-500',
                                                passChance.percentage >= 70
                                                    ? 'text-green-500'
                                                    : passChance.percentage >= 50
                                                      ? 'text-amber-500'
                                                      : 'text-red-500',
                                            )}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span
                                            className={cn(
                                                'text-sm font-bold',
                                                passChance.percentage >= 70
                                                    ? 'text-green-500'
                                                    : passChance.percentage >= 50
                                                      ? 'text-amber-500'
                                                      : 'text-red-500',
                                            )}
                                        >
                                            {passChance.percentage}%
                                        </span>
                                    </div>
                                </div>
                                <span className="mt-0.5 text-[10px] text-muted-foreground">
                                    {passChance.studied_questions}/
                                    {passChance.total_questions}
                                </span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Continue Test Card */}
                {activeTest && (
                    <Card className="border-primary/50 bg-gradient-to-r from-primary/10 to-primary/5">
                        <CardContent className="p-4">
                            <Link
                                href={`/test/${activeTest.id}`}
                                className="flex items-center gap-3"
                            >
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/20">
                                    <Play className="h-6 w-6 text-primary" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium">
                                            გაგრძელება
                                        </span>
                                        <span className="rounded bg-primary/20 px-1.5 py-0.5 text-xs text-primary">
                                            {getTestTypeName(activeTest.test_type)}
                                        </span>
                                        <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                            {activeTest.license_type ? (
                                                <>
                                                    {getLicenseTypeIcon(
                                                        activeTest.license_type.code,
                                                    )}
                                                    {activeTest.license_type.code}
                                                </>
                                            ) : (
                                                'ყველა'
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                        <span>
                                            {activeTest.answered_count}/
                                            {activeTest.total_questions}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {formatTime(
                                                activeTest.remaining_time_seconds,
                                            )}
                                        </span>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </Link>
                        </CardContent>
                    </Card>
                )}

                {/* Quick Actions */}
                {!activeTest && (
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            asChild
                            className="h-auto flex-col gap-1 py-4"
                            variant="outline"
                        >
                            <Link href="/test">
                                <Zap className="h-5 w-5 text-amber-500" />
                                <span className="text-sm">სწრაფი ტესტი</span>
                            </Link>
                        </Button>
                        <Button
                            asChild
                            className="h-auto flex-col gap-1 py-4"
                            variant="outline"
                        >
                            <Link href="/questions">
                                <BookOpen className="h-5 w-5 text-blue-500" />
                                <span className="text-sm">კითხვები</span>
                            </Link>
                        </Button>
                    </div>
                )}

                {/* Statistics */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">სტატისტიკა</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-blue-500/10 p-3 text-center">
                            <div className="text-2xl font-bold text-blue-500">
                                {stats.total_tests}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                ტესტები
                            </div>
                        </div>
                        <div className="rounded-lg bg-green-500/10 p-3 text-center">
                            <div className="text-2xl font-bold text-green-500">
                                {stats.pass_rate}%
                            </div>
                            <div className="text-xs text-muted-foreground">
                                წარმატება
                            </div>
                        </div>
                        <div className="rounded-lg bg-purple-500/10 p-3 text-center">
                            <div className="text-2xl font-bold text-purple-500">
                                {stats.total_correct}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                სწორი პასუხი
                            </div>
                        </div>
                        <div className="rounded-lg bg-orange-500/10 p-3 text-center">
                            <div className="text-2xl font-bold text-orange-500">
                                {stats.total_wrong}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                არასწორი
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Tests Chart */}
                {recentTests.length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base">
                                    ბოლო ტესტები
                                </CardTitle>
                                <Link
                                    href="/test/history"
                                    className="text-xs text-primary"
                                >
                                    ყველა
                                </Link>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {/* Mini chart */}
                            <div className="flex items-end gap-1">
                                {recentTests.map((test) => (
                                    <div
                                        key={test.id}
                                        className="group relative flex-1"
                                    >
                                        <div
                                            className={cn(
                                                'w-full rounded-t transition-all',
                                                test.status === 'passed'
                                                    ? 'bg-green-500'
                                                    : 'bg-red-500',
                                            )}
                                            style={{
                                                height: `${(test.score_percentage / maxScore) * chartHeight}px`,
                                                minHeight: '4px',
                                            }}
                                        />
                                        {/* Tooltip */}
                                        <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-xs opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                                            {Math.round(test.score_percentage)}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                                <span>ძველი</span>
                                <span>ახალი</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Progress */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">პროგრესი</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-2 flex justify-between text-sm">
                            <span className="text-muted-foreground">
                                შესწავლილი კითხვები
                            </span>
                            <span className="font-medium">
                                {progress.studied} / {progress.total}
                            </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-secondary">
                            <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${progress.percentage}%` }}
                            />
                        </div>
                        <div className="mt-1 text-right text-xs text-muted-foreground">
                            {progress.percentage}%
                        </div>
                    </CardContent>
                </Card>

                {/* License Performance */}
                {licensePerformance.length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Target className="h-4 w-4" />
                                ჩაბარების შანსი
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {licensePerformance.map((perf) => (
                                <div
                                    key={perf.license_type.id}
                                    className="rounded-lg border p-3"
                                >
                                    <div className="mb-2 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">
                                                {perf.license_type.code}
                                            </span>
                                            {perf.trend === 'improving' && (
                                                <TrendingUp className="h-4 w-4 text-green-500" />
                                            )}
                                            {perf.trend === 'declining' && (
                                                <TrendingDown className="h-4 w-4 text-red-500" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Gauge className="h-4 w-4 text-muted-foreground" />
                                            <span
                                                className={cn(
                                                    'text-lg font-bold',
                                                    perf.pass_chance >= 70
                                                        ? 'text-green-500'
                                                        : perf.pass_chance >= 50
                                                          ? 'text-amber-500'
                                                          : 'text-red-500',
                                                )}
                                            >
                                                {perf.pass_chance}%
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Trophy className="h-3 w-3 text-green-500" />
                                            {perf.passed}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <XCircle className="h-3 w-3 text-red-500" />
                                            {perf.failed}
                                        </span>
                                        <span>საშ. {perf.avg_score}%</span>
                                    </div>
                                    {/* Pass chance bar */}
                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className={cn(
                                                'h-full rounded-full transition-all',
                                                perf.pass_chance >= 70
                                                    ? 'bg-green-500'
                                                    : perf.pass_chance >= 50
                                                      ? 'bg-amber-500'
                                                      : 'bg-red-500',
                                            )}
                                            style={{
                                                width: `${perf.pass_chance}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {/* Empty state for new users */}
                {stats.total_tests === 0 && (
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center gap-4 py-8 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                                <CheckCircle2 className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold">
                                    მზად ხარ დასაწყებად?
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    დაიწყე პირველი ტესტი და თვალი ადევნე შენს
                                    პროგრესს
                                </p>
                            </div>
                            <Button asChild>
                                <Link href="/test">
                                    <Zap className="mr-2 h-4 w-4" />
                                    ტესტის დაწყება
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </MobileLayout>
    );
}
