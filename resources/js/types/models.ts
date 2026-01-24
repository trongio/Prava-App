/**
 * Centralized type definitions for the driving test application.
 * These types mirror backend Eloquent models and API responses.
 */

// =============================================================================
// Core Domain Types
// =============================================================================

export interface LicenseType {
    id: number;
    code: string;
    name: string;
    is_parent?: boolean;
    children?: LicenseType[];
}

export interface QuestionCategory {
    id: number;
    name: string;
    questions_count?: number;
}

export interface Sign {
    id: number;
    image: string;
    title: string;
    description: string | null;
}

export interface Answer {
    id: number;
    text: string;
    is_correct: boolean;
    position: number;
}

export interface Question {
    id: number;
    question: string;
    description: string | null;
    full_description: string | null;
    image: string | null;
    image_custom: string | null;
    is_short_image: boolean;
    is_active?: boolean;
    answers: Answer[];
    question_category: QuestionCategory;
    signs: Sign[];
}

// =============================================================================
// Test Types
// =============================================================================

export type TestType = 'thematic' | 'bookmarked' | 'quick';

export type TestStatus =
    | 'in_progress'
    | 'paused'
    | 'completed'
    | 'passed'
    | 'failed'
    | 'abandoned';

export interface TestConfiguration {
    question_count: number;
    time_per_question: number;
    failure_threshold: number;
    auto_advance: boolean;
    shuffle_seed: number;
}

export interface AnswerGiven {
    answer_id: number;
    is_correct: boolean;
    answered_at: string;
}

export interface ActiveTest {
    id: number;
    test_type: TestType;
    status: TestStatus;
    total_questions: number;
    answered_count: number;
    correct_count: number;
    wrong_count: number;
    remaining_time_seconds: number;
    started_at?: string;
    license_type: LicenseType | null;
}

export interface TestResult {
    id: number;
    test_type: TestType;
    status: TestStatus;
    configuration: TestConfiguration;
    questions: Question[];
    current_question_index: number;
    answers_given: Record<string, AnswerGiven>;
    skipped_question_ids: number[];
    correct_count: number;
    wrong_count: number;
    total_questions: number;
    remaining_time_seconds: number;
    allowed_wrong: number;
    started_at: string;
    finished_at?: string;
    score_percentage?: number;
    license_type?: LicenseType | null;
}

export interface TestTemplate {
    id: number;
    name: string;
    license_type_id: number | null;
    question_count: number;
    time_per_question: number;
    failure_threshold: number;
    category_ids: number[];
    license_type: LicenseType | null;
}

// =============================================================================
// User & Progress Types
// =============================================================================

export interface UserProgress {
    question_id: number;
    times_correct: number;
    times_wrong: number;
    is_bookmarked: boolean;
}

export interface LicensePerformance {
    license_type: LicenseType;
    total_tests: number;
    passed: number;
    failed: number;
    pass_rate: number;
    avg_score: number;
    pass_chance: number;
    trend: 'improving' | 'declining' | 'stable';
}

export interface PassChance {
    percentage: number;
    total_questions: number;
    studied_questions: number;
    mastered_questions: number;
}

// =============================================================================
// Answer State (for question answering UI)
// =============================================================================

export interface AnswerState {
    questionId: number;
    selectedAnswerId: number | null;
    correctAnswerId: number | null;
    isCorrect: boolean | null;
    explanation: string | null;
}

// =============================================================================
// Filter Types
// =============================================================================

export interface QuestionFilters {
    license_type: number | null;
    categories: number[];
    show_inactive: boolean;
    bookmarked: boolean;
    wrong_only: boolean;
    correct_only: boolean;
    unanswered: boolean;
    per_page: number;
    sign_id: number | null;
}

export interface FilterSign {
    id: number;
    title: string;
    image: string;
}

// =============================================================================
// Pagination Types
// =============================================================================

export interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

export interface PaginatedResponse<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: PaginationLink[];
}

// =============================================================================
// Statistics Types
// =============================================================================

export interface UserStats {
    total_tests: number;
    passed: number;
    failed: number;
    pass_rate: number;
    total_correct: number;
    total_wrong: number;
}

export interface ProgressStats {
    studied: number;
    total: number;
    percentage: number;
}

export interface QuestionStats {
    total: number;
    answered: number;
    filtered: number;
}

// =============================================================================
// Recent Test (for dashboard)
// =============================================================================

export interface RecentTest {
    id: number;
    status: TestStatus;
    score_percentage: number;
    finished_at: string;
    license_type_id: number | null;
}
