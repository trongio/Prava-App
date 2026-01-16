import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import {
    Bookmark,
    Bus,
    Car,
    Check,
    ChevronLeft,
    ChevronRight,
    Filter,
    Motorbike,
    Scooter,
    Search,
    Shield,
    Tractor,
    TramFront,
    TriangleAlert,
    Truck,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { QuestionCard } from '@/components/question-card';
import { SignsInfoDialog } from '@/components/signs-info-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import MobileLayout from '@/layouts/mobile-layout';

interface Answer {
    id: number;
    text: string;
    is_correct: boolean;
    position: number;
}

interface QuestionCategory {
    id: number;
    name: string;
}

interface LicenseType {
    id: number;
    code: string;
    name: string;
    is_parent: boolean;
    children: LicenseType[];
}

interface Sign {
    id: number;
    image: string;
    title: string;
    description: string | null;
}

interface Question {
    id: number;
    question: string;
    description: string | null;
    full_description: string | null;
    image: string | null;
    image_custom: string | null;
    is_short_image: boolean;
    is_active: boolean;
    answers: Answer[];
    question_category: QuestionCategory;
    signs: Sign[];
}

interface UserProgress {
    question_id: number;
    times_correct: number;
    times_wrong: number;
    is_bookmarked: boolean;
}

interface PaginatedQuestions {
    data: Question[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: { url: string | null; label: string; active: boolean }[];
}

interface Filters {
    license_type: number | null;
    categories: number[];
    show_inactive: boolean;
    bookmarked: boolean;
    wrong_only: boolean;
    correct_only: boolean;
    unanswered: boolean;
    per_page: number;
    sign_id: number | null;
}

interface FilterSign {
    id: number;
    title: string;
    image: string;
}

interface Stats {
    total: number;
    answered: number;
    filtered: number;
}

interface Props {
    questions: PaginatedQuestions;
    userProgress: Record<number, UserProgress>;
    licenseTypes: LicenseType[];
    categories: QuestionCategory[];
    categoryCounts: Record<number, number>;
    filters: Filters;
    filterSign: FilterSign | null;
    stats: Stats;
}

interface AnswerState {
    questionId: number;
    selectedAnswerId: number | null;
    correctAnswerId: number | null;
    isCorrect: boolean | null;
    explanation: string | null;
}

const getLicenseTypeIcon = (code: string) => {
    const iconClass = 'h-4 w-4 shrink-0';
    const upperCode = code.toUpperCase().replace(/\s/g, '');

    // AM - Moped (before A check since AM starts with A)
    if (upperCode === 'AM') {
        return <Scooter className={iconClass} />;
    }
    // A, A1 - Motorcycle
    if (upperCode.startsWith('A')) {
        return <Motorbike className={iconClass} />;
    }
    // B, B1 - Car
    if (upperCode.startsWith('B')) {
        return <Car className={iconClass} />;
    }
    // C, C1 - Truck
    if (upperCode.startsWith('C')) {
        return <Truck className={iconClass} />;
    }
    // D, D1 - Bus
    if (upperCode.startsWith('D')) {
        return <Bus className={iconClass} />;
    }
    // T, T,S - Tractor
    if (upperCode === 'T' || upperCode === 'T,S' || upperCode === 'TS') {
        return <Tractor className={iconClass} />;
    }
    // Tram
    if (upperCode === 'TRAM') {
        return <TramFront className={iconClass} />;
    }
    // Mil - Military
    if (upperCode === 'MIL') {
        return <Shield className={iconClass} />;
    }
    return <Car className={iconClass} />;
};

// Generate page numbers to display
function getPageNumbers(
    currentPage: number,
    lastPage: number,
): (number | 'ellipsis')[] {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5; // Max page buttons to show (excluding ellipsis)

    if (lastPage <= maxVisible + 2) {
        // Show all pages if total is small
        for (let i = 1; i <= lastPage; i++) {
            pages.push(i);
        }
    } else {
        // Always show first page
        pages.push(1);

        if (currentPage <= 3) {
            // Near start: 1 2 3 4 ... last
            for (let i = 2; i <= 4; i++) {
                pages.push(i);
            }
            pages.push('ellipsis');
        } else if (currentPage >= lastPage - 2) {
            // Near end: 1 ... n-3 n-2 n-1 last
            pages.push('ellipsis');
            for (let i = lastPage - 3; i < lastPage; i++) {
                pages.push(i);
            }
        } else {
            // Middle: 1 ... current-1 current current+1 ... last
            pages.push('ellipsis');
            for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                pages.push(i);
            }
            pages.push('ellipsis');
        }

        // Always show last page
        pages.push(lastPage);
    }

    return pages;
}

// Pagination component
function Pagination({
    currentPage,
    lastPage,
    perPage,
    onPageChange,
    onPerPageChange,
}: {
    currentPage: number;
    lastPage: number;
    perPage: number;
    onPageChange: (page: number) => void;
    onPerPageChange: (perPage: number) => void;
}) {
    if (lastPage <= 1) return null;

    const pageNumbers = getPageNumbers(currentPage, lastPage);

    return (
        <div className="flex items-center justify-between gap-2 border-b bg-background px-4 py-2">
            <div className="flex items-center gap-1">
                <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={currentPage === 1}
                    onClick={() => onPageChange(currentPage - 1)}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                {pageNumbers.map((page, index) =>
                    page === 'ellipsis' ? (
                        <span
                            key={`ellipsis-${index}`}
                            className="px-1 text-muted-foreground"
                        >
                            ...
                        </span>
                    ) : (
                        <Button
                            key={page}
                            variant={
                                page === currentPage ? 'default' : 'outline'
                            }
                            size="icon"
                            className="h-8 w-8 text-sm"
                            onClick={() => onPageChange(page)}
                        >
                            {page}
                        </Button>
                    ),
                )}

                <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={currentPage === lastPage}
                    onClick={() => onPageChange(currentPage + 1)}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            <Select
                value={perPage.toString()}
                onValueChange={(v) => onPerPageChange(parseInt(v))}
            >
                <SelectTrigger className="h-8 w-16 text-sm">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {[10, 20, 50, 100].map((n) => (
                        <SelectItem key={n} value={n.toString()}>
                            {n}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

export default function QuestionsIndex({
    questions,
    userProgress,
    licenseTypes,
    categories,
    categoryCounts,
    filters,
    filterSign,
}: Props) {
    const [answerStates, setAnswerStates] = useState<
        Record<number, AnswerState>
    >({});
    const [bookmarkedQuestions, setBookmarkedQuestions] = useState<
        Record<number, boolean>
    >(
        Object.fromEntries(
            Object.entries(userProgress).map(([qId, p]) => [
                qId,
                p.is_bookmarked,
            ]),
        ),
    );
    const [sessionScore, setSessionScore] = useState({ correct: 0, wrong: 0 });
    const [sessionCorrectIds, setSessionCorrectIds] = useState<number[]>([]);
    const [sessionWrongIds, setSessionWrongIds] = useState<number[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [categorySearch, setCategorySearch] = useState('');
    const [localFilters, setLocalFilters] = useState<Filters>(filters);
    const [signsModalQuestion, setSignsModalQuestion] =
        useState<Question | null>(null);
    const [submittingQuestions, setSubmittingQuestions] = useState<Set<number>>(
        new Set(),
    );

    // Ref to track pending answer submissions to prevent race conditions
    const pendingAnswersRef = useRef<Set<number>>(new Set());

    // Sync localFilters with server filters when they change
    useEffect(() => {
        setLocalFilters(filters);
    }, [filters]);

    // Sync bookmarkedQuestions with userProgress when page data changes
    useEffect(() => {
        setBookmarkedQuestions(
            Object.fromEntries(
                Object.entries(userProgress).map(([qId, p]) => [
                    qId,
                    p.is_bookmarked,
                ]),
            ),
        );
    }, [userProgress]);

    // Handle Android back button to close filter sheet instead of navigating
    useEffect(() => {
        const handlePopState = (e: PopStateEvent) => {
            if (isFilterOpen) {
                e.preventDefault();
                setIsFilterOpen(false);
                // Re-push state to prevent actual navigation
                window.history.pushState(null, '', window.location.href);
            }
        };

        // Push initial state when filter opens
        if (isFilterOpen) {
            window.history.pushState(null, '', window.location.href);
        }

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isFilterOpen]);

    // Seed for deterministic answer shuffling (generated once per page load)
    const [shuffleSeed] = useState(() => Math.random());

    const handleAnswer = useCallback(
        async (question: Question, answerId: number) => {
            // Check if already answered
            if (answerStates[question.id]?.selectedAnswerId) return;

            // Prevent duplicate submissions using ref (handles rapid clicks)
            if (pendingAnswersRef.current.has(question.id)) return;
            pendingAnswersRef.current.add(question.id);

            // Update UI to show loading state
            setSubmittingQuestions((prev) => new Set(prev).add(question.id));

            try {
                const { data } = await axios.post(
                    `/questions/${question.id}/answer`,
                    { answer_id: answerId },
                );

                setAnswerStates((prev) => ({
                    ...prev,
                    [question.id]: {
                        questionId: question.id,
                        selectedAnswerId: answerId,
                        correctAnswerId: data.correct_answer_id,
                        isCorrect: data.is_correct,
                        explanation: data.explanation,
                    },
                }));

                setSessionScore((prev) => ({
                    correct: prev.correct + (data.is_correct ? 1 : 0),
                    wrong: prev.wrong + (data.is_correct ? 0 : 1),
                }));

                // Track question IDs for session-based filtering
                if (data.is_correct) {
                    setSessionCorrectIds((prev) => [...prev, question.id]);
                } else {
                    setSessionWrongIds((prev) => [...prev, question.id]);
                }
            } catch (error) {
                console.error('Failed to submit answer:', error);
            } finally {
                pendingAnswersRef.current.delete(question.id);
                setSubmittingQuestions((prev) => {
                    const next = new Set(prev);
                    next.delete(question.id);
                    return next;
                });
            }
        },
        [answerStates],
    );

    const handleBookmark = useCallback(async (questionId: number) => {
        try {
            const { data } = await axios.post(
                `/questions/${questionId}/bookmark`,
            );
            setBookmarkedQuestions((prev) => ({
                ...prev,
                [questionId]: data.is_bookmarked,
            }));
        } catch (error) {
            console.error('Failed to toggle bookmark:', error);
        }
    }, []);

    // Toggle inactive questions filter
    const toggleInactiveFilter = useCallback(() => {
        const newShowInactive = !localFilters.show_inactive;
        setLocalFilters((f) => ({ ...f, show_inactive: newShowInactive }));
        router.get(
            '/questions',
            { ...localFilters, show_inactive: newShowInactive },
            { preserveState: true, preserveScroll: true },
        );
    }, [localFilters]);

    // Toggle bookmarked questions filter
    const toggleBookmarkFilter = useCallback(() => {
        const newBookmarked = !localFilters.bookmarked;
        setLocalFilters((f) => ({ ...f, bookmarked: newBookmarked }));

        // Build request params, excluding bookmarked when false to avoid filtering issues
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { bookmarked: _bookmarked, ...restFilters } = localFilters;
        const requestParams = newBookmarked
            ? { ...restFilters, bookmarked: true }
            : restFilters;

        // Preserve session IDs for correct/wrong filters (comma-separated for NativePHP)
        if (localFilters.correct_only && sessionCorrectIds.length > 0) {
            Object.assign(requestParams, {
                session_correct_ids: sessionCorrectIds.join(','),
            });
        }
        if (localFilters.wrong_only && sessionWrongIds.length > 0) {
            Object.assign(requestParams, {
                session_wrong_ids: sessionWrongIds.join(','),
            });
        }

        router.get('/questions', requestParams, {
            preserveState: true,
            preserveScroll: true,
        });
    }, [localFilters, sessionCorrectIds, sessionWrongIds]);

    // Toggle answer status filter (correct/wrong) - only one can be active
    // Uses session-based IDs for filtering (comma-separated for NativePHP compatibility)
    const toggleAnswerFilter = useCallback(
        (type: 'correct' | 'wrong') => {
            const isCurrentlyActive =
                type === 'correct'
                    ? localFilters.correct_only
                    : localFilters.wrong_only;
            const newFilters = {
                ...localFilters,
                correct_only: type === 'correct' ? !isCurrentlyActive : false,
                wrong_only: type === 'wrong' ? !isCurrentlyActive : false,
            };
            setLocalFilters(newFilters);

            // Pass session IDs as comma-separated strings for NativePHP compatibility
            const requestParams = {
                ...newFilters,
                session_correct_ids:
                    type === 'correct' && !isCurrentlyActive
                        ? sessionCorrectIds.join(',')
                        : '',
                session_wrong_ids:
                    type === 'wrong' && !isCurrentlyActive
                        ? sessionWrongIds.join(',')
                        : '',
            };

            router.get('/questions', requestParams, {
                preserveState: true,
                preserveScroll: true,
            });
        },
        [localFilters, sessionCorrectIds, sessionWrongIds],
    );

    const goToPage = useCallback(
        (page: number) => {
            router.get(
                '/questions',
                { ...localFilters, page },
                {
                    preserveState: true,
                    preserveScroll: true,
                },
            );
        },
        [localFilters],
    );

    const handlePerPageChange = useCallback(
        (perPage: number) => {
            const newFilters = { ...localFilters, per_page: perPage };
            setLocalFilters(newFilters);
            router.get(
                '/questions',
                { ...newFilters, page: 1 },
                {
                    preserveState: true,
                    preserveScroll: true,
                },
            );
        },
        [localFilters],
    );

    // Calculate total count for all categories
    const totalCategoryCount = useMemo(() => {
        return Object.values(categoryCounts).reduce(
            (sum, count) => sum + count,
            0,
        );
    }, [categoryCounts]);

    // Filter categories by search term
    const filteredCategories = useMemo(() => {
        if (!categorySearch.trim()) return categories;
        const searchLower = categorySearch.toLowerCase();
        return categories.filter((cat) =>
            cat.name.toLowerCase().includes(searchLower),
        );
    }, [categories, categorySearch]);

    return (
        <MobileLayout>
            <Head title="ბილეთები" />

            {/* Score Bar */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background px-4 py-2">
                <div className="flex items-center gap-2 text-sm">
                    <button
                        onClick={() => toggleAnswerFilter('correct')}
                        className={`flex items-center gap-1 rounded-md px-2 py-1 transition-colors ${
                            localFilters.correct_only
                                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-950'
                        }`}
                    >
                        <Check className="h-4 w-4" />
                        {sessionScore.correct}
                    </button>
                    <button
                        onClick={() => toggleAnswerFilter('wrong')}
                        className={`flex items-center gap-1 rounded-md px-2 py-1 transition-colors ${
                            localFilters.wrong_only
                                ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950'
                        }`}
                    >
                        <X className="h-4 w-4" />
                        {sessionScore.wrong}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {/* Bookmarked Questions Toggle */}
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={toggleBookmarkFilter}
                    >
                        <Bookmark
                            className={`h-4 w-4 ${
                                localFilters.bookmarked
                                    ? 'fill-yellow-500 text-yellow-500'
                                    : 'text-muted-foreground'
                            }`}
                        />
                    </Button>

                    {/* Inactive Questions Toggle */}
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={toggleInactiveFilter}
                    >
                        <TriangleAlert
                            className={`h-4 w-4 ${
                                localFilters.show_inactive
                                    ? 'text-red-500'
                                    : 'text-muted-foreground'
                            }`}
                        />
                    </Button>

                    {/* License Type Selector */}
                    <Select
                        value={localFilters.license_type?.toString() || 'all'}
                        onValueChange={(v) => {
                            const newLicenseType =
                                v === 'all' ? null : parseInt(v);
                            setLocalFilters((f) => ({
                                ...f,
                                license_type: newLicenseType,
                            }));
                            // Immediately apply license type change
                            router.get(
                                '/questions',
                                {
                                    ...localFilters,
                                    license_type: newLicenseType,
                                },
                                {
                                    preserveState: true,
                                    preserveScroll: true,
                                },
                            );
                        }}
                    >
                        <SelectTrigger className="h-8 w-auto min-w-[80px] text-sm">
                            <SelectValue placeholder="ყველა" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">ყველა </SelectItem>
                            {licenseTypes.map((lt) => (
                                <SelectItem
                                    key={lt.id}
                                    value={lt.id.toString()}
                                >
                                    <span className="flex items-center gap-2">
                                        {getLicenseTypeIcon(lt.code)}
                                        <span>
                                            {lt.code}
                                            {lt.children.length > 0 &&
                                                `, ${lt.children.map((c) => c.code).join(', ')}`}
                                        </span>
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Sheet
                        open={isFilterOpen}
                        onOpenChange={(open) => {
                            setIsFilterOpen(open);
                            if (!open) setCategorySearch('');
                        }}
                    >
                        <SheetTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Filter className="h-4 w-4" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent
                            side="right"
                            className="flex flex-col overflow-hidden"
                        >
                            <SheetHeader className="px-5">
                                <SheetTitle className="text-xl">
                                    თემები
                                </SheetTitle>
                            </SheetHeader>

                            {/* Search Input */}
                            <div className="px-5 pb-3">
                                <div className="relative">
                                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="ძებნა..."
                                        value={categorySearch}
                                        onChange={(e) =>
                                            setCategorySearch(e.target.value)
                                        }
                                        className="pr-9 pl-9"
                                    />
                                    {categorySearch && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setCategorySearch('')
                                            }
                                            className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 px-5 pb-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => {
                                        const allCategories = categories
                                            .filter(
                                                (c) =>
                                                    (categoryCounts[c.id] ||
                                                        0) > 0,
                                            )
                                            .map((c) => c.id);
                                        setLocalFilters((f) => ({
                                            ...f,
                                            categories: allCategories,
                                        }));
                                        router.get(
                                            '/questions',
                                            {
                                                ...localFilters,
                                                categories: allCategories,
                                            },
                                            {
                                                preserveState: true,
                                                preserveScroll: true,
                                            },
                                        );
                                        setIsFilterOpen(false);
                                    }}
                                >
                                    ყველა ({totalCategoryCount})
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => {
                                        setLocalFilters((f) => ({
                                            ...f,
                                            categories: [],
                                        }));
                                        router.get(
                                            '/questions',
                                            { ...localFilters, categories: [] },
                                            {
                                                preserveState: true,
                                                preserveScroll: true,
                                            },
                                        );
                                        setIsFilterOpen(false);
                                    }}
                                >
                                    გასუფთავება
                                </Button>
                            </div>

                            {/* Category List */}
                            <div className="flex-1 space-y-1 overflow-y-auto px-5 pb-6">
                                {filteredCategories.map((cat) => {
                                    const count = categoryCounts[cat.id] || 0;
                                    const isSelected =
                                        localFilters.categories.includes(
                                            cat.id,
                                        );
                                    return (
                                        <button
                                            key={cat.id}
                                            disabled={count === 0}
                                            onClick={() => {
                                                const newCategories = isSelected
                                                    ? localFilters.categories.filter(
                                                          (id) => id !== cat.id,
                                                      )
                                                    : [
                                                          ...localFilters.categories,
                                                          cat.id,
                                                      ];
                                                setLocalFilters((f) => ({
                                                    ...f,
                                                    categories: newCategories,
                                                }));
                                                router.get(
                                                    '/questions',
                                                    {
                                                        ...localFilters,
                                                        categories:
                                                            newCategories,
                                                    },
                                                    {
                                                        preserveState: true,
                                                        preserveScroll: true,
                                                    },
                                                );
                                                setIsFilterOpen(false);
                                            }}
                                            className={`flex w-full items-center justify-between gap-3 rounded-lg border p-4 text-left transition-colors ${
                                                count === 0
                                                    ? 'cursor-not-allowed opacity-40'
                                                    : isSelected
                                                      ? 'border-primary bg-primary/10'
                                                      : 'hover:bg-accent'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                                                        isSelected
                                                            ? 'border-primary bg-primary text-primary-foreground'
                                                            : 'border-input'
                                                    }`}
                                                >
                                                    {isSelected && (
                                                        <Check className="h-3 w-3" />
                                                    )}
                                                </div>
                                                <span className="text-base">
                                                    {cat.name}
                                                </span>
                                            </div>
                                            <span className="text-sm text-muted-foreground">
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>

            {/* Sign Filter Banner */}
            {filterSign && (
                <div className="flex items-center gap-3 border-b bg-muted/50 px-4 py-2">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded border bg-background p-1">
                        <img
                            src={`/images/signs/${filterSign.image}`}
                            alt={filterSign.title}
                            className="h-full w-full object-contain"
                        />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">
                            ნიშნის კითხვები
                        </p>
                        <p className="truncate text-sm font-medium">
                            {filterSign.title}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => {
                            // Clear sign filter by navigating without sign_id
                            const { sign_id: _, ...restFilters } = localFilters;
                            router.get('/questions', restFilters, {
                                preserveState: true,
                                preserveScroll: true,
                            });
                        }}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* Top Pagination */}
            <Pagination
                currentPage={questions.current_page}
                lastPage={questions.last_page}
                perPage={localFilters.per_page}
                onPageChange={goToPage}
                onPerPageChange={handlePerPageChange}
            />

            {/* Questions List */}
            <div className="space-y-4 p-4">
                {questions.data.map((question, index) => (
                    <QuestionCard
                        key={question.id}
                        question={question}
                        questionNumber={
                            (questions.current_page - 1) * questions.per_page +
                            index +
                            1
                        }
                        shuffleSeed={shuffleSeed}
                        answerState={answerStates[question.id]}
                        isBookmarked={bookmarkedQuestions[question.id] || false}
                        isSubmitting={submittingQuestions.has(question.id)}
                        onAnswer={handleAnswer}
                        onBookmark={handleBookmark}
                        onInfoClick={setSignsModalQuestion}
                    />
                ))}
            </div>

            {/* Bottom Pagination */}
            <Pagination
                currentPage={questions.current_page}
                lastPage={questions.last_page}
                perPage={localFilters.per_page}
                onPageChange={goToPage}
                onPerPageChange={handlePerPageChange}
            />

            {/* Signs Info Modal */}
            <SignsInfoDialog
                open={!!signsModalQuestion}
                onOpenChange={(open) => !open && setSignsModalQuestion(null)}
                description={signsModalQuestion?.description || null}
                imageCustom={signsModalQuestion?.image_custom || null}
                signs={signsModalQuestion?.signs || []}
            />
        </MobileLayout>
    );
}
