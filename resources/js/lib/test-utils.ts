import type {
    AnswerGiven,
    AnswerState,
    LicenseType,
    Question,
    TestConfiguration,
    TestResult,
} from '@/types/models';

// Re-export for backward compatibility
export type { AnswerGiven, AnswerState, LicenseType, TestConfiguration };

/**
 * TestResultData is an alias for TestResult with additional fields
 * that may be present in specific contexts (e.g., results page).
 */
export interface TestResultData extends Omit<TestResult, 'current_question_index' | 'skipped_question_ids'> {
    time_taken_seconds?: number;
    license_type_id?: number | null;
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
