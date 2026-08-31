---
paths:
  - 'nativephp/android/**'
---

# Android

## Play debug symbols: never set jniLibs.keepDebugSymbols in the release bundle
nativephp/android is gitignored and `php artisan native:install --force` re-copies it from vendor/nativephp/mobile/resources/androidstudio, which ships `packaging { jniLibs { keepDebugSymbols.add("**/*.so") } }`. That line silently defeats native debug symbols: AGP's ExtractNativeDebugMetadataWorkAction skips a library whenever its merged_native_libs and stripped_native_libs copies are the same size, so keeping symbols makes strip a no-op, extraction emits zero files, and the AAB ships with no BUNDLE-METADATA/com.android.tools.build.debugsymbols/ entry. Play then warns "you've not uploaded debug symbols" even though debugSymbolLevel is FULL.

After any `native:install --force`, run `python3 scripts/patch-nativephp-android.py`, which strips that line again (along with the other local patches) before you build a release. Stripping is safe: it preserves 16 KB LOAD alignment (p_align 0x4000) and cuts ~659 KB from the on-device payload.

Keep debugSymbolLevel = "FULL" (config nativephp.android.build.debug_symbols). Only libc++_shared.so, libphp_wrapper.so and libcompat.so carry symbols; libphp.so is stripped upstream. FULL costs 686 KB vs SYMBOL_TABLE's 1.8 MB here, and BUNDLE-METADATA never reaches user downloads.

R8 is off (minify_enabled = false), so there is no mapping.txt and Play's "no deobfuscation file" warning is informational only. Do not enable R8 to silence it; NativePHP resolves classes reflectively.

## Run scripts/patch-nativephp-android.py after every native:install --force
`native:install --force` regenerates nativephp/android from vendor and silently discards local fixes. The directory is gitignored, so nothing warns you. Run `python3 scripts/patch-nativephp-android.py` after every install and before any release build; it is idempotent and reports what it changed.

It applies these, in this order:
1. NativeActionCoordinator.install(): commitNow() -> commitNowAllowingStateLoss(). install() runs from a Handler.post callback after bundle extraction, by which point the Activity may have saved state. This was the app's single largest crash (52 reports / 33 users, ~34% of users, versionCodes 8 and 9): IllegalStateException "Can not perform this action after onSaveInstanceState". onDestroy() in the same file already used commitNowAllowingStateLoss, so this was an upstream oversight. Reproduced on device as `finishing=false destroyed=false stateSaved=true` and confirmed fixed 2026-08-26.
2. MainActivity.initializeEnvironmentAsync(): skip onReady() when isFinishing || isDestroyed. Covers the rarer "FragmentManager has been destroyed" variant; onReady also builds the WebView and loads a URL, none of it valid on a dead Activity.
3. MainActivity.configureStatusBar(): drops the deprecated `window.statusBarColor` / `window.navigationBarColor` setters (and the `@Suppress("DEPRECATION")` that came with them). Play flags these as deprecated for edge-to-edge, and `setDecorFitsSystemWindows(false)` already makes both bars transparent on Android 15+, so they were dead weight.
4. Copies `scripts/android-patches/ReviewFunctions.kt` into `bridge/functions/`, imports it in `BridgeFunctionRegistration.kt`, registers it as `Review.Request`, and adds `com.google.android.play:review-ktx` to the Gradle dependencies. See the in-app review rule below.
5. Strips keepDebugSymbols so Play actually gets debug symbols (see the debug symbol rule).

Whole files we add live in `scripts/android-patches/` as real `.kt` sources rather than as strings inside the script, so they stay readable and diffable. The script copies them in and treats a byte-identical destination as already applied.

Extraction is longest right after an app update, because that is when the bundle is re-extracted, so every version bump widens the crash window.

## native:package burns a version code from .env on every run
`php artisan native:package android` builds with the current NATIVEPHP_APP_VERSION_CODE and then increments it in .env for next time. Every build consumes a code, including throwaway ones, so the number drifts well ahead of what is actually on Play. That is harmless (Play only needs the code to exceed the last uploaded one) but it means .env is not a record of what shipped - check the Play track for that. 1.1.1 was uploaded as code 18; two local rebuilds later .env was at 20.

`native:package` needs `--no-tty` in any non-interactive shell (agents, CI). Without it Gradle dies with "TTY mode requires /dev/tty to be read/writable" **after** the version code has already been consumed, so a failed build still burns one: a failed 21 left .env at 22 on 2026-08-27. Check .env after any failed package run and reset it if you care which code ships.

Uploading is `~/.config/play/play_upload.py <aab> <track> <name> <status> [userFraction]`, which creates the edit, uploads the bundle, sets release notes from `~/.config/play/release_notes_ka.txt`, and commits. `status=completed` means 100% and must not carry a `userFraction`; use `inProgress` with one for a staged rollout.

Also note `native:install --force` leaves placeholders (REPLACE_APP_ID, REPLACEMECODE, REPLACE_MINIFY_ENABLED, REPLACE_STATUS_BAR_STYLE) in the generated tree. They are substituted by native:run / native:package, so a freshly installed tree is not buildable by Gradle directly. Verified 2026-08-26: install --force wipes all local patches, scripts/patch-nativephp-android.py restores them, and the resulting bundle builds and carries the fixes and the debug symbols.

