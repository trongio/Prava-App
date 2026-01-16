import { Link } from '@inertiajs/react';
import {
    BookOpen,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Sign {
    id: number;
    position: number;
    image: string;
    title: string;
    title_en: string | null;
    description: string | null;
}

interface SignCategory {
    id: number;
    name: string;
    group_number: number;
}

interface SignPreviewProps {
    sign: Sign | null;
    category: SignCategory | null;
    allSigns: Sign[];
    onClose: () => void;
    onNavigate: (sign: Sign) => void;
}

export function SignPreview({
    sign,
    category,
    allSigns,
    onClose,
    onNavigate,
}: SignPreviewProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [relatedQuestionsCount, setRelatedQuestionsCount] = useState<
        number | null
    >(null);
    const [isLoading, setIsLoading] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Find current sign index for navigation
    const currentIndex = sign
        ? allSigns.findIndex((s) => s.id === sign.id)
        : -1;
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < allSigns.length - 1 && currentIndex !== -1;

    // Handle Android back button
    useEffect(() => {
        const handlePopState = (e: PopStateEvent) => {
            if (sign) {
                e.preventDefault();
                if (isExpanded) {
                    setIsExpanded(false);
                } else {
                    onClose();
                }
                window.history.pushState(null, '', window.location.href);
            }
        };

        if (sign) {
            window.history.pushState(null, '', window.location.href);
        }

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [sign, isExpanded, onClose]);

    // Fetch related questions when expanded
    const fetchRelatedQuestions = useCallback(async (signId: number) => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();

        setIsLoading(true);
        try {
            const res = await fetch(`/signs/${signId}`, {
                signal: abortControllerRef.current.signal,
            });
            const data = await res.json();
            setRelatedQuestionsCount(data.related_questions_count);
        } catch (error) {
            if (error instanceof Error && error.name !== 'AbortError') {
                console.error(error);
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (sign && isExpanded) {
            fetchRelatedQuestions(sign.id);
        } else {
            setRelatedQuestionsCount(null);
        }

        return () => {
            abortControllerRef.current?.abort();
        };
    }, [sign, isExpanded, fetchRelatedQuestions]);

    // Navigation handlers
    const handlePrev = useCallback(() => {
        if (hasPrev) {
            onNavigate(allSigns[currentIndex - 1]);
        }
    }, [hasPrev, currentIndex, allSigns, onNavigate]);

    const handleNext = useCallback(() => {
        if (hasNext) {
            onNavigate(allSigns[currentIndex + 1]);
        }
    }, [hasNext, currentIndex, allSigns, onNavigate]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!sign) return;
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [sign, handlePrev, handleNext, onClose]);

    if (!sign || !category) return null;

    return (
        <div
            className={cn(
                'fixed inset-x-0 bottom-0 z-50 bg-background shadow-[0_-4px_20px_rgba(0,0,0,0.15)] transition-all duration-300 ease-out dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)]',
                isExpanded ? 'h-72 rounded-t-2xl' : 'h-20 rounded-t-xl',
            )}
            style={{ paddingBottom: 'var(--inset-bottom, 0px)' }}
        >
            {/* Compact Preview */}
            <div
                className={cn(
                    'flex items-center gap-3 p-3',
                    !isExpanded && 'cursor-pointer',
                )}
                onClick={() => !isExpanded && setIsExpanded(true)}
            >
                {/* Navigation - Previous */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => {
                        e.stopPropagation();
                        handlePrev();
                    }}
                    disabled={!hasPrev}
                >
                    <ChevronLeft className="h-5 w-5" />
                </Button>

                {/* Sign Image */}
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-muted/50 p-1.5">
                    <img
                        src={`/images/signs/${sign.image}`}
                        alt={sign.title}
                        className="h-full w-full object-contain"
                    />
                </div>

                {/* Sign Info */}
                <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm leading-tight font-medium">
                        {sign.title}
                    </p>
                    {sign.title_en && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {sign.title_en}
                        </p>
                    )}
                </div>

                {/* Navigation - Next */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleNext();
                    }}
                    disabled={!hasNext}
                >
                    <ChevronRight className="h-5 w-5" />
                </Button>

                {/* Close Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                >
                    <X className="h-5 w-5" />
                </Button>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="flex h-[calc(100%-5rem)] flex-col border-t px-4">
                    {/* Counter */}
                    <div className="flex shrink-0 items-center justify-between py-2">
                        <Badge variant="secondary" className="text-xs">
                            {category.name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                            {currentIndex + 1} / {allSigns.length}
                        </span>
                    </div>

                    {/* Scrollable Content */}
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {/* Description */}
                        {sign.description && (
                            <div className="rounded-lg bg-muted/50 p-3">
                                <p className="text-sm text-muted-foreground">
                                    {sign.description}
                                </p>
                            </div>
                        )}

                        {/* Related Questions */}
                        {isLoading ? (
                            <div className="mt-3 h-10 animate-pulse rounded-lg bg-muted" />
                        ) : relatedQuestionsCount !== null &&
                          relatedQuestionsCount > 0 ? (
                            <Button
                                asChild
                                variant="outline"
                                className="mt-3 w-full"
                            >
                                <Link
                                    href={`/questions?sign_id=${sign.id}`}
                                    className="flex items-center gap-2"
                                >
                                    <BookOpen className="h-4 w-4" />
                                    <span>
                                        დაკავშირებული კითხვები (
                                        {relatedQuestionsCount})
                                    </span>
                                    <ExternalLink className="ml-auto h-4 w-4" />
                                </Link>
                            </Button>
                        ) : null}
                    </div>

                    {/* Collapse Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="hidden shrink-0 py-2 text-xs text-muted-foreground"
                        onClick={() => setIsExpanded(false)}
                    >
                        დაკეცვა
                    </Button>
                </div>
            )}
        </div>
    );
}
