import type { Question } from '@/components/question-card';

// Shared types for test results
export interface AnswerGiven {
    answer_id: number;
    is_correct: boolean;
    answered_at: string;
}

export interface LicenseType {
    id: number;
    code: string;
    name: string;
}

export interface TestConfiguration {
    question_count: number;
    time_per_question: number;
    failure_threshold: number;
    allowed_wrong?: number;
    category_ids?: number[];
    shuffle_seed?: number;
}

/**
 * The official exam specification for a licence category, as published by
 * Georgia's Service Agency and resolved server-side by App\Support\ExamRules.
 *
 * `code` is null when the category has no published rules and the default
 * specification was applied.
 */
export interface ExamSpec {
    code: string | null;
    question_count: number;
    allowed_wrong: number;
    correct_to_pass: number;
    time_per_question: number;
    total_time_seconds: number;
    failure_threshold: number;
}

/**
 * Mistake allowance for a self-configured practice test.
 *
 * Only for the custom flow, where the percentage slider is the user's own input
 * and there is nothing to ask the server about before the test exists. It
 * mirrors the legacy branch of TestResult::getAllowedWrong() exactly, and is the
 * single place that formula is duplicated on the client.
 *
 * Official exams do not use this: their allowance comes from the server as
 * `allowed_wrong` and must never be recomputed here.
 */
export function deriveAllowedWrong(
    questionCount: number,
    failureThreshold: number,
): number {
    return Math.floor(questionCount * (failureThreshold / 100));
}

export interface TestResultData {
    id: number;
    test_type: string;
    status: 'in_progress' | 'paused' | 'passed' | 'failed';
    configuration: TestConfiguration;
    questions: Question[];
    answers_given: Record<string, AnswerGiven>;
    correct_count: number;
    wrong_count: number;
    total_questions: number;
    score_percentage: number;
    time_taken_seconds: number;
    allowed_wrong: number;
    started_at: string;
    finished_at: string | null;
    license_type_id: number | null;
    license_type?: LicenseType | null;
}

export interface AnswerState {
    questionId: number;
    selectedAnswerId: number | null;
    correctAnswerId: number | null;
    isCorrect: boolean | null;
    explanation: string | null;
}

// Utility functions
export function formatTime(seconds: number): string {
    const sign = seconds < 0 ? '-' : '';
    const absSeconds = Math.abs(seconds);
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    return `${sign}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('ka-GE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('ka-GE', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

const TEST_TYPE_NAMES: Record<string, string> = {
    thematic: 'თემატური',
    bookmarked: 'შენახული',
    quick: 'სწრაფი',
    custom: 'მორგებული',
};

export function getTestTypeName(type: string): string {
    return TEST_TYPE_NAMES[type] || type;
}

// Build answer states for questions
export function buildAnswerStates(
    questions: Question[],
    answersGiven: Record<string, AnswerGiven>,
): Record<number, AnswerState> {
    const states: Record<number, AnswerState> = {};

    questions.forEach((question) => {
        const answer = answersGiven[question.id];
        const correctAnswer = question.answers.find((a) => a.is_correct);

        states[question.id] = {
            questionId: question.id,
            selectedAnswerId: answer?.answer_id ?? null,
            correctAnswerId: correctAnswer?.id ?? null,
            isCorrect: answer?.is_correct ?? null,
            explanation: question.description,
        };
    });

    return states;
}

// Filter questions by answer correctness
export function getWrongAnswers(
    questions: Question[],
    answersGiven: Record<string, AnswerGiven>,
): Question[] {
    return questions.filter((q) => {
        const answer = answersGiven[q.id];
        return answer && !answer.is_correct;
    });
}

export function getCorrectAnswers(
    questions: Question[],
    answersGiven: Record<string, AnswerGiven>,
): Question[] {
    return questions.filter((q) => {
        const answer = answersGiven[q.id];
        return answer && answer.is_correct;
    });
}

export function getUnansweredQuestions(
    questions: Question[],
    answersGiven: Record<string, AnswerGiven>,
): Question[] {
    return questions.filter((q) => !answersGiven[q.id]);
}
