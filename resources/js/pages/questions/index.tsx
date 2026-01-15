import { Head, router } from '@inertiajs/react';
import {
    Bus,
    Car,
    Check,
    ChevronLeft,
    ChevronRight,
    Filter,
    Motorbike,
    Scooter,
    Shield,
    Tractor,
    TramFront,
    Truck,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { QuestionCard } from '@/components/question-card';
import { SignsInfoDialog } from '@/components/signs-info-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
    unanswered: boolean;
    per_page: number;
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
function getPageNumbers(currentPage: number, lastPage: number): (number | 'ellipsis')[] {
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
                        <span key={`ellipsis-${index}`} className="px-1 text-muted-foreground">
                            ...
                        </span>
                    ) : (
                        <Button
                            key={page}
                            variant={page === currentPage ? 'default' : 'outline'}
                            size="icon"
                            className="h-8 w-8 text-sm"
                            onClick={() => onPageChange(page)}
                        >
                            {page}
                        </Button>
                    )
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
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [localFilters, setLocalFilters] = useState<Filters>(filters);
    const [signsModalQuestion, setSignsModalQuestion] =
        useState<Question | null>(null);

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

    // Shuffle answers once per page load while preserving correct answer tracking
    const shuffledAnswers = useMemo(() => {
        const shuffleArray = <T,>(array: T[]): T[] => {
            const shuffled = [...array];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        };

        const map: Record<number, Answer[]> = {};
        questions.data.forEach((question) => {
            map[question.id] = shuffleArray(question.answers);
        });
        return map;
    }, [questions.data]);

    const handleAnswer = useCallback(
        async (question: Question, answerId: number) => {
            if (answerStates[question.id]?.selectedAnswerId) return;

            try {
                const response = await fetch(
                    `/questions/${question.id}/answer`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                            'X-CSRF-TOKEN':
                                document.querySelector<HTMLMetaElement>(
                                    'meta[name="csrf-token"]',
                                )?.content || '',
                        },
                        body: JSON.stringify({ answer_id: answerId }),
                    },
                );

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

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
            } catch (error) {
                console.error('Failed to submit answer:', error);
            }
        },
        [answerStates],
    );

    const handleBookmark = useCallback(async (questionId: number) => {
        try {
            const response = await fetch(`/questions/${questionId}/bookmark`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN':
                        document.querySelector<HTMLMetaElement>(
                            'meta[name="csrf-token"]',
                        )?.content || '',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setBookmarkedQuestions((prev) => ({
                ...prev,
                [questionId]: data.is_bookmarked,
            }));
        } catch (error) {
            console.error('Failed to toggle bookmark:', error);
        }
    }, []);

    const applyFilters = useCallback(() => {
        setIsFilterOpen(false);
        router.get(
            '/questions',
            {
                license_type: localFilters.license_type,
                categories: localFilters.categories,
                show_inactive: localFilters.show_inactive,
                bookmarked: localFilters.bookmarked,
                wrong_only: localFilters.wrong_only,
                unanswered: localFilters.unanswered,
                per_page: localFilters.per_page,
            },
            {
                preserveState: true,
                preserveScroll: true,
            },
        );
    }, [localFilters]);

    const resetFilters = useCallback(() => {
        const defaultFilters: Filters = {
            license_type: null,
            categories: [],
            show_inactive: false,
            bookmarked: false,
            wrong_only: false,
            unanswered: false,
            per_page: 20,
        };
        setLocalFilters(defaultFilters);
    }, []);

    const goToPage = useCallback(
        (page: number) => {
            router.get(
                '/questions',
                { ...filters, page },
                {
                    preserveState: true,
                    preserveScroll: true,
                },
            );
        },
        [filters],
    );

    const handlePerPageChange = useCallback(
        (perPage: number) => {
            setLocalFilters((f) => ({ ...f, per_page: perPage }));
            router.get(
                '/questions',
                { ...filters, per_page: perPage, page: 1 },
                {
                    preserveState: true,
                    preserveScroll: true,
                },
            );
        },
        [filters],
    );

    // Calculate total count for all categories
    const totalCategoryCount = useMemo(() => {
        return Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
    }, [categoryCounts]);

    return (
        <MobileLayout>
            <Head title="ბილეთები" />

            {/* Score Bar */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background px-4 py-2">
                <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-600">
                        <Check className="mr-1 inline h-4 w-4" />
                        {sessionScore.correct}
                    </span>
                    <span className="text-red-600">
                        <X className="mr-1 inline h-4 w-4" />
                        {sessionScore.wrong}
                    </span>
                </div>

                <div className="flex items-center gap-2">
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

                    <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Filter className="h-4 w-4" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="overflow-y-auto">
                            <SheetHeader className="px-5">
                                <SheetTitle className="text-xl">
                                    ფილტრები
                                </SheetTitle>
                            </SheetHeader>

                            <div className="space-y-6 px-5 pb-6">

                                {/* Status Filters */}
                                <div className="space-y-3">
                                    <Label className="mb-2 block text-base font-semibold">
                                        სტატუსი
                                    </Label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
                                            <Checkbox
                                                checked={
                                                    localFilters.bookmarked
                                                }
                                                onCheckedChange={(c) =>
                                                    setLocalFilters((f) => ({
                                                        ...f,
                                                        bookmarked: c === true,
                                                    }))
                                                }
                                            />
                                            <span className="text-sm">
                                                შენახული
                                            </span>
                                        </label>
                                        <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
                                            <Checkbox
                                                checked={
                                                    localFilters.wrong_only
                                                }
                                                onCheckedChange={(c) =>
                                                    setLocalFilters((f) => ({
                                                        ...f,
                                                        wrong_only: c === true,
                                                    }))
                                                }
                                            />
                                            <span className="text-sm">
                                                შეცდომები
                                            </span>
                                        </label>
                                        <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
                                            <Checkbox
                                                checked={
                                                    localFilters.unanswered
                                                }
                                                onCheckedChange={(c) =>
                                                    setLocalFilters((f) => ({
                                                        ...f,
                                                        unanswered: c === true,
                                                    }))
                                                }
                                            />
                                            <span className="text-sm">
                                                უპასუხო
                                            </span>
                                        </label>
                                        <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent">
                                            <Checkbox
                                                checked={
                                                    localFilters.show_inactive
                                                }
                                                onCheckedChange={(c) =>
                                                    setLocalFilters((f) => ({
                                                        ...f,
                                                        show_inactive:
                                                            c === true,
                                                    }))
                                                }
                                            />
                                            <span className="text-sm">
                                                ამოღებული
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                {/* Category Filter */}
                                <div className="space-y-3">
                                    <div className="mb-2 flex items-center justify-between">
                                        <Label className="text-base font-semibold">
                                            თემები
                                        </Label>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-2 text-xs"
                                                onClick={() =>
                                                    setLocalFilters((f) => ({
                                                        ...f,
                                                        categories: categories
                                                            .filter(
                                                                (c) =>
                                                                    (categoryCounts[
                                                                        c.id
                                                                    ] || 0) > 0,
                                                            )
                                                            .map((c) => c.id),
                                                    }))
                                                }
                                            >
                                                ყველა ({totalCategoryCount})
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-2 text-xs"
                                                onClick={() =>
                                                    setLocalFilters((f) => ({
                                                        ...f,
                                                        categories: [],
                                                    }))
                                                }
                                            >
                                                გასუფთავება
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border p-2">
                                        {categories.map((cat) => {
                                            const count =
                                                categoryCounts[cat.id] || 0;
                                            return (
                                                <label
                                                    key={cat.id}
                                                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-md p-2 transition-colors hover:bg-accent ${count === 0 ? 'opacity-50' : ''}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Checkbox
                                                            checked={localFilters.categories.includes(
                                                                cat.id,
                                                            )}
                                                            disabled={
                                                                count === 0
                                                            }
                                                            onCheckedChange={(
                                                                c,
                                                            ) =>
                                                                setLocalFilters(
                                                                    (f) => ({
                                                                        ...f,
                                                                        categories:
                                                                            c
                                                                                ? [
                                                                                      ...f.categories,
                                                                                      cat.id,
                                                                                  ]
                                                                                : f.categories.filter(
                                                                                      (
                                                                                          id,
                                                                                      ) =>
                                                                                          id !==
                                                                                          cat.id,
                                                                                  ),
                                                                    }),
                                                                )
                                                            }
                                                        />
                                                        <span className="text-sm">
                                                            {cat.name}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">
                                                        {count}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3 pt-2">
                                    <Button
                                        variant="outline"
                                        className="h-12 flex-1 text-base"
                                        onClick={resetFilters}
                                    >
                                        გასუფთავება
                                    </Button>
                                    <Button
                                        className="h-12 flex-1 text-base"
                                        onClick={applyFilters}
                                    >
                                        შენახვა
                                    </Button>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>

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
                        shuffledAnswers={
                            shuffledAnswers[question.id] || question.answers
                        }
                        answerState={answerStates[question.id]}
                        isBookmarked={bookmarkedQuestions[question.id] || false}
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
