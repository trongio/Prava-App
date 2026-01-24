import { Head } from '@inertiajs/react';
import {
    AlertTriangle,
    Ban,
    CircleDot,
    Hexagon,
    Info,
    LayoutGrid,
    Navigation,
    Search,
    ShieldAlert,
    Signpost,
    Square,
    TrafficCone,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SignCard } from '@/components/sign-card';
import { SignPreview } from '@/components/sign-preview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import MobileLayout from '@/layouts/mobile-layout';
import { cn } from '@/lib/utils';

interface SignCategoryNote {
    id: number;
    position: number;
    content: string;
    sign_ids: number[];
}

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
    signs: Sign[];
    notes: SignCategoryNote[];
}

interface Props {
    categories: SignCategory[];
    totalSigns: number;
}

// Category styling based on emsi.ge
const categoryStyles: Record<
    number,
    { color: string; bgColor: string; icon: typeof AlertTriangle }
> = {
    1: {
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        icon: AlertTriangle,
    },
    2: {
        color: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-100 dark:bg-amber-900/30',
        icon: Hexagon,
    },
    3: {
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        icon: Ban,
    },
    4: {
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        icon: CircleDot,
    },
    5: {
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        icon: Signpost,
    },
    6: {
        color: 'text-slate-600 dark:text-slate-400',
        bgColor: 'bg-slate-100 dark:bg-slate-800/50',
        icon: Square,
    },
    7: {
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        icon: Info,
    },
    8: {
        color: 'text-slate-600 dark:text-slate-400',
        bgColor: 'bg-slate-100 dark:bg-slate-800/50',
        icon: LayoutGrid,
    },
    9: {
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
        icon: TrafficCone,
    },
    10: {
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
        icon: Navigation,
    },
    11: {
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
        icon: ShieldAlert,
    },
};

function getCategoryStyle(groupNumber: number) {
    return (
        categoryStyles[groupNumber] || {
            color: 'text-muted-foreground',
            bgColor: 'bg-muted',
            icon: Info,
        }
    );
}

