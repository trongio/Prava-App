<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Question Bank Content Pack
    |--------------------------------------------------------------------------
    |
    | File name of the SQLite content pack shipped with this release, resolved
    | against the bundled asset locations. A pack carries reference data only
    | (questions, answers, signs and their categories) and is merged into the
    | live database so existing installs receive content updates without losing
    | progress, bookmarks, notes or test history.
    |
    | Leave empty to ship no content update. Set this to a new file name to
    | release a new bank, and add a migration that applies it.
    |
    */

    'file' => env('CONTENT_PACK_FILE', 'question-bank-2026-08.sqlite'),

];
