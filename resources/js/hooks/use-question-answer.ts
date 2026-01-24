import axios from 'axios';
import { useCallback, useRef, useState } from 'react';

import type { AnswerState, Question } from '@/types/models';

interface AnswerResponse {
    is_correct: boolean;
    correct_answer_id: number;
    explanation: string | null;
}

interface UseQuestionAnswerOptions {
    /** Callback fired on successful answer submission */
    onCorrect?: (questionId: number) => void;
    /** Callback fired when answer is wrong */
    onWrong?: (questionId: number) => void;
    /** Callback fired on any answer (correct or wrong) */
    onAnswer?: (questionId: number, isCorrect: boolean) => void;
    /** Callback fired on error */
    onError?: (error: unknown, questionId: number) => void;
}

interface UseQuestionAnswerReturn {
    /** Answer states for all questions keyed by question ID */
    answerStates: Record<number, AnswerState>;
    /** Set of question IDs currently being submitted */
    submittingQuestions: Set<number>;
    /** Submit an answer for a question */
    submitAnswer: (question: Question, answerId: number) => Promise<void>;
    /** Check if a question has been answered */
    isAnswered: (questionId: number) => boolean;
    /** Check if a question is currently submitting */
    isSubmitting: (questionId: number) => boolean;
    /** Get the answer state for a specific question */
    getAnswerState: (questionId: number) => AnswerState | undefined;
    /** Session score tracking */
    sessionScore: { correct: number; wrong: number };
    /** IDs of questions answered correctly in this session */
    sessionCorrectIds: number[];
    /** IDs of questions answered incorrectly in this session */
    sessionWrongIds: number[];
    /** Reset all answer states (for new session) */
    reset: () => void;
}

/**
 * Hook for managing question answer submission with server synchronization.
 * Handles optimistic updates, loading states, and session score tracking.
 *
 * @example
 * ```tsx
 * const { submitAnswer, isAnswered, sessionScore } = useQuestionAnswer({
 *     onCorrect: (id) => console.log(`Question ${id} correct!`),
 *     onWrong: (id) => console.log(`Question ${id} wrong!`),
 * });
 *
 * // In question card
 * <button onClick={() => submitAnswer(question, answerId)} disabled={isAnswered(question.id)}>
 *     Submit
 * </button>
 * ```
 */
export function useQuestionAnswer({
    onCorrect,
    onWrong,
    onAnswer,
    onError,
}: UseQuestionAnswerOptions = {}): UseQuestionAnswerReturn {
    const [answerStates, setAnswerStates] = useState<
        Record<number, AnswerState>
    >({});
    const [submittingQuestions, setSubmittingQuestions] = useState<Set<number>>(
        new Set(),
    );
    const [sessionScore, setSessionScore] = useState({ correct: 0, wrong: 0 });
    const [sessionCorrectIds, setSessionCorrectIds] = useState<number[]>([]);
    const [sessionWrongIds, setSessionWrongIds] = useState<number[]>([]);

    // Ref to track pending submissions (prevents race conditions from rapid clicks)
    const pendingAnswersRef = useRef<Set<number>>(new Set());

    const isAnswered = useCallback(
        (questionId: number): boolean => {
            return !!answerStates[questionId]?.selectedAnswerId;
        },
        [answerStates],
    );

    const isSubmitting = useCallback(
        (questionId: number): boolean => {
            return submittingQuestions.has(questionId);
        },
        [submittingQuestions],
    );

    const getAnswerState = useCallback(
        (questionId: number): AnswerState | undefined => {
            return answerStates[questionId];
        },
        [answerStates],
    );

    const submitAnswer = useCallback(
        async (question: Question, answerId: number): Promise<void> => {
            // Check if already answered
            if (answerStates[question.id]?.selectedAnswerId) return;

            // Prevent duplicate submissions using ref (handles rapid clicks)
            if (pendingAnswersRef.current.has(question.id)) return;
            pendingAnswersRef.current.add(question.id);

            // Update UI to show loading state
            setSubmittingQuestions((prev) => new Set(prev).add(question.id));

            try {
                const { data } = await axios.post<AnswerResponse>(
                    `/questions/${question.id}/answer`,
                    { answer_id: answerId },
                );

                const newAnswerState: AnswerState = {
                    questionId: question.id,
                    selectedAnswerId: answerId,
                    correctAnswerId: data.correct_answer_id,
                    isCorrect: data.is_correct,
                    explanation: data.explanation,
                };

                setAnswerStates((prev) => ({
                    ...prev,
                    [question.id]: newAnswerState,
                }));

                // Update session score
                setSessionScore((prev) => ({
                    correct: prev.correct + (data.is_correct ? 1 : 0),
                    wrong: prev.wrong + (data.is_correct ? 0 : 1),
                }));

                // Track question IDs for session-based filtering
                if (data.is_correct) {
                    setSessionCorrectIds((prev) => [...prev, question.id]);
                    onCorrect?.(question.id);
                } else {
                    setSessionWrongIds((prev) => [...prev, question.id]);
                    onWrong?.(question.id);
                }

                onAnswer?.(question.id, data.is_correct);
            } catch (error) {
                console.error('Failed to submit answer:', error);
                onError?.(error, question.id);
            } finally {
                pendingAnswersRef.current.delete(question.id);
                setSubmittingQuestions((prev) => {
                    const next = new Set(prev);
                    next.delete(question.id);
                    return next;
                });
            }
        },
        [answerStates, onCorrect, onWrong, onAnswer, onError],
    );

    const reset = useCallback((): void => {
        setAnswerStates({});
        setSubmittingQuestions(new Set());
        setSessionScore({ correct: 0, wrong: 0 });
        setSessionCorrectIds([]);
        setSessionWrongIds([]);
        pendingAnswersRef.current.clear();
    }, []);

    return {
        answerStates,
        submittingQuestions,
        submitAnswer,
        isAnswered,
        isSubmitting,
        getAnswerState,
        sessionScore,
        sessionCorrectIds,
        sessionWrongIds,
        reset,
    };
}
