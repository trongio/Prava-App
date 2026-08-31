<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Store listing URL
    |--------------------------------------------------------------------------
    |
    | Opened with the native Browser bridge when the user taps "rate". The
    | market:// scheme hands off directly to the Play Store app; Android falls
    | back to the browser on devices without it.
    |
    */

    'store_url' => env('REVIEW_PROMPT_STORE_URL', 'market://details?id=com.prava.trongio'),

    /*
    |--------------------------------------------------------------------------
    | Public listing URL
    |--------------------------------------------------------------------------
    |
    | The same listing as an ordinary link. The market:// scheme above only
    | resolves on a device with the Play Store installed, so anything a desktop
    | browser has to open - the web landing page, the README - uses this.
    |
    */

    'store_web_url' => env('STORE_WEB_URL', 'https://play.google.com/store/apps/details?id=com.prava.trongio'),

    /*
    |--------------------------------------------------------------------------
    | Trigger thresholds
    |--------------------------------------------------------------------------
    |
    | The prompt only ever appears after a test the user has *passed*, and only
    | once they have passed at least `min_tests_passed` of them, so it never
    | greets someone who has barely used the app.
    |
    | `cooldown_days` covers the user who neither dismisses nor rates: they just
    | navigate away. `max_prompts` is the hard lifetime ceiling for that case,
    | so the prompt cannot nag forever on its own. Dismissing is permanent and
    | ignores both.
    |
    */

    'min_tests_passed' => 3,

    'cooldown_days' => 60,

    'max_prompts' => 3,

];
