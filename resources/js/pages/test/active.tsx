import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import {
    AlertTriangle,
    Check,
    ChevronLeft,
    ChevronRight,
    Pause,
    Redo2,
    SkipForward,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { QuestionCard } from '@/components/question-card';
import { SignsInfoDialog } from '@/components/signs-info-dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface Answer {
    id: number;
    text: string;
    is_correct: boolean;
    position: number;
}

interface Sign {
    id: number;
    image: string;
    title: string;
    description: string | null;
}

interface QuestionCategory {
    id: number;
    name: string;
}

interface TestQuestion {
    id: number;
    question: string;
    description: string | null;
    full_description: string | null;
    image: string | null;
    image_custom: string | null;
    is_short_image: boolean;
    answers: Answer[];
    signs: Sign[];
    question_category: QuestionCategory;
}

interface AnswerGiven {
    answer_id: number;
    is_correct: boolean;
    answered_at: string;
}

interface TestResultData {
    id: number;
    test_type: string;
    configuration: {
        question_count: number;
        time_per_question: number;
        failure_threshold: number;
        auto_advance: boolean;
        shuffle_seed: number;
    };
    questions: TestQuestion[];
    current_question_index: number;
    answers_given: Record<string, AnswerGiven>;
    skipped_question_ids: number[];
    correct_count: number;
    wrong_count: number;
    total_questions: number;
    remaining_time_seconds: number;
    allowed_wrong: number;
    started_at: string;
}

interface Props {
    testResult: TestResultData;
    userSettings: {
        auto_advance: boolean;
    };
}

