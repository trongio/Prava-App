import {
    Bookmark,
    BookmarkCheck,
    Check,
    Info,
    TriangleAlert,
    X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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

interface AnswerState {
    questionId: number;
    selectedAnswerId: number | null;
    correctAnswerId: number | null;
    isCorrect: boolean | null;
    explanation: string | null;
}

interface QuestionCardProps {
    question: Question;
    questionNumber: number;
    shuffledAnswers: Answer[];
    answerState?: AnswerState;
    isBookmarked: boolean;
    onAnswer: (question: Question, answerId: number) => void;
    onBookmark: (questionId: number) => void;
    onInfoClick: (question: Question) => void;
}

export function QuestionCard({
    question,
    questionNumber,
    shuffledAnswers,
    answerState,
    isBookmarked,
    onAnswer,
    onBookmark,
    onInfoClick,
}: QuestionCardProps) {
    const getAnswerClassName = (answer: Answer) => {
        if (!answerState)
            return 'border-border hover:border-primary hover:bg-accent';

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
        <Card className={`py-0 ${!question.is_active ? 'opacity-60' : ''}`}>
            <CardContent className="p-4">
                {/* Question Header */}
                <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <span className="rounded bg-muted px-2 py-1 text-xs font-medium">
                            #{questionNumber}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            {!question.is_active && (
                                <TriangleAlert className="h-3.5 w-3.5 text-red-500" />
                            )}
                            ID: {question.id}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onBookmark(question.id)}
                        >
                            {isBookmarked ? (
                                <BookmarkCheck className="h-5 w-5 text-yellow-500" />
                            ) : (
                                <Bookmark className="h-5 w-5" />
                            )}
                        </Button>
                        {(question.signs.length > 0 ||
                            question.description ||
                            question.image_custom) && (
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
                    <div className="relative mb-4 overflow-hidden rounded-lg">
                        <img
                            src={`/images/ticket_images/${question.image}`}
                            alt="კითხვის სურათი"
                            className="w-full scale-[1.008] object-contain"
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
                <div className="space-y-2">
                    {shuffledAnswers.map((answer, answerIndex) => (
                        <button
                            key={answer.id}
                            onClick={() => onAnswer(question, answer.id)}
                            disabled={!!answerState?.selectedAnswerId}
                            className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${getAnswerClassName(answer)}`}
                        >
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs">
                                {answerIndex + 1}
                            </span>
                            <span className="text-sm">{answer.text}</span>
                            {answerState?.correctAnswerId === answer.id && (
                                <Check className="ml-auto h-5 w-5 shrink-0 text-green-600" />
                            )}
                            {answerState?.selectedAnswerId === answer.id &&
                                !answerState.isCorrect && (
                                    <X className="ml-auto h-5 w-5 shrink-0 text-red-600" />
                                )}
                        </button>
                    ))}
                </div>

                {/* Explanation */}
                {answerState?.explanation && (
                    <div className="mt-4 rounded-lg bg-muted p-3">
                        <p className="text-sm text-muted-foreground">
                            {answerState.explanation}
                        </p>
                    </div>
                )}

                {/* Category Tag */}
                <div className="mt-4">
                    <span className="text-xs text-muted-foreground">
                        {question.question_category.name}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}
