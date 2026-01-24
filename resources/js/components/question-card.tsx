import { Bookmark, Check, Info, TriangleAlert, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Answer, AnswerState, Question } from '@/types/models';

// Re-export Question for backward compatibility with existing imports
export type { Question } from '@/types/models';

interface QuestionCardProps {
    question: Question;
    questionNumber: number;
    shuffleSeed: number;
    answerState?: AnswerState;
    isBookmarked: boolean;
    isSubmitting?: boolean;
    onAnswer: (question: Question, answerId: number) => void;
    onBookmark: (questionId: number) => void;
    onInfoClick: (question: Question) => void;
    /** Test mode: answers are disabled, info button hidden until answered */
    testMode?: boolean;
}

export function QuestionCard({
    question,
    questionNumber,
    shuffleSeed = 0.5,
    answerState,
    isBookmarked,
    isSubmitting = false,
    onAnswer,
    onBookmark,
    onInfoClick,
    testMode = false,
}: QuestionCardProps) {
    const [imageLoaded, setImageLoaded] = useState(false);

    const isAnswered = !!answerState?.selectedAnswerId;
    const hasInfoContent =
        question.signs.length > 0 ||
        question.description ||
        question.image_custom;
    // In testMode, show info button only after answered
    const showInfoButton = hasInfoContent && (!testMode || isAnswered);

    // Shuffle answers deterministically based on seed + question.id
    const displayAnswers = useMemo(() => {
        const seededRandom = (seed: number) => {
            const x = Math.sin(seed) * 10000;
            return x - Math.floor(x);
        };

        const shuffled = [...question.answers];
        let seed = shuffleSeed * 1000 + question.id;

        for (let i = shuffled.length - 1; i > 0; i--) {
            seed = seededRandom(seed) * 1000;
            const j = Math.floor(seededRandom(seed) * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }, [shuffleSeed, question.id, question.answers]);

    const getAnswerClassName = (answer: Answer) => {
        if (!answerState)
            return 'border-border hover:border-primary hover:bg-accent disabled:hover:border-border disabled:hover:bg-transparent';

        if (answer.id === answerState.correctAnswerId) {
            return 'border-green-500 bg-green-50 dark:bg-green-950';
        }
        if (
            answer.id === answerState.selectedAnswerId &&
            !answerState.isCorrect
        ) {
            return 'border-red-500 bg-red-50 dark:bg-red-950';
        }
        return 'border-border opacity-50';
    };

    return (
        <Card
            className={cn('py-0', question.is_active === false && 'opacity-60')}
        >
            <CardContent className="p-4">
                {/* Question Header */}
                <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <span className="rounded bg-muted px-2 py-1 text-xs font-medium">
                            #{questionNumber}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            ID: {question.id}
                            {question.is_active === false && (
                                <TriangleAlert className="h-3.5 w-3.5 text-red-500" />
                            )}
                            <span className="text-xs text-muted-foreground">
                                {question.question_category.name}
                            </span>
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onBookmark(question.id)}
                        >
                            <Bookmark
                                className={`h-5 w-5 ${
                                    isBookmarked
                                        ? 'fill-yellow-500 text-yellow-500'
                                        : ''
                                }`}
                            />
                        </Button>
                        {showInfoButton && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => onInfoClick(question)}
                            >
                                <Info className="h-5 w-5" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Question Image */}
                {question.image && (
                    <div className="relative mb-4 overflow-hidden rounded-lg bg-muted">
                        {!imageLoaded && (
                            <div className="aspect-[16/10] w-full animate-pulse bg-muted" />
                        )}
                        <img
                            src={`/images/ticket_images_webp/${question.image}`}
                            alt="კითხვის სურათი"
                            loading="lazy"
                            decoding="async"
                            onLoad={() => setImageLoaded(true)}
                            className={cn(
                                'w-full scale-[1.008] object-contain transition-opacity duration-300',
                                imageLoaded ? 'opacity-100' : 'opacity-0',
                            )}
                        />
                    </div>
                )}

                {/* Question Text - uses negative margin to overlap image when not short_image */}
                {question.image && !question.is_short_image ? (
                    <div className="relative z-1 mx-0 -mt-[12%] mb-4 rounded bg-[#141414]/65 px-4 py-3">
                        <p className="text-center text-sm leading-snug font-medium text-white">
                            {question.question}
                        </p>
                    </div>
                ) : (
                    <p className="mb-4 text-base leading-relaxed font-medium">
                        {question.question}
                    </p>
                )}

                {/* Answer Options */}
                <div
                    className={cn(
                        'space-y-2',
                        isSubmitting && 'pointer-events-none opacity-70',
                    )}
                >
                    {displayAnswers.map((answer, answerIndex) => (
                        <button
                            key={answer.id}
                            onClick={() => onAnswer(question, answer.id)}
                            disabled={isAnswered || isSubmitting || testMode}
                            className={cn(
                                'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                                getAnswerClassName(answer),
                            )}
                        >
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs">
                                {answerIndex + 1}
                            </span>
                            <span className="text-sm">{answer.text}</span>
                            {answerState?.correctAnswerId === answer.id && (
                                <Check className="ml-auto h-5 w-5 shrink-0 text-green-600" />
                            )}
                            {answerState?.selectedAnswerId === answer.id &&
                                !answerState?.isCorrect && (
                                    <X className="ml-auto h-5 w-5 shrink-0 text-red-600" />
                                )}
                        </button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
