import { router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { QuestionFilters } from '@/types/models';

interface UseFiltersOptions {
    /** Initial filters from server */
    initialFilters: QuestionFilters;
    /** URL path to navigate to when filters change */
    basePath?: string;
    /** Whether to preserve scroll position on filter change */
    preserveScroll?: boolean;
    /** Whether to preserve component state on filter change */
    preserveState?: boolean;
}

interface UseFiltersReturn {
    /** Current local filter state */
    filters: QuestionFilters;
    /** Update a single filter value */
    setFilter: <K extends keyof QuestionFilters>(
        key: K,
        value: QuestionFilters[K],
    ) => void;
    /** Update multiple filters at once */
    setFilters: (updates: Partial<QuestionFilters>) => void;
    /** Reset filters to initial state */
    resetFilters: () => void;
    /** Apply current filters (navigate with new URL params) */
    applyFilters: () => void;
    /** Toggle a boolean filter */
    toggleFilter: (
        key: 'show_inactive' | 'bookmarked' | 'wrong_only' | 'correct_only' | 'unanswered',
    ) => void;
    /** Toggle category selection */
    toggleCategory: (categoryId: number) => void;
    /** Select all categories */
    selectAllCategories: (categoryIds: number[]) => void;
    /** Clear all categories */
    clearCategories: () => void;
    /** Check if filters have been modified */
    isDirty: boolean;
    /** Format filters for URL request */
    formatForRequest: () => Record<string, unknown>;
}

/**
 * Hook for managing filter state with URL synchronization.
 * Provides local state that syncs with server filters and handles URL navigation.
 *
 * @example
 * ```tsx
 * const { filters, setFilter, applyFilters, toggleFilter } = useFilters({
 *     initialFilters: serverFilters,
 *     basePath: '/questions',
 * });
 *
 * <Select value={filters.license_type} onValueChange={(v) => setFilter('license_type', v)}>
 *     ...
 * </Select>
 *
 * <Button onClick={applyFilters}>Apply Filters</Button>
 * ```
 */
export function useFilters({
    initialFilters,
    basePath = '/questions',
    preserveScroll = true,
    preserveState = true,
}: UseFiltersOptions): UseFiltersReturn {
    const [filters, setFiltersState] = useState<QuestionFilters>(initialFilters);
    const isFilterSheetOpenRef = useRef(false);

    // Sync with server filters when they change (but not when filter sheet is open)
    // This pattern is intentional: we want to reset local state when server state changes,
    // but only when the filter sheet is closed (user isn't actively editing)
    // Using queueMicrotask to avoid synchronous setState in effect body
    useEffect(() => {
        if (!isFilterSheetOpenRef.current) {
            queueMicrotask(() => setFiltersState(initialFilters));
        }
    }, [initialFilters]);

    const setFilter = useCallback(
        <K extends keyof QuestionFilters>(
            key: K,
            value: QuestionFilters[K],
        ): void => {
            setFiltersState((prev) => ({ ...prev, [key]: value }));
        },
        [],
    );

    const setFilters = useCallback(
        (updates: Partial<QuestionFilters>): void => {
            setFiltersState((prev) => ({ ...prev, ...updates }));
        },
        [],
    );

    const resetFilters = useCallback((): void => {
        setFiltersState(initialFilters);
    }, [initialFilters]);

    const formatForRequest = useCallback((): Record<string, unknown> => {
        return {
            license_type: filters.license_type,
            categories: filters.categories.join(','),
            show_inactive: filters.show_inactive,
            bookmarked: filters.bookmarked || undefined,
            correct_only: filters.correct_only || undefined,
            wrong_only: filters.wrong_only || undefined,
            unanswered: filters.unanswered || undefined,
            per_page: filters.per_page,
            sign_id: filters.sign_id,
        };
    }, [filters]);

    const applyFilters = useCallback((): void => {
        router.get(basePath, formatForRequest() as Record<string, string | number | boolean | null | undefined>, {
            preserveState,
            preserveScroll,
        });
    }, [basePath, formatForRequest, preserveState, preserveScroll]);

    const toggleFilter = useCallback(
        (
            key: 'show_inactive' | 'bookmarked' | 'wrong_only' | 'correct_only' | 'unanswered',
        ): void => {
            const newValue = !filters[key];

            // For correct_only and wrong_only, they're mutually exclusive
            if (key === 'correct_only' && newValue) {
                setFiltersState((prev) => ({
                    ...prev,
                    correct_only: true,
                    wrong_only: false,
                }));
            } else if (key === 'wrong_only' && newValue) {
                setFiltersState((prev) => ({
                    ...prev,
                    wrong_only: true,
                    correct_only: false,
                }));
            } else {
                setFiltersState((prev) => ({ ...prev, [key]: newValue }));
            }
        },
        [filters],
    );

    const toggleCategory = useCallback((categoryId: number): void => {
        setFiltersState((prev) => {
            const isSelected = prev.categories.includes(categoryId);
            return {
                ...prev,
                categories: isSelected
                    ? prev.categories.filter((id) => id !== categoryId)
                    : [...prev.categories, categoryId],
            };
        });
    }, []);

    const selectAllCategories = useCallback((categoryIds: number[]): void => {
        setFiltersState((prev) => ({
            ...prev,
            categories: categoryIds,
        }));
    }, []);

    const clearCategories = useCallback((): void => {
        setFiltersState((prev) => ({
            ...prev,
            categories: [],
        }));
    }, []);

    const isDirty =
        JSON.stringify(filters) !== JSON.stringify(initialFilters);

    return {
        filters,
        setFilter,
        setFilters,
        resetFilters,
        applyFilters,
        toggleFilter,
        toggleCategory,
        selectAllCategories,
        clearCategories,
        isDirty,
        formatForRequest,
    };
}

/**
 * Helper hook for managing filter sheet state.
 * Handles Android back button and proper filter application on close.
 */
export function useFilterSheet(onApply: () => void) {
    const [isOpen, setIsOpen] = useState(false);
    const isOpenRef = useRef(isOpen);

    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);

    const open = useCallback(() => {
        setIsOpen(true);
        window.history.pushState({ filterOpen: true }, '', window.location.href);
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
        onApply();
    }, [onApply]);

    // Handle Android back button
    useEffect(() => {
        const handlePopState = (e: PopStateEvent) => {
            if (isOpenRef.current) {
                e.preventDefault();
                close();
                window.history.pushState(null, '', window.location.href);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [close]);

    // Handle Inertia navigation interception
    useEffect(() => {
        const removeBeforeListener = router.on('before', (event) => {
            if (isOpenRef.current) {
                const targetUrl = new URL(event.detail.visit.url);
                const currentPath = window.location.pathname;

                // Allow navigation to the same page (filter updates)
                if (targetUrl.pathname === currentPath) {
                    return;
                }

                // Cancel navigation to different pages and close the sheet instead
                event.preventDefault();
                close();
                return false;
            }
        });

        return removeBeforeListener;
    }, [close]);

    return {
        isOpen,
        open,
        close,
        setIsOpen: (open: boolean) => (open ? open : close()),
    };
}
