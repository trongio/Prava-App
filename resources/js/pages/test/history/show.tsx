import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Check, Copy, HelpCircle, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';

import { QuestionList } from '@/components/question-list';
import { TestResultBanner } from '@/components/test-result-banner';
import { TestResultStats } from '@/components/test-result-stats';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    buildAnswerStates,
    formatDate,
    getCorrectAnswers,
    getUnansweredQuestions,
    getWrongAnswers,
    type TestResultData,
} from '@/lib/test-utils';

interface Props {
    testResult: TestResultData;
}

export default function HistoryShow({ testResult }: Props) {
    const isPassed = testResult.status === 'passed';

    // Filter questions by answer type
    const wrongAnswers = useMemo(
        () => getWrongAnswers(testResult.questions, testResult.answers_given),
        [testResult.questions, testResult.answers_given],
    );

    const correctAnswers = useMemo(
        () => getCorrectAnswers(testResult.questions, testResult.answers_given),
        [testResult.questions, testResult.answers_given],
    );

    const unansweredQuestions = useMemo(
        () =>
            getUnansweredQuestions(
                testResult.questions,
                testResult.answers_given,
            ),
        [testResult.questions, testResult.answers_given],
    );

    // Build answer states for all questions
    const answerStates = useMemo(
        () => buildAnswerStates(testResult.questions, testResult.answers_given),
        [testResult.questions, testResult.answers_given],
    );

    const handleRedoSame = useCallback(() => {
        router.post(`/test/${testResult.id}/redo-same`);
    }, [testResult.id]);

    const handleNewSimilar = useCallback(() => {
        router.post(`/test/${testResult.id}/new-similar`);
    }, [testResult.id]);

    // Handle Android back button
    useEffect(() => {
        const handlePopState = () => {
            router.visit('/test/history');
        };

        window.history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    // Determine default tab based on available content
    const defaultTab =
        wrongAnswers.length > 0
            ? 'wrong'
            : unansweredQuestions.length > 0
              ? 'unanswered'
              : 'correct';

    const shuffleSeed = testResult.configuration.shuffle_seed ?? 0;

    return (
        <div
            id="main-scroll-container"
            className="h-screen overflow-y-auto bg-background"
        >
            <Head title="ტესტის დეტალები" />

            {/* Header */}
            <div
                className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur"
                style={{ paddingTop: 'calc(var(--inset-top) + 0.75rem)' }}
            >
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/test/history">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div className="flex-1">
                    <h1 className="font-semibold">ტესტის დეტალები</h1>
                    <p className="text-xs text-muted-foreground">
                        {formatDate(
                            testResult.finished_at || testResult.started_at,
                        )}
                    </p>
                </div>
            </div>

            {/* Result Banner */}
            <TestResultBanner
                isPassed={isPassed}
                correctCount={testResult.correct_count}
                totalQuestions={testResult.total_questions}
                answeredCount={
                    testResult.correct_count + testResult.wrong_count
                }
                scorePercentage={testResult.score_percentage ?? 0}
                timeTakenSeconds={testResult.time_taken_seconds ?? 0}
                testType={testResult.test_type}
                licenseType={testResult.license_type}
            />

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 p-4">
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleRedoSame}
                >
                    <RefreshCw className="h-4 w-4" />
                    იგივე ტესტი
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleNewSimilar}
                >
                    <Copy className="h-4 w-4" />
                    მსგავსი ტესტი
                </Button>
            </div>

            {/* Stats Summary */}
            <div className="px-4 pb-4">
                <TestResultStats
                    correctCount={testResult.correct_count}
                    wrongCount={testResult.wrong_count}
                    unansweredCount={unansweredQuestions.length}
                />
            </div>

            {/* Tabs for Questions */}
            <div className="p-4 pt-0">
                <Tabs defaultValue={defaultTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger
                            value="wrong"
                            className="gap-1 text-xs data-[state=active]:text-red-600 dark:data-[state=active]:text-red-400"
                        >
                            <X className="h-3 w-3" />
                            არასწორი ({wrongAnswers.length})
                        </TabsTrigger>
                        <TabsTrigger
                            value="correct"
                            className="gap-1 text-xs data-[state=active]:text-green-600 dark:data-[state=active]:text-green-400"
                        >
                            <Check className="h-3 w-3" />
                            სწორი ({correctAnswers.length})
                        </TabsTrigger>
                        <TabsTrigger
                            value="unanswered"
                            className="gap-1 text-xs data-[state=active]:text-yellow-600 dark:data-[state=active]:text-yellow-400"
                        >
                            <HelpCircle className="h-3 w-3" />
                            უპასუხო ({unansweredQuestions.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="wrong" className="mt-4">
                        <QuestionList
                            questions={wrongAnswers}
                            answerStates={answerStates}
                            shuffleSeed={shuffleSeed}
                            emptyMessage="არასწორი პასუხები არ არის"
                        />
                    </TabsContent>

                    <TabsContent value="correct" className="mt-4">
                        <QuestionList
                            questions={correctAnswers}
                            answerStates={answerStates}
                            shuffleSeed={shuffleSeed}
                            emptyMessage="სწორი პასუხები არ არის"
                        />
                    </TabsContent>

                    <TabsContent value="unanswered" className="mt-4">
                        <QuestionList
                            questions={unansweredQuestions}
                            answerStates={answerStates}
                            shuffleSeed={shuffleSeed}
                            emptyMessage="უპასუხო კითხვები არ არის"
                        />
                    </TabsContent>
                </Tabs>
            </div>

            {/* Safe area bottom padding */}
            <div style={{ height: 'var(--inset-bottom)' }} />
        </div>
    );
}
