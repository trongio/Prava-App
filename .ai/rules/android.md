---
paths:
  - 'nativephp/android/**'
---

# Android

## Play debug symbols: never set jniLibs.keepDebugSymbols in the release bundle
nativephp/android is gitignored and `php artisan native:install --force` re-copies it from vendor/nativephp/mobile/resources/androidstudio, which ships `packaging { jniLibs { keepDebugSymbols.add("**/*.so") } }`. That line silently defeats native debug symbols: AGP's ExtractNativeDebugMetadataWorkAction skips a library whenever its merged_native_libs and stripped_native_libs copies are the same size, so keeping symbols makes strip a no-op, extraction emits zero files, and the AAB ships with no BUNDLE-METADATA/com.android.tools.build.debugsymbols/ entry. Play then warns "you've not uploaded debug symbols" even though debugSymbolLevel is FULL.

After any `native:install --force`, delete that keepDebugSymbols line again before building a release. Stripping is safe: it preserves 16 KB LOAD alignment (p_align 0x4000) and cuts ~659 KB from the on-device payload.

Keep debugSymbolLevel = "FULL" (config nativephp.android.build.debug_symbols). Only libc++_shared.so, libphp_wrapper.so and libcompat.so carry symbols; libphp.so is stripped upstream. FULL costs 686 KB vs SYMBOL_TABLE's 1.8 MB here, and BUNDLE-METADATA never reaches user downloads.

R8 is off (minify_enabled = false), so there is no mapping.txt and Play's "no deobfuscation file" warning is informational only. Do not enable R8 to silence it; NativePHP resolves classes reflectively.
