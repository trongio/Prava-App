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
# Defaults to the generated tree; a target can be passed for testing against a
# pristine copy of the upstream template.
ANDROID = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / "nativephp" / "android"
JAVA = ANDROID / "app/src/main/java/com/nativephp/mobile"
CPP = ANDROID / "app/src/main/cpp"
SOURCES = ROOT / "scripts" / "android-patches"

# Whole files we add to the generated tree, rather than edits to upstream ones.
FILE_COPIES = [
    {
        "name": "ReviewFunctions.kt: Play in-app review bridge function",
        "src": SOURCES / "ReviewFunctions.kt",
        "dst": JAVA / "bridge/functions/ReviewFunctions.kt",
    },
]

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

EDGE_OLD = """    @Suppress("DEPRECATION")
    private fun configureStatusBar() {
        val windowInsetsController = WindowInsetsControllerCompat(window, window.decorView)

        // Make status bar and navigation bar transparent for edge-to-edge
        window.statusBarColor = android.graphics.Color.TRANSPARENT
        window.navigationBarColor = android.graphics.Color.TRANSPARENT
"""

EDGE_NEW = """    private fun configureStatusBar() {
        val windowInsetsController = WindowInsetsControllerCompat(window, window.decorView)

        // System bars are transparent automatically in edge-to-edge mode
        // (setDecorFitsSystemWindows(false)); the deprecated window.statusBarColor /
        // navigationBarColor setters are intentionally omitted for Android 15+.
"""

# --- The PHP engine lock ----------------------------------------------------
# libphp.so is non-thread-safe and every native entry point tears the engine
# down and rebuilds it, so concurrent entry corrupts the shared Zend heap.

LOCK_OLD = """// Global state
static int php_initialized = 0;
"""

LOCK_NEW = """#include <pthread.h>

// One process-global PHP engine, one lock.
//
// libphp.so is built non-thread-safe (no-debug-non-zts) and every native entry
// point below tears the engine down and rebuilds it (php_embed_shutdown +
// php_embed_init). Two threads inside any of them corrupt the shared Zend heap,
// which aborts the process with "zend_mm_heap corrupted".
//
// PHPBridge's single-thread executor does not prevent this on its own: it was a
// per-instance field, there are two PHPBridge instances (MainActivity and
// LaravelEnvironment), and initialize/shutdown/runArtisanCommand are called
// straight from other threads without going through it at all.
//
// Recursive because native_run_artisan_command re-enters the lock through
// native_initialize and, via CallObjectMethod, native_get_laravel_public_path.
static pthread_mutex_t g_php_lock;

static void php_lock_init(void) {
    pthread_mutexattr_t attr;
    pthread_mutexattr_init(&attr);
    pthread_mutexattr_settype(&attr, PTHREAD_MUTEX_RECURSIVE);
    pthread_mutex_init(&g_php_lock, &attr);
    pthread_mutexattr_destroy(&attr);
}

#define PHP_LOCK()   pthread_mutex_lock(&g_php_lock)
#define PHP_UNLOCK() pthread_mutex_unlock(&g_php_lock)

// Global state
static int php_initialized = 0;
"""

TABLE_OLD = """static JNINativeMethod gMethods[] = {
        // PHPBridge
        {"nativeExecuteScript", "(Ljava/lang/String;)Ljava/lang/String;", (void *) native_execute_script},
        {"initialize", "()V", (void *) native_initialize},
        {"shutdown", "()V", (void *) native_shutdown},
        {"setRequestInfo", "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V", (void *) native_set_request_info},
        {"runArtisanCommand", "(Ljava/lang/String;)Ljava/lang/String;", (void *) native_run_artisan_command},
        {"getLaravelPublicPath", "()Ljava/lang/String;", (void *) native_get_laravel_public_path},
        {"getLaravelRootPath", "()Ljava/lang/String;", (void *) native_get_laravel_root_path},

        // LaravelEnvironment
        {"nativeSetEnv", "(Ljava/lang/String;Ljava/lang/String;I)I", (void *) native_set_env},
        {"nativeHandleRequestOnce","(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;",(void *) native_handle_request_once}
};
"""

