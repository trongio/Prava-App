---
paths:
  - 'resources/js/**/*.tsx'
---

# Js

## Android back press reaches the page late, so popstate modals need two presses
NativePHP's MainActivity intercepts every Android back press and routes it through `webView.canGoBack() -> webView.goBack()` (vendor/nativephp/mobile/resources/androidstudio/app/src/main/java/com/nativephp/mobile/ui/MainActivity.kt:158). The first press is consumed by the WebView back-forward list without emitting `popstate` at all, so the "push a history entry, close the modal on popstate" pattern (user-selection.tsx) needs two presses to close a form. Verified on device 2026-08-11 by instrumenting popstate: press 1 = no event, form open; press 2 = event fires, handler closes correctly and history.length stays stable.

Do not chase this in React - the handler itself is fine. A real fix means handling back in the native layer instead of via popstate. Known and accepted for now.