## Play in-app review: Review.Request is ours, and it can never report an outcome
Upstream NativePHP has no review API, so `Review.Request` is a local bridge function (`scripts/android-patches/ReviewFunctions.kt`). PHP reaches it through `App\Support\NativeReview::request()`, which returns false whenever `nativephp_call` is missing or the function is unregistered, and the app then falls back to `browser.open()` on the store listing. That fallback is what an unpatched build, an iOS build, and a dev browser all get, so the feature degrades instead of breaking.

`BridgeFunction.execute()` is synchronous but the Play flow is not, so Request hands off to `runOnUiThread` and returns `success` immediately. That is not a claim that anything was shown. Play reports nothing about what the user did, and shows no overlay when the quota is spent or when the user is not eligible. Never gate anything on the result.

Crucially, **`requestReviewFlow()` succeeds even when nothing is drawn**, so `isSuccessful` cannot detect it. The only usable signal is elapsed time, because a real overlay waits on a human. Request measures `launchReviewFlow` and opens the store listing when it completes under `SHOWN_THRESHOLD_MS` (1s). That is why `store_url` is a bridge-call parameter rather than a PHP decision.

Measured on a real device (SM-S908E, Android 16) 2026-08-27, tapping rate three times in a row:

| Attempt | `launchReviewFlow` | What happened |
| --- | --- | --- |
| 1st | **6947ms** | `com.android.vending/...inappreviewdialog.InAppReviewActivity` really opened; no fallback fired |
| 2nd | 5ms | quota spent, nothing drawn, store opened |
| 3rd | 2ms | same |

Three orders of magnitude between shown and not-shown, so the 1s threshold is not a close call. The tradeoff is that dismissing a real overlay in under a second also opens the store; rare, and harmless next to a dead button.

**The quota is spent after a single showing.** Expect the fallback to be the common path for anyone who already saw it.

### What actually gates the overlay is the Google account, not the install source
The docs read as though the app must be installed from Play, and an earlier version of this rule said so. That is wrong. Verified 2026-08-27 by uninstalling the Play build and sideloading a **debug-signed** APK: `installerPackageName` was `null` and the overlay still appeared, because the signed-in account owned the app from Play.

The emulator, by contrast, drew nothing (`launchReviewFlow` in 1ms) purely because **no Google account was signed in**, despite running a Play Store system image. So a sideloaded build on your own device is a valid way to test this; an emulator without a signed-in account is not.

Play policy also forbids sentiment-gating, so the prompt must go to everyone who hits the trigger. No "enjoying the app? yes leads to the store, no leads to a feedback form" funnel.

## Play reporting API: metric sets lag ~3 days, error issues are near real time
`crashRateMetricSet:query` (and the other metric sets) refuse any window past their freshness date, which runs about three days behind - querying nearer than that returns HTTP 400 "field should be before the current freshness <date>". They are useless for judging a release published hours ago.

`errorIssues:search` and `errorReports:search` have no such lag and returned same-day data during the 1.1.1 rollout. Use those to judge a fresh release, and accept that they give counts without a denominator: there is no per-version active-device count available, so "0 crashes on the new version" has to be read alongside how long it has been live and at what rollout percentage.

## The libphp.so crash zoo is one bug: an unsynchronised, non-thread-safe PHP engine
The ~100 `libphp.so` crash issues on Play are not PHP memory exhaustion and are not ~100 bugs. Verified 2026-08-31.

Every `_emalloc` SIGABRT aborts at the identical libphp.so offset 0xecab00. Disassembled (NDK llvm-objdump; host objdump cannot do aarch64) it is `fprintf(stderr, "%s\n", "zend_mm_heap corrupted"); abort();` i.e. `zend_mm_panic`. Real exhaustion takes a different path ("Allowed memory size of %zu bytes exhausted") and never aborts. So this is Zend's allocator finding its own heap metadata inconsistent.

Why the heap gets corrupted: the shipped PHP is non-thread-safe (`no-debug-non-zts-20240924`, no `--enable-zts`), the engine is process-global, and `run_php_script_once` does `php_embed_shutdown()` + `php_embed_init()` on **every** request. php_bridge.c contains no mutex at all and `php_initialized` is a plain non-atomic global. Meanwhile several threads enter it:
- `PHPBridge.phpExecutor` is a **per-instance** single-thread executor, and there are two PHPBridge instances (MainActivity.kt:57 and LaravelEnvironment.kt:21). Serialization is per-instance; the engine is per-process, so it guarantees nothing.
- `runArtisanCommand` / `nativeExecuteScript` / `initialize` / `shutdown` are raw `external fun` JNI calls that bypass the executor entirely. `LaravelEnvironment.runBaseArtisanCommands()` (optimize:clear, storage:link, migrate --force) runs on the raw `Thread{}` in `MainActivity.initializeEnvironmentAsync`.
- `onDestroy()` calls `laravelEnv.cleanup()` (which calls shutdown()) **and** `phpBridge.shutdown()` on the main thread, which frees the heap under any request still in flight on phpExecutor.

This explains the whole SIGSEGV zoo (zend_hash_destroy, zend_array_dup, zend_hash_discard, execute_ex, lex_scan, _efree) plus the libsqlite3 ones: all are rug-pull symptoms, and Play groups by top frame, scattering one root cause across ~100 issues of 1-5 reports. Compile frames dominate only because the per-request engine restart means the process spends most of its time compiling. It hits flagships (S25 Ultra) as well as low-end devices, which argues against device OOM.

Do not "fix" this by raising memory_limit or enabling opcache. The fix is one process-wide lock around every native PHP entry point, and not calling shutdown() while a request is in flight.

Note `nativephp/android` is gitignored, so `rg`/`fd` skip it silently. Always pass `-u` / `-I` when searching there or you get false negatives.