TABLE_NEW = """// Every native method that enters the PHP engine is registered through one of
// these wrappers, so no two threads are ever inside the engine at once. The
// bodies above are left exactly as upstream wrote them; only the entry points
// are serialised. The two path getters are exempt and say why at their
// registration below.

static void JNICALL locked_initialize(JNIEnv *env, jobject thiz) {
    PHP_LOCK();
    native_initialize(env, thiz);
    PHP_UNLOCK();
}

static void JNICALL locked_shutdown(JNIEnv *env, jobject thiz) {
    PHP_LOCK();
    native_shutdown(env, thiz);
    PHP_UNLOCK();
}

static void JNICALL locked_set_request_info(JNIEnv *env, jobject thiz,
                                            jstring method, jstring uri, jstring post_data) {
    PHP_LOCK();
    native_set_request_info(env, thiz, method, uri, post_data);
    PHP_UNLOCK();
}

static jint JNICALL locked_set_env(JNIEnv *env, jobject thiz,
                                   jstring name, jstring value, jint overwrite) {
    PHP_LOCK();
    jint result = native_set_env(env, thiz, name, value, overwrite);
    PHP_UNLOCK();
    return result;
}

static jstring JNICALL locked_execute_script(JNIEnv *env, jobject thiz, jstring filename) {
    PHP_LOCK();
    jstring result = native_execute_script(env, thiz, filename);
    PHP_UNLOCK();
    return result;
}

static jstring JNICALL locked_run_artisan_command(JNIEnv *env, jobject thiz, jstring jcommand) {
    PHP_LOCK();
    jstring result = native_run_artisan_command(env, thiz, jcommand);
    PHP_UNLOCK();
    return result;
}

static jstring JNICALL locked_handle_request_once(
        JNIEnv *env, jobject thiz,
        jstring jMethod, jstring jUri, jstring jPostData, jstring jScriptPath) {
    PHP_LOCK();
    jstring result = native_handle_request_once(env, thiz, jMethod, jUri, jPostData, jScriptPath);
    PHP_UNLOCK();
    return result;
}

static JNINativeMethod gMethods[] = {
        // PHPBridge
        {"nativeExecuteScript", "(Ljava/lang/String;)Ljava/lang/String;", (void *) locked_execute_script},
        {"initialize", "()V", (void *) locked_initialize},
        {"shutdown", "()V", (void *) locked_shutdown},
        {"setRequestInfo", "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V", (void *) locked_set_request_info},
        {"runArtisanCommand", "(Ljava/lang/String;)Ljava/lang/String;", (void *) locked_run_artisan_command},
        // Deliberately unlocked: these only read a path out of the Context via JNI
        // and never enter the PHP engine. PHPWebViewClient calls the first on the
        // WebView thread for every intercepted request, so locking it would queue
        // all asset loading behind whatever PHP is doing.
        {"getLaravelPublicPath", "()Ljava/lang/String;", (void *) native_get_laravel_public_path},
        {"getLaravelRootPath", "()Ljava/lang/String;", (void *) native_get_laravel_root_path},

        // LaravelEnvironment
        {"nativeSetEnv", "(Ljava/lang/String;Ljava/lang/String;I)I", (void *) locked_set_env},
        {"nativeHandleRequestOnce","(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;",(void *) locked_handle_request_once}
};
"""

ONLOAD_OLD = """JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *reserved) {
    g_jvm = vm;
"""

ONLOAD_NEW = """JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM *vm, void *reserved) {
    g_jvm = vm;

    // Before any native method can run.
    php_lock_init();
"""

ENVMETHODS_OLD = """    static JNINativeMethod envMethods[] = {
            {"nativeSetEnv", "(Ljava/lang/String;Ljava/lang/String;I)I", (void *) native_set_env}
    };
"""

ENVMETHODS_NEW = """    // Same process-wide PHP lock as gMethods above.
    static JNINativeMethod envMethods[] = {
            {"nativeSetEnv", "(Ljava/lang/String;Ljava/lang/String;I)I", (void *) locked_set_env}
    };
"""

# --- Kotlin: one PHP thread for the whole process ---------------------------

