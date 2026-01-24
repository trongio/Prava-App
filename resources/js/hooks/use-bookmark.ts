import axios from 'axios';
import { useCallback, useState } from 'react';

interface UseBookmarkOptions {
    /** Initial bookmarked state keyed by question ID */
    initialBookmarks?: Record<number, boolean>;
    /** Callback fired on successful bookmark toggle */
    onSuccess?: (questionId: number, isBookmarked: boolean) => void;
    /** Callback fired on error */
    onError?: (error: unknown, questionId: number) => void;
}

interface UseBookmarkReturn {
    /** Current bookmarked state for all questions */
    bookmarkedQuestions: Record<number, boolean>;
    /** Check if a specific question is bookmarked */
    isBookmarked: (questionId: number) => boolean;
    /** Toggle bookmark for a question (async) */
    toggleBookmark: (questionId: number) => Promise<void>;
    /** Set multiple bookmarks at once (useful for syncing with server data) */
    setBookmarks: (bookmarks: Record<number, boolean>) => void;
}

/**
 * Hook for managing question bookmark state with server synchronization.
 *
 * @example
 * ```tsx
 * const { isBookmarked, toggleBookmark } = useBookmark({
 *     initialBookmarks: userProgress,
 *     onSuccess: (id, bookmarked) => console.log(`Question ${id}: ${bookmarked}`)
 * });
 *
 * <Button onClick={() => toggleBookmark(question.id)}>
 *     {isBookmarked(question.id) ? 'Unbookmark' : 'Bookmark'}
 * </Button>
 * ```
 */
export function useBookmark({
    initialBookmarks = {},
    onSuccess,
    onError,
}: UseBookmarkOptions = {}): UseBookmarkReturn {
    const [bookmarkedQuestions, setBookmarkedQuestions] =
        useState<Record<number, boolean>>(initialBookmarks);

    const isBookmarked = useCallback(
        (questionId: number): boolean => {
            return bookmarkedQuestions[questionId] ?? false;
        },
        [bookmarkedQuestions],
    );

    const toggleBookmark = useCallback(
        async (questionId: number): Promise<void> => {
            try {
                const { data } = await axios.post<{ is_bookmarked: boolean }>(
                    `/questions/${questionId}/bookmark`,
                );

                setBookmarkedQuestions((prev) => ({
                    ...prev,
                    [questionId]: data.is_bookmarked,
                }));

                onSuccess?.(questionId, data.is_bookmarked);
            } catch (error) {
                console.error('Failed to toggle bookmark:', error);
                onError?.(error, questionId);
            }
        },
        [onSuccess, onError],
    );

    const setBookmarks = useCallback(
        (bookmarks: Record<number, boolean>): void => {
            setBookmarkedQuestions(bookmarks);
        },
        [],
    );

    return {
        bookmarkedQuestions,
        isBookmarked,
        toggleBookmark,
        setBookmarks,
    };
}
