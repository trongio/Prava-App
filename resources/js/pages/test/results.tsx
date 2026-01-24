import { Head, router } from '@inertiajs/react';
import {
    Check,
    Copy,
    Home,
    MinusCircle,
    RefreshCw,
    Save,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { QuestionList } from '@/components/question-list';
import { TestResultBanner } from '@/components/test-result-banner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    buildAnswerStates,
    getCorrectAnswers,
    getUnansweredQuestions,
    getWrongAnswers,
    type TestResultData,
} from '@/lib/test-utils';

interface Props {
    testResult: TestResultData;
}

export default function TestResults({ testResult }: Props) {
    const [showTemplateDialog, setShowTemplateDialog] = useState(false);
    const [templateName, setTemplateName] = useState('');

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

    const skippedQuestions = useMemo(
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

    const handleSaveTemplate = useCallback(async () => {
        if (!templateName.trim()) return;

        const payload = {
            name: templateName,
            license_type_id: testResult.license_type_id,
            question_count: testResult.configuration.question_count,
            time_per_question: testResult.configuration.time_per_question,
            failure_threshold: testResult.configuration.failure_threshold,
            category_ids: [],
        };

        await fetch('/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        setShowTemplateDialog(false);
        setTemplateName('');
    }, [templateName, testResult]);

    const handleGoHome = useCallback(() => {
        router.visit('/test');
    }, []);

    // Handle Android back button
    useEffect(() => {
        const handlePopState = () => {
            router.visit('/test');
        };

        window.history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    const shuffleSeed = testResult.configuration.shuffle_seed ?? 0;
    const answeredCount = testResult.correct_count + testResult.wrong_count;

    return (
        <div
            id="main-scroll-container"
            className="h-screen overflow-y-auto bg-background"
        >
            <Head title="შედეგები" />

            {/* Result Banner */}
            <TestResultBanner
                isPassed={isPassed}
                correctCount={testResult.correct_count}
                totalQuestions={testResult.total_questions}
                answeredCount={answeredCount}
                scorePercentage={testResult.score_percentage ?? 0}
                timeTakenSeconds={testResult.time_taken_seconds ?? 0}
                testType={testResult.test_type}
                licenseType={testResult.license_type}
                withTopPadding
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
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setShowTemplateDialog(true)}
                >
                    <Save className="h-4 w-4" />
                    შაბლონად
                </Button>
                <Button size="sm" className="gap-2" onClick={handleGoHome}>
                    <Home className="h-4 w-4" />
                    მთავარი
                </Button>
            </div>

            {/* Tabs for Questions */}
            <div className="p-4 pt-0">
                <Tabs defaultValue="wrong" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger
                            value="wrong"
                            className="gap-1 px-2 text-xs data-[state=active]:text-red-600 sm:gap-2 sm:px-3 sm:text-sm dark:data-[state=active]:text-red-400"
                        >
                            <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">არასწორი</span> (
                            {wrongAnswers.length})
                        </TabsTrigger>
                        <TabsTrigger
                            value="correct"
                            className="gap-1 px-2 text-xs data-[state=active]:text-green-600 sm:gap-2 sm:px-3 sm:text-sm dark:data-[state=active]:text-green-400"
                        >
                            <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">სწორი</span> (
                            {correctAnswers.length})
                        </TabsTrigger>
                        <TabsTrigger
                            value="skipped"
                            className="gap-1 px-2 text-xs data-[state=active]:text-amber-600 sm:gap-2 sm:px-3 sm:text-sm dark:data-[state=active]:text-amber-400"
                        >
                            <MinusCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">
                                გამოტოვებული
                            </span>{' '}
                            ({skippedQuestions.length})
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

                    <TabsContent value="skipped" className="mt-4">
                        <QuestionList
                            questions={skippedQuestions}
                            answerStates={answerStates}
                            shuffleSeed={shuffleSeed}
                            emptyMessage="გამოტოვებული კითხვები არ არის"
                        />
                    </TabsContent>
                </Tabs>
            </div>

            {/* Safe area bottom padding */}
            <div style={{ height: 'var(--inset-bottom)' }} />

            {/* Template Save Dialog */}
            <Dialog
                open={showTemplateDialog}
                onOpenChange={setShowTemplateDialog}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>შაბლონის შენახვა</DialogTitle>
                        <DialogDescription>
                            შეინახეთ ამ ტესტის პარამეტრები შაბლონად
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="templateName">სახელი</Label>
                            <Input
                                id="templateName"
                                value={templateName}
                                onChange={(e) =>
                                    setTemplateName(e.target.value)
                                }
                                placeholder="მაგ: B კატეგორია - სრული"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowTemplateDialog(false)}
                        >
                            გაუქმება
                        </Button>
                        <Button
                            onClick={handleSaveTemplate}
                            disabled={!templateName.trim()}
                        >
                            შენახვა
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