const formatTime = (seconds: number) => {
    const sign = seconds < 0 ? '-' : '';
    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    return `${sign}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function ActiveTest({ testResult, userSettings }: Props) {
    // Calculate initial position: find where user left off and go to the next unanswered question
    const getInitialIndex = () => {
        const answers = testResult.answers_given || {};
        const skipped = testResult.skipped_question_ids || [];
        const questions = testResult.questions;

        // Find the highest index that was answered or skipped (where user left off)
        let lastInteractedIndex = -1;
        for (let i = 0; i < questions.length; i++) {
            const questionId = questions[i].id;
            const isAnswered = !!answers[questionId];
            const isSkipped = skipped.includes(questionId);

            if (isAnswered || isSkipped) {
                lastInteractedIndex = i;
            }
        }

        // Start searching from the position after the last interacted question
        const startFrom = lastInteractedIndex + 1;

        // Find next unanswered/unskipped question from that point
        for (let i = startFrom; i < questions.length; i++) {
            const questionId = questions[i].id;
            const isAnswered = !!answers[questionId];
            const isSkipped = skipped.includes(questionId);

            if (!isAnswered && !isSkipped) {
                return i;
            }
        }

        // If no unanswered questions after last interaction, use saved position or last question
        // This handles the case where user might want to review skipped questions
        return Math.min(
            testResult.current_question_index,
            questions.length - 1,
        );
    };

    const [currentIndex, setCurrentIndex] = useState(getInitialIndex);
    const [answersGiven, setAnswersGiven] = useState<
        Record<string, AnswerGiven>
    >(testResult.answers_given || {});
    const [skippedIds, setSkippedIds] = useState<number[]>(
        testResult.skipped_question_ids || [],
    );
    const [correctCount, setCorrectCount] = useState(testResult.correct_count);
    const [wrongCount, setWrongCount] = useState(testResult.wrong_count);
    const [remainingTime, setRemainingTime] = useState(
        testResult.remaining_time_seconds,
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSignsDialog, setShowSignsDialog] = useState(false);
    const [showPauseDialog, setShowPauseDialog] = useState(false);
    const [showFailedDialog, setShowFailedDialog] = useState(false);
    const [showTimeUpDialog, setShowTimeUpDialog] = useState(false);
    const [showSkippedDialog, setShowSkippedDialog] = useState(false);
    const [hasFailed, setHasFailed] = useState(
        testResult.wrong_count > testResult.allowed_wrong,
    );
    const [hasTimeExpired, setHasTimeExpired] = useState(
        testResult.remaining_time_seconds <= 0,
    );
    const [bookmarkedQuestions, setBookmarkedQuestions] = useState<
        Record<number, boolean>
    >({});
    const [autoAdvance, setAutoAdvance] = useState(
        testResult.configuration.auto_advance ??
            userSettings.auto_advance ??
            true,
    );

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Reset state when testResult changes (e.g., resuming from pause or navigating)
    // We intentionally only depend on testResult.id to reset all state when the test changes
    useEffect(() => {
        setCurrentIndex(getInitialIndex());
        setAnswersGiven(testResult.answers_given || {});
        setSkippedIds(testResult.skipped_question_ids || []);
        setCorrectCount(testResult.correct_count);
        setWrongCount(testResult.wrong_count);
        setRemainingTime(testResult.remaining_time_seconds);
        setHasFailed(testResult.wrong_count > testResult.allowed_wrong);
        setHasTimeExpired(testResult.remaining_time_seconds <= 0);
        setAutoAdvance(
            testResult.configuration.auto_advance ??
                userSettings.auto_advance ??
                true,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [testResult.id]);
    const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isPausedRef = useRef(false);

    const questions = testResult.questions;
    const currentQuestion = questions[currentIndex];
    const currentAnswer = answersGiven[currentQuestion.id];
    const isAnswered = !!currentAnswer;
    const allowedWrong = testResult.allowed_wrong;

    // Build answer state for QuestionCard
    const answerState = useMemo(() => {
        if (!currentAnswer) return undefined;

        const correctAnswer = currentQuestion.answers.find((a) => a.is_correct);
        return {
            questionId: currentQuestion.id,
            selectedAnswerId: currentAnswer.answer_id,
            correctAnswerId: correctAnswer?.id || null,
            isCorrect: currentAnswer.is_correct,
            explanation: currentQuestion.description,
        };
    }, [currentAnswer, currentQuestion]);

    // Shuffle answers deterministically (same algorithm as QuestionCard)
    const shuffledAnswers = useMemo(() => {
        const shuffleSeed = testResult.configuration.shuffle_seed ?? 0.5;

        const seededRandom = (seed: number) => {
            const x = Math.sin(seed) * 10000;
            return x - Math.floor(x);
        };

        const shuffled = [...currentQuestion.answers];
        let seed = shuffleSeed * 1000 + currentQuestion.id;

        for (let i = shuffled.length - 1; i > 0; i--) {
            seed = seededRandom(seed) * 1000;
            const j = Math.floor(seededRandom(seed) * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }, [
        testResult.configuration.shuffle_seed,
        currentQuestion.id,
        currentQuestion.answers,
    ]);

    // Check for unanswered questions (including skipped)
    const unansweredIndices = useMemo(() => {
        return questions
            .map((q, i) => ({ id: q.id, index: i }))
            .filter((item) => !answersGiven[item.id])
            .map((item) => item.index);
    }, [questions, answersGiven]);

    const allAnswered = unansweredIndices.length === 0;

    // Timer effect
    useEffect(() => {
        timerRef.current = setInterval(() => {
            if (!isPausedRef.current) {
                setRemainingTime((prev) => {
                    const newTime = prev - 1;

                    // Show time up dialog when timer reaches 0 for the first time
                    if (newTime === 0 && !hasTimeExpired) {
                        setHasTimeExpired(true);
                        setShowTimeUpDialog(true);
                    }

                    return newTime;
                });
            }
        }, 1000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [hasTimeExpired]);

    // Auto-pause when navigating away
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                handlePause();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );
        };
    }, [currentIndex, remainingTime]);

    // Handle back button during test
    useEffect(() => {
        const handlePopState = (e: PopStateEvent) => {
            e.preventDefault();
            window.history.pushState(null, '', window.location.href);
            setShowPauseDialog(true);
        };

        window.history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    // Cleanup auto-advance timeout on unmount
    useEffect(() => {
        return () => {
            if (autoAdvanceRef.current) {
                clearTimeout(autoAdvanceRef.current);
            }
        };
    }, []);

    const handleAnswer = useCallback(
        async (answerId: number) => {
            if (isAnswered || isSubmitting) return;

            // Clear any pending auto-advance timeout
            if (autoAdvanceRef.current) {
                clearTimeout(autoAdvanceRef.current);
                autoAdvanceRef.current = null;
            }

            setIsSubmitting(true);

            try {
                const { data } = await axios.post(
                    `/test/${testResult.id}/answer`,
                    {
                        question_id: currentQuestion.id,
                        answer_id: answerId,
                        remaining_time: remainingTime,
                    },
                );

                setAnswersGiven((prev) => ({
                    ...prev,
                    [currentQuestion.id]: {
                        answer_id: answerId,
                        is_correct: data.is_correct,
                        answered_at: new Date().toISOString(),
                    },
                }));

                setCorrectCount(data.correct_count);
                setWrongCount(data.wrong_count);

                // Remove from skipped if it was there
                setSkippedIds((prev) =>
                    prev.filter((id) => id !== currentQuestion.id),
                );

                // Check if exceeded mistakes (show dialog only once)
                if (data.has_exceeded_mistakes && !hasFailed) {
                    setHasFailed(true);
                    setShowFailedDialog(true);
                }

                // Determine next question to navigate to
                const nextSequentialIndex = currentIndex + 1;
                const isNextSequentialAvailable =
                    nextSequentialIndex < questions.length &&
                    !answersGiven[questions[nextSequentialIndex].id];

                // Find first unanswered question (for when we need to jump to skipped questions)
                const firstUnansweredIndex = questions.findIndex(
                    (q, i) => i !== currentIndex && !answersGiven[q.id],
                );

                // Auto-advance logic
                if (autoAdvance) {
                    autoAdvanceRef.current = setTimeout(() => {
                        if (isNextSequentialAvailable) {
                            // Normal flow: go to next question in sequence
                            setCurrentIndex(nextSequentialIndex);
                        } else if (firstUnansweredIndex !== -1) {
                            // At end or next is answered: go to first unanswered (skipped questions)
                            setCurrentIndex(firstUnansweredIndex);
                        }
                    }, 200);
                } else if (!isNextSequentialAvailable && firstUnansweredIndex !== -1) {
                    // Manual mode: if at end or reviewing skipped, go to first unanswered
                    setCurrentIndex(firstUnansweredIndex);
                }
            } catch (error) {
                console.error('Failed to submit answer:', error);
            } finally {
                setIsSubmitting(false);
            }
        },
        [
            currentQuestion.id,
            testResult.id,
            remainingTime,
            isAnswered,
            isSubmitting,
            hasFailed,
            autoAdvance,
            currentIndex,
            questions,
            answersGiven,
        ],
    );

    const handleSkip = useCallback(async () => {
        if (isAnswered) return;

        // Clear any pending auto-advance timeout
        if (autoAdvanceRef.current) {
            clearTimeout(autoAdvanceRef.current);
            autoAdvanceRef.current = null;
        }

        try {
            await axios.post(`/test/${testResult.id}/skip`, {
                question_id: currentQuestion.id,
            });

            setSkippedIds((prev) => {
                if (prev.includes(currentQuestion.id)) return prev;
                return [...prev, currentQuestion.id];
            });

            // Advance directly (don't use goToNext since state hasn't updated yet)
            if (currentIndex < questions.length - 1) {
                setCurrentIndex((prev) => prev + 1);
            } else {
                // At end - show skipped dialog if there are unanswered questions
                setShowSkippedDialog(true);
            }
        } catch (error) {
            console.error('Failed to skip question:', error);
        }
    }, [
        currentQuestion.id,
        testResult.id,
        isAnswered,
        currentIndex,
        questions.length,
    ]);

    const handlePause = useCallback(async () => {
        isPausedRef.current = true;

        try {
            await axios.post(`/test/${testResult.id}/pause`, {
                current_question_index: currentIndex,
                remaining_time: remainingTime,
            });

            router.visit('/test');
        } catch (error) {
            console.error('Failed to pause test:', error);
            isPausedRef.current = false;
        }
    }, [testResult.id, currentIndex, remainingTime]);

    const handleComplete = useCallback(async () => {
        try {
            await axios.post(`/test/${testResult.id}/complete`, {
                remaining_time: remainingTime,
            });

            router.visit(`/test/${testResult.id}/results`);
        } catch (error) {
            console.error('Failed to complete test:', error);
        }
    }, [testResult.id, remainingTime]);

    const goToNext = useCallback(() => {
        // Can only go forward if current question is answered or skipped
        const currentQuestionId = questions[currentIndex].id;
        const isCurrentAnswered = !!answersGiven[currentQuestionId];
        const isCurrentSkipped = skippedIds.includes(currentQuestionId);

        if (!isCurrentAnswered && !isCurrentSkipped) {
            return; // Block navigation
        }

        const nextSequentialIndex = currentIndex + 1;
        const isNextAvailable =
            nextSequentialIndex < questions.length &&
            !answersGiven[questions[nextSequentialIndex].id];

        if (isNextAvailable) {
            // Normal flow: go to next sequential question
            setCurrentIndex(nextSequentialIndex);
        } else {
            // At end or next is answered: find first unanswered (skipped questions)
            const firstUnanswered = questions.findIndex(
                (q) => !answersGiven[q.id],
            );
            if (firstUnanswered !== -1) {
                setCurrentIndex(firstUnanswered);
            }
        }
    }, [currentIndex, questions, answersGiven, skippedIds]);

    const goToPrevious = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex((prev) => prev - 1);
        }
    }, [currentIndex]);

    const goToQuestion = useCallback((index: number) => {
        setCurrentIndex(index);
        setShowSkippedDialog(false);
    }, []);

    const handleInfoClick = useCallback(() => {
        setShowSignsDialog(true);
    }, []);

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

    return (
        <div className="fixed inset-0 flex flex-col bg-background">
            <Head title="ტესტი" />

            {/* Header - 2 rows */}
            <header
                className="flex flex-none flex-col border-b bg-background"
                style={{
                    paddingTop: 'var(--inset-top)',
                }}
            >
                {/* Row 1: Timer (left), Score (center), Question count (right) */}
                <div className="flex items-center justify-between px-4 py-2">
                    {/* Timer */}
                    <div
                        className={cn(
                            'min-w-[70px] font-mono text-xl font-bold',
                            remainingTime < 0 &&
                                'text-red-600 dark:text-red-400',
                            remainingTime < 60 &&
                                remainingTime >= 0 &&
                                'text-orange-600 dark:text-orange-400',
                        )}
                    >
                        {formatTime(remainingTime)}
                    </div>

                    {/* Score */}
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5 text-base font-medium text-green-600 dark:text-green-400">
                            <Check className="h-5 w-5" />
                            {correctCount}
                        </span>
                        <span className="flex items-center gap-1.5 text-base font-medium text-red-600 dark:text-red-400">
                            <X className="h-5 w-5" />
                            {wrongCount}/{allowedWrong}
                        </span>
                    </div>

                    {/* Question count */}
                    <div className="min-w-[70px] text-right text-xl font-bold">
                        {currentIndex + 1}/{testResult.total_questions}
                    </div>
                </div>

                {/* Row 2: Pause (left), Auto-advance toggle (center), Skip (right) */}
                <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-1.5">
                    {/* Pause Button */}
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowPauseDialog(true)}
                        className="h-8 w-8"
                    >
                        <Pause className="h-4 w-4" />
                    </Button>

                    {/* Auto-advance Toggle */}
                    <label
                        className={cn(
                            'flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 text-xs transition-colors',
                            autoAdvance
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        <SkipForward className="h-3.5 w-3.5" />
                        <Switch
                            checked={autoAdvance}
                            onCheckedChange={setAutoAdvance}
                            className="h-4 w-7 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
                        />
                    </label>

                    {/* Skip Button - disabled if already answered, submitting, or already skipped (no second skip) */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSkip}
                        disabled={isAnswered || isSubmitting || skippedIds.includes(currentQuestion.id)}
                        className="h-8 gap-1 px-2 text-xs"
                    >
                        <Redo2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </header>

            {/* Question Content - Scrollable */}
            <main
                id="main-scroll-container"
                className="min-h-0 flex-1 overflow-y-auto p-4"
            >
                <QuestionCard
                    question={currentQuestion}
                    questionNumber={currentIndex + 1}
                    shuffleSeed={testResult.configuration.shuffle_seed}
                    answerState={answerState}
                    isBookmarked={
                        bookmarkedQuestions[currentQuestion.id] || false
                    }
                    isSubmitting={isSubmitting}
                    onAnswer={() => {}}
                    onBookmark={handleBookmark}
                    onInfoClick={handleInfoClick}
                    testMode={true}
                />
            </main>

            {/* Bottom Navigation Bar */}
            <nav
                className="flex-none border-t bg-background"
                style={{
                    paddingBottom: 'var(--inset-bottom)',
                }}
            >
                <div className="flex h-14 items-center justify-between gap-1 px-2 sm:h-16 sm:gap-2 sm:px-4">
                    {/* Previous */}
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={goToPrevious}
                        disabled={currentIndex === 0}
                        className="h-10 w-10 shrink-0 sm:h-11 sm:w-11"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Button>

                    {/* Answer Buttons - Always show 4 buttons for consistent layout */}
                    <div className="flex min-w-0 shrink gap-1 sm:gap-1.5">
                        {[0, 1, 2, 3].map((index) => {
                            const answer = shuffledAnswers[index];
                            const hasAnswer = !!answer;
                            const isSelected =
                                hasAnswer &&
                                currentAnswer?.answer_id === answer.id;
                            const isCorrectAnswer =
                                hasAnswer && answer.is_correct;

                            return (
                                <button
                                    key={index}
                                    onClick={() =>
                                        hasAnswer && handleAnswer(answer.id)
                                    }
                                    disabled={
                                        !hasAnswer || isAnswered || isSubmitting
                                    }
                                    className={cn(
                                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-base font-bold transition-colors sm:h-11 sm:w-11 sm:text-lg',
                                        // No answer for this slot - show disabled placeholder
                                        !hasAnswer &&
                                            'cursor-not-allowed border-border bg-muted/30 text-muted-foreground/30',
                                        // Default state (not answered)
                                        hasAnswer &&
                                            !isAnswered &&
                                            'border-border bg-background hover:border-primary hover:bg-accent',
                                        // Answered - show correct answer in green
                                        hasAnswer &&
                                            isAnswered &&
                                            isCorrectAnswer &&
                                            'border-green-500 bg-green-500 text-white',
                                        // Answered - show selected wrong answer in red
                                        hasAnswer &&
                                            isAnswered &&
                                            isSelected &&
                                            !currentAnswer?.is_correct &&
                                            'border-red-500 bg-red-500 text-white',
                                        // Answered - dim other answers
                                        hasAnswer &&
                                            isAnswered &&
                                            !isCorrectAnswer &&
                                            !isSelected &&
                                            'border-border opacity-50',
                                        // Disabled state (answered or submitting)
                                        hasAnswer &&
                                            (isAnswered || isSubmitting) &&
                                            'cursor-not-allowed',
                                    )}
                                >
                                    {index + 1}
                                </button>
                            );
                        })}
                    </div>

                    {/* Next / Finish */}
                    {allAnswered ? (
                        <Button
                            size="sm"
                            onClick={handleComplete}
                            className="h-10 shrink-0 px-3 text-sm sm:h-11 sm:px-4 sm:text-base"
                        >
                            დასრულება
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={goToNext}
                            disabled={
                                currentIndex === questions.length - 1 ||
                                (!isAnswered &&
                                    !skippedIds.includes(currentQuestion.id))
                            }
                            className="h-10 w-10 shrink-0 sm:h-11 sm:w-11"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    )}
                </div>
            </nav>

            {/* Signs Dialog */}
            <SignsInfoDialog
                open={showSignsDialog}
                onOpenChange={setShowSignsDialog}
                description={currentQuestion.description}
                imageCustom={currentQuestion.image_custom}
                signs={currentQuestion.signs}
            />

            {/* Pause Confirmation Dialog */}
            <AlertDialog
                open={showPauseDialog}
                onOpenChange={setShowPauseDialog}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>ტესტის შეჩერება?</AlertDialogTitle>
                        <AlertDialogDescription>
                            თქვენი პროგრესი შეინახება და შეძლებთ მოგვიანებით
                            გაგრძელებას.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>გაგრძელება</AlertDialogCancel>
                        <AlertDialogAction onClick={handlePause}>
                            შეჩერება
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Failed Dialog */}
            <AlertDialog
                open={showFailedDialog}
                onOpenChange={setShowFailedDialog}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            შეცდომების ლიმიტი გადააჭარბეთ
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            თქვენ გადააჭარბეთ დასაშვებ შეცდომებს ({allowedWrong}
                            ). ტესტი ჩაითვლება ჩაჭრილად, მაგრამ შეგიძლიათ
                            ვარჯიშის მიზნით გააგრძელოთ.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleComplete}>
                            ტესტის დასრულება
                        </AlertDialogCancel>
                        <AlertDialogAction>
                            ვარჯიშის გაგრძელება
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Time Up Dialog */}
            <AlertDialog
                open={showTimeUpDialog}
                onOpenChange={setShowTimeUpDialog}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
                            <AlertTriangle className="h-5 w-5" />
                            დრო ამოიწურა!
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            ტესტის დრო ამოიწურა. ტესტი ჩაითვლება ჩაჭრილად,
                            მაგრამ შეგიძლიათ ვარჯიშის მიზნით გააგრძელოთ.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleComplete}>
                            ტესტის დასრულება
                        </AlertDialogCancel>
                        <AlertDialogAction>
                            ვარჯიშის გაგრძელება
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Skipped Questions Dialog */}
            <AlertDialog
                open={showSkippedDialog}
                onOpenChange={setShowSkippedDialog}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            გამოტოვებული კითხვები
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            თქვენ გაქვთ {unansweredIndices.length} უპასუხო
                            კითხვა. აირჩიეთ რომელზე გადახვიდეთ:
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                        {unansweredIndices.map((index) => (
                            <Button
                                key={index}
                                variant="outline"
                                size="sm"
                                onClick={() => goToQuestion(index)}
                            >
                                კითხვა {index + 1}
                            </Button>
                        ))}
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>დახურვა</AlertDialogCancel>
                        {allAnswered && (
                            <AlertDialogAction onClick={handleComplete}>
                                ტესტის დასრულება
                            </AlertDialogAction>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
