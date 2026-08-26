#!/usr/bin/env python3
"""Re-apply local patches to the generated nativephp/android tree.

`php artisan native:install --force` regenerates nativephp/android from
vendor/nativephp/mobile/resources/androidstudio, silently discarding anything we
changed there. The directory is gitignored, so nothing warns you. Run this after
every native:install, and before building a release.

Idempotent: patches already applied are reported as "ok" and left alone.

    php artisan native:install --force
    python3 scripts/patch-nativephp-android.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ANDROID = ROOT / "nativephp" / "android"
JAVA = ANDROID / "app/src/main/java/com/nativephp/mobile"

GUARD = '''            Handler(Looper.getMainLooper()).post {
                // Bundle extraction can outlive this Activity. The user may leave or
                // background the app while it runs, and it runs longest right after an
                // update, when the bundle is re-extracted. Calling onReady() then commits
                // a fragment onto a state-saved or destroyed FragmentManager, which throws
                // IllegalStateException and kills the process on launch.
                if (isFinishing || isDestroyed) {
                    Log.d("LaravelInit", "⏹ Activity gone before init finished, skipping onReady")
                    return@post
                }
                onReady()
            }'''

PATCHES = [
    {
        "name": "NativeActionCoordinator: commit without state-loss check",
        "path": JAVA / "utils/NativeActionCoordinator.kt",
        "old": "                        .commitNow()\n",
        "new": "                        .commitNowAllowingStateLoss()\n",
        "applied": ".commitNowAllowingStateLoss()",
        "why": "install() runs from a posted callback; the Activity may already have "
               "saved state. onDestroy() in the same package already does this.",
    },
    {
        "name": "MainActivity: skip onReady() when the Activity is gone",
        "path": JAVA / "ui/MainActivity.kt",
        "old": "            Handler(Looper.getMainLooper()).post {\n                onReady()\n            }",
        "new": GUARD,
        "applied": "skipping onReady",
        "why": "onReady() sets up the WebView and loads a URL; none of it is valid "
               "on a dead Activity.",
    },
]

# The Gradle line is a deletion rather than a replacement, handled separately.
GRADLE = ANDROID / "app/build.gradle.kts"
KEEP_SYMBOLS = 'keepDebugSymbols.add("**/*.so")'


def apply_text_patches() -> int:
    failures = 0
    for p in PATCHES:
        path: Path = p["path"]
        if not path.exists():
            print(f"[MISS] {p['name']}\n       file not found: {path}")
            failures += 1
            continue

        text = path.read_text()
        if p["applied"] in text:
            print(f"[ ok ] {p['name']} (already applied)")
            continue
        if p["old"] not in text:
            print(f"[FAIL] {p['name']}\n       pattern not found in {path.relative_to(ROOT)}")
            print("       Upstream probably changed. Re-check the source before building.")
            failures += 1
            continue

        path.write_text(text.replace(p["old"], p["new"], 1))
        print(f"[ + ] {p['name']}")
        print(f"       {p['why']}")
    return failures


def strip_keep_debug_symbols() -> int:
    name = "build.gradle.kts: drop keepDebugSymbols so Play gets real symbols"
    if not GRADLE.exists():
        print(f"[MISS] {name}\n       file not found: {GRADLE}")
        return 1

    lines = GRADLE.read_text().splitlines(keepends=True)
    kept = [ln for ln in lines if KEEP_SYMBOLS not in ln or ln.lstrip().startswith("//")]
    if len(kept) == len(lines):
        print(f"[ ok ] {name} (already absent)")
        return 0

    GRADLE.write_text("".join(kept))
    print(f"[ + ] {name}")
    print("       Keeping symbols makes strip a no-op, so AGP extracts nothing and")
    print("       the AAB ships with no debug symbols at all.")
    return 0


def main() -> int:
    if not ANDROID.is_dir():
        print(f"nativephp/android not found at {ANDROID}")
        print("Run `php artisan native:install --force` first.")
        return 1

    print(f"Patching {ANDROID.relative_to(ROOT)}\n")
    failures = apply_text_patches() + strip_keep_debug_symbols()
    print()
    if failures:
        print(f"{failures} patch(es) could not be applied. Do not ship until resolved.")
        return 1
    print("All patches in place.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