EXECUTOR_OLD = """    private val requestDataMap = ConcurrentHashMap<String, String>()
    private val phpExecutor = java.util.concurrent.Executors.newSingleThreadExecutor()
"""

EXECUTOR_NEW = """    private val requestDataMap = ConcurrentHashMap<String, String>()
"""

COMPANION_OLD = """    companion object {
        private const val TAG = "PHPBridge"
        private const val MAX_REQUEST_AGE = 5 * 60 * 1000L
"""

COMPANION_NEW = """    companion object {
        private const val TAG = "PHPBridge"
        private const val MAX_REQUEST_AGE = 5 * 60 * 1000L

        // Process-wide, not per-instance. There are two PHPBridge instances
        // (MainActivity and LaravelEnvironment) but only one process-global,
        // non-thread-safe PHP engine, so a per-instance executor serialised
        // nothing. The native lock in php_bridge.c is the real guarantee; this
        // keeps requests in FIFO order and off the callers' threads.
        private val phpExecutor = java.util.concurrent.Executors.newSingleThreadExecutor()

        /** Run [block] on the single PHP thread without blocking the caller. */
        fun runOnPhpThread(block: () -> Unit) {
            phpExecutor.execute(block)
        }
"""

DESTROY_OLD = """        laravelEnv.cleanup()
        phpBridge.shutdown()
    }
"""

