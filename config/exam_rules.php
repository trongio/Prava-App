<?php

/*
|--------------------------------------------------------------------------
| Official Theory Exam Rules
|--------------------------------------------------------------------------
|
| Pass/fail rules for the Georgian theory exam, per licence category, as
| published by the Service Agency of the Ministry of Internal Affairs
| (sa.gov.ge). Each entry describes one official exam paper:
|
|   question_count    Number of questions on the paper.
|   allowed_wrong     Mistakes a candidate may make and still pass.
|   time_per_question Seconds of exam time granted per question.
|
| The number of correct answers required to pass is question_count minus
| allowed_wrong and is derived by App\Support\ExamRules, so it never drifts
| out of sync with the two values stored here.
|
| Note on `time_per_question`: the agency only publishes a duration for the
| 30-question paper (30 minutes total, i.e. 60 seconds per question). No
| duration is published for the 20, 35 and 40-question papers, so 60 seconds
| per question is carried over as a derived default. That is our assumption,
| not published policy; correct these values if the agency publishes real ones.
|
| Categories absent from the official table (Tram, Mil) intentionally fall
| through to the `default` entry below.
|
*/

return [

    /*
    |--------------------------------------------------------------------------
    | Default Rules
    |--------------------------------------------------------------------------
    |
    | Used for licence codes that have no entry below, and whenever a test is
    | started without a licence category. Mirrors the strictest common paper
    | (30 questions, 27 correct to pass).
    |
    */

    'default' => [
        'question_count' => 30,
        'allowed_wrong' => 3,
        'time_per_question' => 60,
    ],

    /*
    |--------------------------------------------------------------------------
    | Per-Category Rules
    |--------------------------------------------------------------------------
    |
    | Keys match the `code` column of the `license_types` table. Lookups are
    | case-insensitive.
    |
    */

    'codes' => [

        /**
         * Cars and light vehicles. Relaxed from 27 to 25 correct answers
         * effective 21 May 2026.
         */
        'B' => ['question_count' => 30, 'allowed_wrong' => 5, 'time_per_question' => 60],
        'B1' => ['question_count' => 30, 'allowed_wrong' => 5, 'time_per_question' => 60],

        /**
         * Motorcycles.
         */
        'A' => ['question_count' => 30, 'allowed_wrong' => 3, 'time_per_question' => 60],
        'A1' => ['question_count' => 30, 'allowed_wrong' => 3, 'time_per_question' => 60],
        'A2' => ['question_count' => 30, 'allowed_wrong' => 3, 'time_per_question' => 60],

        /**
         * Mopeds and light quadricycles.
         */
        'AM' => ['question_count' => 20, 'allowed_wrong' => 2, 'time_per_question' => 60],

        /**
         * Trucks.
         */
        'C' => ['question_count' => 40, 'allowed_wrong' => 4, 'time_per_question' => 60],
        'C1' => ['question_count' => 35, 'allowed_wrong' => 3, 'time_per_question' => 60],

        /**
         * Buses.
         */
        'D' => ['question_count' => 40, 'allowed_wrong' => 4, 'time_per_question' => 60],
        'D1' => ['question_count' => 35, 'allowed_wrong' => 3, 'time_per_question' => 60],

        /**
         * Agricultural and special machinery.
         */
        'T' => ['question_count' => 30, 'allowed_wrong' => 3, 'time_per_question' => 60],
        'S' => ['question_count' => 30, 'allowed_wrong' => 3, 'time_per_question' => 60],

    ],

];
