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

It applies four things:
1. NativeActionCoordinator.install(): commitNow() -> commitNowAllowingStateLoss(). install() runs from a Handler.post callback after bundle extraction, by which point the Activity may have saved state. This was the app's single largest crash (52 reports / 33 users, ~34% of users, versionCodes 8 and 9): IllegalStateException "Can not perform this action after onSaveInstanceState". onDestroy() in the same file already used commitNowAllowingStateLoss, so this was an upstream oversight. Reproduced on device as `finishing=false destroyed=false stateSaved=true` and confirmed fixed 2026-08-26.
2. MainActivity.initializeEnvironmentAsync(): skip onReady() when isFinishing || isDestroyed. Covers the rarer "FragmentManager has been destroyed" variant; onReady also builds the WebView and loads a URL, none of it valid on a dead Activity.
3. MainActivity.configureStatusBar(): drops the deprecated `window.statusBarColor` / `window.navigationBarColor` setters (and the `@Suppress("DEPRECATION")` that came with them). Play flags these as deprecated for edge-to-edge, and `setDecorFitsSystemWindows(false)` already makes both bars transparent on Android 15+, so they were dead weight.
4. Strips keepDebugSymbols so Play actually gets debug symbols (see the debug symbol rule).

Extraction is longest right after an app update, because that is when the bundle is re-extracted, so every version bump widens the crash window.

## native:package burns a version code from .env on every run
`php artisan native:package android` builds with the current NATIVEPHP_APP_VERSION_CODE and then increments it in .env for next time. Every build consumes a code, including throwaway ones, so the number drifts well ahead of what is actually on Play. That is harmless (Play only needs the code to exceed the last uploaded one) but it means .env is not a record of what shipped - check the Play track for that. 1.1.1 was uploaded as code 18; two local rebuilds later .env was at 20.

Also note `native:install --force` leaves placeholders (REPLACE_APP_ID, REPLACEMECODE, REPLACE_MINIFY_ENABLED, REPLACE_STATUS_BAR_STYLE) in the generated tree. They are substituted by native:run / native:package, so a freshly installed tree is not buildable by Gradle directly. Verified 2026-08-26: install --force wipes all local patches, scripts/patch-nativephp-android.py restores them, and the resulting bundle builds and carries the fixes and the debug symbols.

## Play reporting API: metric sets lag ~3 days, error issues are near real time
`crashRateMetricSet:query` (and the other metric sets) refuse any window past their freshness date, which runs about three days behind - querying nearer than that returns HTTP 400 "field should be before the current freshness <date>". They are useless for judging a release published hours ago.

`errorIssues:search` and `errorReports:search` have no such lag and returned same-day data during the 1.1.1 rollout. Use those to judge a fresh release, and accept that they give counts without a denominator: there is no per-version active-device count available, so "0 crashes on the new version" has to be read alongside how long it has been live and at what rollout percentage.
