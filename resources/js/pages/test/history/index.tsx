import { Head, Link, router } from '@inertiajs/react';
import {
    Calendar,
    Check,
    ChevronRight,
    Clock,
    FileText,
    Filter,
    History,
    Trash2,
    Trophy,
    X,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import MobileLayout from '@/layouts/mobile-layout';
import {
    formatDateTime,
    formatTime,
    getTestTypeName,
} from '@/lib/test-utils';
import { cn } from '@/lib/utils';
import type { LicenseType, TestStatus, TestType } from '@/types/models';

interface TestResultItem {
    id: number;
    test_type: TestType;
    status: TestStatus;
    correct_count: number;
    wrong_count: number;
    total_questions: number;
    score_percentage: number;
    time_taken_seconds: number;
    started_at: string;
    finished_at: string | null;
    license_type: LicenseType | null;
}

interface PaginatedResults {
    data: TestResultItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    next_page_url: string | null;
    prev_page_url: string | null;
}

interface Stats {
    total: number;
    passed: number;
    failed: number;
}

interface Filters {
    status: string | null;
    test_type: string | null;
}

interface Props {
    testResults: PaginatedResults;
    stats: Stats;
    filters: Filters;
}

export default function HistoryIndex({ testResults, stats, filters }: Props) {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [testToDelete, setTestToDelete] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleFilterChange = (key: string, value: string | null) => {
        const newFilters: Record<string, string | null> = {
            status: filters.status,
            test_type: filters.test_type,
            [key]: value === 'all' ? null : value,
        };

        // Remove null values
        const queryParams: Record<string, string> = {};
        Object.entries(newFilters).forEach(([k, v]) => {
            if (v) queryParams[k] = v;
        });

        router.get('/test/history', queryParams, {
            preserveState: false,
            preserveScroll: true,
        });
    };

    const handleDelete = async () => {
        if (!testToDelete) return;

        setIsDeleting(true);
        try {
            await fetch(`/test/history/${testToDelete}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
            });
            router.reload();
        } catch {
            // Error handling
        } finally {
            setIsDeleting(false);
            setDeleteDialogOpen(false);
            setTestToDelete(null);
        }
    };

    const confirmDelete = (id: number) => {
        setTestToDelete(id);
        setDeleteDialogOpen(true);
    };

    const passRate =
        stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;

    return (
        <MobileLayout>
            <Head title="ისტორია" />

            <div className="flex flex-col gap-4 p-4">
                {/* Pass Rate - Hero Card */}
                <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                            {/* Circular Progress */}
                            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
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
                                        strokeDasharray={`${passRate * 2.64} 264`}
                                        className={cn(
                                            'transition-all duration-500',
                                            passRate >= 70
                                                ? 'text-green-500'
                                                : passRate >= 50
                                                  ? 'text-amber-500'
                                                  : 'text-red-500',
                                        )}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-xl font-bold">
                                        {passRate}%
                                    </span>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="flex-1 space-y-2">
                                <div className="text-sm font-medium text-muted-foreground">
                                    წარმატების მაჩვენებელი
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-lg font-bold">
                                                {stats.total}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">
                                            სულ
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <Trophy className="h-3.5 w-3.5 text-green-500" />
                                            <span className="text-lg font-bold text-green-600 dark:text-green-400">
                                                {stats.passed}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">
                                            ჩაბარებული
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                                            <span className="text-lg font-bold text-red-600 dark:text-red-400">
                                                {stats.failed}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">
                                            ჩავარდნილი
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Filters */}
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select
                        value={filters.status || 'all'}
                        onValueChange={(value) =>
                            handleFilterChange('status', value)
                        }
                    >
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="სტატუსი" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">ყველა</SelectItem>
                            <SelectItem value="passed">ჩაბარებული</SelectItem>
                            <SelectItem value="failed">ჩავარდნილი</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        value={filters.test_type || 'all'}
                        onValueChange={(value) =>
                            handleFilterChange('test_type', value)
                        }
                    >
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="ტიპი" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">ყველა</SelectItem>
                            <SelectItem value="thematic">თემატური</SelectItem>
                            <SelectItem value="bookmarked">შენახული</SelectItem>
                            <SelectItem value="quick">სწრაფი</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Test Results List */}
                {testResults.data.length > 0 ? (
                    <div className="space-y-2">
                        {testResults.data.map((test) => (
                            <Card
                                key={test.id}
                                className="overflow-hidden transition-shadow hover:shadow-md"
                            >
                                <div className="flex">
                                    {/* Status indicator */}
                                    <div
                                        className={cn(
                                            'w-1 shrink-0',
                                            test.status === 'passed'
                                                ? 'bg-green-500'
                                                : 'bg-red-500',
                                        )}
                                    />
                                    <div className="flex flex-1 items-center p-3">
                                        <Link
                                            href={`/test/history/${test.id}`}
                                            className="flex flex-1 items-center gap-3"
                                        >
                                            {/* Result icon */}
                                            <div
                                                className={cn(
                                                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                                                    test.status === 'passed'
                                                        ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
                                                )}
                                            >
                                                {test.status === 'passed' ? (
                                                    <Check className="h-5 w-5" />
                                                ) : (
                                                    <X className="h-5 w-5" />
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">
                                                        {test.correct_count}/
                                                        {test.total_questions}
                                                    </span>
                                                    <span className="text-sm text-muted-foreground">
                                                        (
                                                        {Math.round(
                                                            test.score_percentage,
                                                        )}
                                                        %)
                                                    </span>
                                                    <Badge
                                                        variant="outline"
                                                        className="ml-auto text-xs"
                                                    >
                                                        {getTestTypeName(
                                                            test.test_type,
                                                        )}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {formatDateTime(
                                                            test.finished_at ||
                                                                test.started_at,
                                                        )}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {formatTime(
                                                            test.time_taken_seconds,
                                                        )}
                                                    </span>
                                                    {test.license_type && (
                                                        <span>
                                                            {
                                                                test
                                                                    .license_type
                                                                    .code
                                                            }
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                                        </Link>

                                        {/* Delete button */}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="ml-2 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                confirmDelete(test.id);
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
                            <History className="h-16 w-16 text-muted-foreground" />
                            <div className="text-center">
                                <h2 className="text-lg font-semibold">
                                    ისტორია ცარიელია
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    {filters.status || filters.test_type
                                        ? 'არჩეული ფილტრებით ტესტები ვერ მოიძებნა'
                                        : 'თქვენ ჯერ არ გაგივლიათ ტესტი'}
                                </p>
                            </div>
                            {!filters.status && !filters.test_type && (
                                <Button asChild>
                                    <Link href="/test">ტესტის დაწყება</Link>
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Pagination */}
                {testResults.last_page > 1 && (
                    <div className="flex items-center justify-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!testResults.prev_page_url}
                            onClick={() =>
                                router.get(
                                    testResults.prev_page_url ||
                                        '/test/history',
                                    {},
                                    { preserveState: true },
                                )
                            }
                        >
                            წინა
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            {testResults.current_page} / {testResults.last_page}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!testResults.next_page_url}
                            onClick={() =>
                                router.get(
                                    testResults.next_page_url ||
                                        '/test/history',
                                    {},
                                    { preserveState: true },
                                )
                            }
                        >
                            შემდეგი
                        </Button>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>ტესტის წაშლა</DialogTitle>
                        <DialogDescription>
                            დარწმუნებული ხართ, რომ გსურთ ამ ტესტის წაშლა? ეს
                            მოქმედება შეუქცევადია.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteDialogOpen(false)}
                            disabled={isDeleting}
                        >
                            გაუქმება
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'იშლება...' : 'წაშლა'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </MobileLayout>
    );
}