DESTROY_NEW = """        // Tearing the PHP engine down from the main thread would block on the
        // process-wide PHP lock until any in-flight request finished, and the
        // WebView usually has one pending when the user leaves. Hand it to the
        // PHP thread instead; the lock keeps it ordered behind that request.
        // laravelEnv is assigned on the async init thread, so it may never have
        // been set if the user left during first-run extraction.
        val envToClean = if (::laravelEnv.isInitialized) laravelEnv else null
        val bridge = phpBridge
        PHPBridge.runOnPhpThread {
            envToClean?.cleanup()
            bridge.shutdown()
        }
    }
"""


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
    {
        "name": "MainActivity: drop the deprecated edge-to-edge setters",
        "path": JAVA / "ui/MainActivity.kt",
        "old": EDGE_OLD,
        "new": EDGE_NEW,
        "applied": "navigationBarColor setters are intentionally omitted",
        "why": "Play flags these as deprecated APIs for edge-to-edge. "
               "setDecorFitsSystemWindows(false) already makes the bars transparent "
               "on Android 15+, so the setters are dead weight and the @Suppress with them.",
    },
    {
        "name": "BridgeFunctionRegistration: import ReviewFunctions",
        "path": JAVA / "bridge/BridgeFunctionRegistration.kt",
        "old": "import com.nativephp.mobile.bridge.functions.QrCodeFunctions\n",
        "new": "import com.nativephp.mobile.bridge.functions.QrCodeFunctions\n"
               "import com.nativephp.mobile.bridge.functions.ReviewFunctions\n",
        "applied": "import com.nativephp.mobile.bridge.functions.ReviewFunctions",
        "why": "Pairs with the Review.Request registration below.",
    },
    {
        "name": "BridgeFunctionRegistration: register Review.Request",
        "path": JAVA / "bridge/BridgeFunctionRegistration.kt",
        "old": '    registry.register("System.OpenAppSettings", SystemFunctions.OpenAppSettings(context))\n',
        "new": '    registry.register("System.OpenAppSettings", SystemFunctions.OpenAppSettings(context))\n'
               '    registry.register("Review.Request", ReviewFunctions.Request(activity))\n',
        "applied": 'registry.register("Review.Request"',
        "why": "Without this the bridge returns null for Review.Request and the app "
               "falls back to opening the store listing, which still works but converts worse.",
    },
    {
        "name": "build.gradle.kts: add the Play review library",
        "path": ANDROID / "app/build.gradle.kts",
        "old": '    implementation("androidx.camera:camera-view:$camerax_version")\n}\n',
        "new": '    implementation("androidx.camera:camera-view:$camerax_version")\n\n'
               '    // Google Play in-app review overlay (local addition, see ReviewFunctions.kt)\n'
               '    implementation("com.google.android.play:review-ktx:2.0.2")\n}\n',
        "applied": "com.google.android.play:review-ktx",
        "why": "ReviewFunctions.kt will not compile without it.",
    },
    {
        "name": "php_bridge.c: add the process-wide PHP engine lock",
        "path": CPP / "php_bridge.c",
        "old": LOCK_OLD,
        "new": LOCK_NEW,
        "applied": "static pthread_mutex_t g_php_lock;",
        "why": "libphp.so is non-thread-safe and every entry point restarts the engine; "
               "concurrent entry corrupts the Zend heap and aborts.",
    },
    {
        "name": "php_bridge.c: register every native method through a locking wrapper",
        "path": CPP / "php_bridge.c",
        "old": TABLE_OLD,
        "new": TABLE_NEW,
        "applied": "locked_handle_request_once",
        "why": "Wrapping at the JNI table leaves the upstream function bodies untouched.",
    },
    {
        "name": "php_bridge.c: initialise the lock in JNI_OnLoad",
        "path": CPP / "php_bridge.c",
        "old": ONLOAD_OLD,
        "new": ONLOAD_NEW,
        "applied": "php_lock_init();",
        "why": "JNI_OnLoad runs before any native method, and a recursive mutex "
               "cannot be initialised statically on bionic.",
    },
    {
        "name": "php_bridge.c: lock the LaravelEnvironment nativeSetEnv registration too",
        "path": CPP / "php_bridge.c",
        "old": ENVMETHODS_OLD,
        "new": ENVMETHODS_NEW,
        "applied": "Same process-wide PHP lock as gMethods above",
        "why": "It is registered on a second class, so the gMethods edit misses it.",
    },
    {
        "name": "PHPBridge: make the PHP executor process-wide",
        "path": JAVA / "bridge/PHPBridge.kt",
        "old": EXECUTOR_OLD,
        "new": EXECUTOR_NEW,
        "applied": "private val requestDataMap = ConcurrentHashMap<String, String>()\n\n    private val nativePhpScript",
        "why": "A per-instance executor serialised nothing across the two PHPBridge instances.",
    },
    {
        "name": "PHPBridge: add the shared executor and runOnPhpThread",
        "path": JAVA / "bridge/PHPBridge.kt",
        "old": COMPANION_OLD,
        "new": COMPANION_NEW,
        "applied": "fun runOnPhpThread(",
        "why": "Pairs with the executor move above; onDestroy needs a way to shut down "
               "off the main thread.",
    },
    {
        "name": "MainActivity: shut PHP down off the main thread, and guard laravelEnv",
        "path": JAVA / "ui/MainActivity.kt",
        "old": DESTROY_OLD,
        "new": DESTROY_NEW,
        "applied": "PHPBridge.runOnPhpThread {",
        "why": "shutdown() on the main thread would block on the PHP lock behind an "
               "in-flight request; laravelEnv is lateinit and may never have been set.",
    },
]

# The Gradle line is a deletion rather than a replacement, handled separately.
GRADLE = ANDROID / "app/build.gradle.kts"
KEEP_SYMBOLS = 'keepDebugSymbols.add("**/*.so")'


def copy_added_files() -> int:
    failures = 0
    for f in FILE_COPIES:
        src: Path = f["src"]
        dst: Path = f["dst"]

        if not src.exists():
            print(f"[MISS] {f['name']}\n       source not found: {src}")
            failures += 1
            continue

        wanted = src.read_text()
        if dst.exists() and dst.read_text() == wanted:
            print(f"[ ok ] {f['name']} (already copied)")
            continue

        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(wanted)
        print(f"[ + ] {f['name']}")
        print(f"       copied from {src.relative_to(ROOT)}")
    return failures


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
            print(f"[FAIL] {p['name']}\n       pattern not found in {path}")
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

    try:
        where = ANDROID.relative_to(ROOT)
    except ValueError:
        where = ANDROID
    print(f"Patching {where}\n")
    failures = copy_added_files() + apply_text_patches() + strip_keep_debug_symbols()
    print()
    if failures:
        print(f"{failures} patch(es) could not be applied. Do not ship until resolved.")
        return 1
    print("All patches in place.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