export default function SignsIndex({ categories, totalSigns }: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
        null,
    );
    const [selectedNoteIndex, setSelectedNoteIndex] = useState<number | null>(
        null,
    );
    const [selectedSign, setSelectedSign] = useState<Sign | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const signRefs = useRef<Map<number, HTMLElement>>(new Map());
    const { direction, isAtTop } = useScrollDirection({
        threshold: 15,
        containerRef: scrollContainerRef,
    });

    // Header should be visible when at top or scrolling up
    const isHeaderVisible = isAtTop || direction === 'up';

    // Scroll to selected sign - position it in visible area between header and info panel
    useEffect(() => {
        if (selectedSign && scrollContainerRef.current) {
            const element = signRefs.current.get(selectedSign.id);
            if (element) {
                const container = scrollContainerRef.current;
                const elementRect = element.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();

                // Get header height (if visible, it affects the visible area)
                const headerHeight = headerRef.current?.offsetHeight || 0;

                // Info panel height: header ~80px + content h-70 280px = ~360px
                const infoPanelHeight = 360;

                // Calculate visible area (between header and info panel)
                const visibleHeight =
                    containerRect.height - infoPanelHeight - headerHeight;

                // Calculate where we want the element (centered in visible area, offset by header)
                const targetScrollTop =
                    container.scrollTop +
                    (elementRect.top - containerRect.top) -
                    headerHeight -
                    visibleHeight / 2 +
                    elementRect.height / 2;

                container.scrollTo({
                    top: Math.max(0, targetScrollTop),
                    behavior: 'smooth',
                });
            }
        }
    }, [selectedSign]);

    // Get selected category
    const selectedCategory = useMemo(
        () => categories.find((c) => c.id === selectedCategoryId) || null,
        [categories, selectedCategoryId],
    );

    // Get filtered signs based on search, category, and note selection
    const filteredSigns = useMemo(() => {
        let signs: Sign[] = [];

        if (selectedCategoryId) {
            const category = categories.find(
                (c) => c.id === selectedCategoryId,
            );
            if (category) {
                if (
                    selectedNoteIndex !== null &&
                    category.notes[selectedNoteIndex]
                ) {
                    // Filter by note's sign_ids
                    const noteSignIds =
                        category.notes[selectedNoteIndex].sign_ids;
                    signs = category.signs.filter((s) =>
                        noteSignIds.includes(s.id),
                    );
                } else {
                    signs = category.signs;
                }
            }
        } else {
            // All signs from all categories
            signs = categories.flatMap((c) => c.signs);
        }

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            signs = signs.filter(
                (s) =>
                    s.title.toLowerCase().includes(query) ||
                    (s.title_en && s.title_en.toLowerCase().includes(query)) ||
                    (s.description &&
                        s.description.toLowerCase().includes(query)),
            );
        }

        return signs;
    }, [categories, selectedCategoryId, selectedNoteIndex, searchQuery]);

    const handleCategorySelect = useCallback((categoryId: number | null) => {
        setSelectedCategoryId(categoryId);
        setSelectedNoteIndex(null);
    }, []);

    const handleSignClick = useCallback((sign: Sign) => {
        setSelectedSign(sign);
    }, []);

    const handleSignClose = useCallback(() => {
        setSelectedSign(null);
    }, []);

    // Get the category for the selected sign
    const selectedSignCategory = useMemo(() => {
        if (!selectedSign) return null;
        return (
            categories.find((c) =>
                c.signs.some((s) => s.id === selectedSign.id),
            ) || null
        );
    }, [categories, selectedSign]);

    return (
        <MobileLayout title="ნიშნები">
            <Head title="საგზაო ნიშნები" />

            <div
                ref={scrollContainerRef}
                className="flex h-full flex-col overflow-y-auto"
            >
                {/* Collapsible Header with Search */}
                <div
                    ref={headerRef}
                    className={cn(
                        'sticky top-0 z-10 border-b bg-background/95 backdrop-blur transition-all duration-300 ease-out supports-[backdrop-filter]:bg-background/60',
                        !isHeaderVisible && '-translate-y-full opacity-0',
                    )}
                >
                    {/* Search Bar */}
                    <div className="p-3">
                        <div className="relative">
                            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="ნიშნის ძებნა..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pr-9 pl-9"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Category Tabs - 2 rows horizontal scroll */}
                    <div className="scrollbar-hide overflow-x-auto px-3 pb-3">
                        <div className="flex w-max flex-col gap-2">
                            {/* Row 1 */}
                            <div className="flex gap-2">
                                <Button
                                    variant={
                                        selectedCategoryId === null
                                            ? 'default'
                                            : 'outline'
                                    }
                                    size="sm"
                                    onClick={() => handleCategorySelect(null)}
                                >
                                    ყველა ({totalSigns})
                                </Button>
                                {categories.slice(0, 5).map((category) => {
                                    const style = getCategoryStyle(
                                        category.group_number,
                                    );
                                    const Icon = style.icon;
                                    const isSelected =
                                        selectedCategoryId === category.id;

                                    return (
                                        <Button
                                            key={category.id}
                                            variant={
                                                isSelected
                                                    ? 'default'
                                                    : 'outline'
                                            }
                                            size="sm"
                                            onClick={() =>
                                                handleCategorySelect(
                                                    category.id,
                                                )
                                            }
                                            className="gap-1.5"
                                        >
                                            <Icon
                                                className={cn(
                                                    'h-3.5 w-3.5',
                                                    !isSelected && style.color,
                                                )}
                                            />
                                            <span className="max-w-[100px] truncate">
                                                {category.name}
                                            </span>
                                            <Badge
                                                variant={
                                                    isSelected
                                                        ? 'outline'
                                                        : 'secondary'
                                                }
                                                className={cn(
                                                    'ml-1 h-5 px-1.5',
                                                    isSelected &&
                                                        'border-primary-foreground/50 text-primary-foreground',
                                                )}
                                            >
                                                {category.signs.length}
                                            </Badge>
                                        </Button>
                                    );
                                })}
                            </div>
                            {/* Row 2 */}
                            <div className="flex gap-2">
                                {categories.slice(5).map((category) => {
                                    const style = getCategoryStyle(
                                        category.group_number,
                                    );
                                    const Icon = style.icon;
                                    const isSelected =
                                        selectedCategoryId === category.id;

                                    return (
                                        <Button
                                            key={category.id}
                                            variant={
                                                isSelected
                                                    ? 'default'
                                                    : 'outline'
                                            }
                                            size="sm"
                                            onClick={() =>
                                                handleCategorySelect(
                                                    category.id,
                                                )
                                            }
                                            className="gap-1.5"
                                        >
                                            <Icon
                                                className={cn(
                                                    'h-3.5 w-3.5',
                                                    !isSelected && style.color,
                                                )}
                                            />
                                            <span className="max-w-[100px] truncate">
                                                {category.name}
                                            </span>
                                            <Badge
                                                variant={
                                                    isSelected
                                                        ? 'outline'
                                                        : 'secondary'
                                                }
                                                className={cn(
                                                    'ml-1 h-5 px-1.5',
                                                    isSelected &&
                                                        'border-primary-foreground/50 text-primary-foreground',
                                                )}
                                            >
                                                {category.signs.length}
                                            </Badge>
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Notes Tabs (when category with notes is selected) */}
                    {selectedCategory && selectedCategory.notes.length > 0 && (
                        <div className="scrollbar-hide flex gap-2 overflow-x-auto border-t px-3 py-2">
                            <Button
                                variant={
                                    selectedNoteIndex === null
                                        ? 'secondary'
                                        : 'ghost'
                                }
                                size="sm"
                                onClick={() => setSelectedNoteIndex(null)}
                                className="shrink-0 text-xs"
                            >
                                ყველა ნიშანი
                            </Button>
                            {selectedCategory.notes.map((note, index) => (
                                <Button
                                    key={note.id}
                                    variant={
                                        selectedNoteIndex === index
                                            ? 'secondary'
                                            : 'ghost'
                                    }
                                    size="sm"
                                    onClick={() => setSelectedNoteIndex(index)}
                                    className="shrink-0 text-xs"
                                >
                                    შენიშვნა {index + 1}
                                    <Badge
                                        variant="outline"
                                        className="ml-1.5 h-4 px-1 text-[10px]"
                                    >
                                        {note.sign_ids.length}
                                    </Badge>
                                </Button>
                            ))}
                        </div>
                    )}

                    {/* Note Content (when a note is selected) */}
                    {selectedCategory &&
                        selectedNoteIndex !== null &&
                        selectedCategory.notes[selectedNoteIndex] && (
                            <div className="border-t bg-muted/50 p-3">
                                <div
                                    className="prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground"
                                    dangerouslySetInnerHTML={{
                                        __html: selectedCategory.notes[
                                            selectedNoteIndex
                                        ].content,
                                    }}
                                />
                            </div>
                        )}
                </div>

                {/* Stats Bar */}
                <div className="border-b bg-muted/30 px-4 py-2">
                    <p className="text-sm text-muted-foreground">
                        {searchQuery ? (
                            <>
                                ნაპოვნია{' '}
                                <span className="font-medium text-foreground">
                                    {filteredSigns.length}
                                </span>{' '}
                                ნიშანი
                            </>
                        ) : selectedCategoryId ? (
                            <>
                                <span className="font-medium text-foreground">
                                    {filteredSigns.length}
                                </span>{' '}
                                ნიშანი კატეგორიაში
                            </>
                        ) : (
                            <>
                                სულ{' '}
                                <span className="font-medium text-foreground">
                                    {totalSigns}
                                </span>{' '}
                                ნიშანი
                            </>
                        )}
                    </p>
                </div>

                {/* Signs Grid - extra bottom padding when info panel is open */}
                <div className={cn('p-3', selectedSign && 'pb-96')}>
                    {filteredSigns.length === 0 ? (
                        <div className="py-12 text-center">
                            <Search className="mx-auto h-12 w-12 text-muted-foreground/50" />
                            <p className="mt-4 text-muted-foreground">
                                ნიშანი ვერ მოიძებნა
                            </p>
                            {searchQuery && (
                                <Button
                                    variant="link"
                                    onClick={() => setSearchQuery('')}
                                    className="mt-2"
                                >
                                    ძებნის გასუფთავება
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                            {filteredSigns.map((sign) => (
                                <div
                                    key={sign.id}
                                    ref={(el) => {
                                        if (el) {
                                            signRefs.current.set(sign.id, el);
                                        } else {
                                            signRefs.current.delete(sign.id);
                                        }
                                    }}
                                >
                                    <SignCard
                                        sign={sign}
                                        isSelected={
                                            selectedSign?.id === sign.id
                                        }
                                        onClick={() => handleSignClick(sign)}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Sign Preview */}
            <SignPreview
                sign={selectedSign}
                category={selectedSignCategory}
                allSigns={filteredSigns}
                onClose={handleSignClose}
                onNavigate={handleSignClick}
            />
        </MobileLayout>
    );
}
