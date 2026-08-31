#!/usr/bin/env python3
"""Tests for patch-nativephp-android.py.

Runs the patch script against a pristine copy of the upstream template that
`php artisan native:install --force` regenerates from, so the anchors are
checked against real upstream text rather than an already-patched tree.

    python3 scripts/test-patch-nativephp-android.py

The load-bearing assertion is test_every_native_method_is_locked: it fails if a
native method is ever registered without going through the PHP lock, which is
how the "zend_mm_heap corrupted" crashes happened in the first place.
"""
from __future__ import annotations

import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "patch-nativephp-android.py"
UPSTREAM = ROOT / "vendor/nativephp/mobile/resources/androidstudio"

CPP = "app/src/main/cpp/php_bridge.c"
BRIDGE_KT = "app/src/main/java/com/nativephp/mobile/bridge/PHPBridge.kt"
MAIN_KT = "app/src/main/java/com/nativephp/mobile/ui/MainActivity.kt"

# {"name", "signature", (void *) function}
JNI_ENTRY = re.compile(r'\{\s*"(\w+)"\s*,\s*"[^"]*"\s*,\s*\(void \*\)\s*(\w+)\s*\}')


def run_patch(target: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT), str(target)],
        capture_output=True, text=True,
    )


class PatchScriptTest(unittest.TestCase):
    """Each test gets its own freshly regenerated tree."""

    @classmethod
    def setUpClass(cls) -> None:
        if not UPSTREAM.is_dir():
            raise unittest.SkipTest(f"upstream template missing: {UPSTREAM}")

    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp(prefix="nativephp-patch-test-"))
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.tree = self.tmp / "android"
        shutil.copytree(UPSTREAM, self.tree)
        self.result = run_patch(self.tree)

    def read(self, rel: str) -> str:
        return (self.tree / rel).read_text()

    # --- the script itself --------------------------------------------------

    def test_applies_cleanly_to_a_fresh_upstream_tree(self) -> None:
        self.assertEqual(self.result.returncode, 0, self.result.stdout + self.result.stderr)
        self.assertNotIn("[FAIL]", self.result.stdout)
        self.assertNotIn("[MISS]", self.result.stdout)
        self.assertIn("All patches in place.", self.result.stdout)

    def test_every_patch_actually_changed_something(self) -> None:
        """A fresh tree should report no patch as already applied.

        Guards against an `applied` marker so loose it matches upstream text,
        which would silently skip the patch forever.
        """
        self.assertNotIn("(already applied)", self.result.stdout)

    def test_is_idempotent(self) -> None:
        second = run_patch(self.tree)
        self.assertEqual(second.returncode, 0, second.stdout)
        self.assertNotIn("[ + ]", second.stdout)
        self.assertNotIn("[FAIL]", second.stdout)
        before = self.read(CPP)
        run_patch(self.tree)
        self.assertEqual(before, self.read(CPP), "third run changed the file")

    # --- the property the fix exists to guarantee ---------------------------

    # Only these may be registered unlocked, because they never enter the PHP
    # engine: both just read a path out of the Context over JNI. Locking
    # getLaravelPublicPath in particular would queue every WebView asset request
    # behind whatever PHP is doing. Anything else unlocked is a bug.
    UNLOCKED_BY_DESIGN = {"getLaravelPublicPath", "getLaravelRootPath"}

    def test_every_native_method_is_locked(self) -> None:
        """No method that enters the PHP engine may be registered unlocked.

        libphp.so is non-thread-safe and every entry point restarts the engine,
        so an unlocked registration reintroduces the heap corruption.
        """
        source = self.read(CPP)
        entries = JNI_ENTRY.findall(source)
        self.assertGreater(len(entries), 0, "no JNI registrations found")

        unlocked = [
            (name, fn) for name, fn in entries
            if not fn.startswith("locked_") and name not in self.UNLOCKED_BY_DESIGN
        ]
        self.assertEqual(
            unlocked, [],
            "these native methods are registered without the PHP lock: "
            + ", ".join(f"{n} -> {f}" for n, f in unlocked),
        )

    def test_the_exempt_methods_really_do_not_touch_php(self) -> None:
        """The exemption is only safe while those functions stay pure JNI.

        If upstream ever makes them execute PHP, the allowlist above silently
        becomes a hole; this fails when that happens.
        """
        source = self.read(CPP)
        forbidden = ("php_embed_init", "php_embed_shutdown", "php_execute_script",
                     "zend_", "clear_collected_output")
        for name in self.UNLOCKED_BY_DESIGN:
            match = re.search(
                r"\nJNIEXPORT \w+ JNICALL native_" + self._c_name(name) + r"\(.*?\n\}",
                source, re.S)
            self.assertIsNotNone(match, f"could not find the body of native_{self._c_name(name)}")
            body = match.group(0)
            for bad in forbidden:
                self.assertNotIn(
                    bad, body,
                    f"{name} now touches the PHP engine ({bad}) and must not stay unlocked",
                )

    @staticmethod
    def _c_name(jni_name: str) -> str:
        """getLaravelPublicPath -> get_laravel_public_path"""
        return re.sub(r"(?<!^)(?=[A-Z])", "_", jni_name).lower()

    def test_lock_is_recursive_and_initialised_before_use(self) -> None:
        source = self.read(CPP)
        self.assertIn("PTHREAD_MUTEX_RECURSIVE", source,
                      "run_artisan_command re-enters the lock, so it must be recursive")
        self.assertIn("#include <pthread.h>", source)

        onload = source[source.index("JNI_OnLoad"):]
        self.assertLess(
            onload.index("php_lock_init();"), onload.index("RegisterNatives"),
            "the lock must be initialised before any native method is registered",
        )

    def test_every_locked_wrapper_unlocks(self) -> None:
        """Each wrapper must balance its PHP_LOCK with a PHP_UNLOCK."""
        source = self.read(CPP)
        for body in re.findall(r"\nstatic \w+ JNICALL locked_\w+\([^)]*\)\s*\{(.*?)\n\}", source, re.S):
            self.assertEqual(body.count("PHP_LOCK()"), 1)
            self.assertEqual(body.count("PHP_UNLOCK()"), 1)
            self.assertLess(body.index("PHP_LOCK()"), body.index("PHP_UNLOCK()"))

    def test_wrappers_do_not_swallow_the_return_value(self) -> None:
        source = self.read(CPP)
        for signature, body in re.findall(
            r"\nstatic (\w+) JNICALL locked_\w+\([^)]*\)\s*\{(.*?)\n\}", source, re.S
        ):
            if signature != "void":
                self.assertIn("return result;", body)

    # --- the Kotlin side ----------------------------------------------------

    def test_php_executor_is_process_wide(self) -> None:
        source = self.read(BRIDGE_KT)
        executor = "Executors.newSingleThreadExecutor()"
        self.assertEqual(source.count(executor), 1, "expected exactly one executor")

        companion = source.index("companion object")
        self.assertGreater(
            source.index(executor), companion,
            "the executor must live in the companion object, or each PHPBridge "
            "instance gets its own thread into one process-global PHP engine",
        )
        self.assertIn("fun runOnPhpThread(", source)

    def test_shutdown_does_not_run_on_the_main_thread(self) -> None:
        source = self.read(MAIN_KT)
        destroy = source[source.index("override fun onDestroy"):]
        destroy = destroy[:destroy.index("\n    override fun")]

        self.assertIn("PHPBridge.runOnPhpThread {", destroy)
        self.assertNotRegex(
            destroy, r"\n        laravelEnv\.cleanup\(\)",
            "cleanup() must not be called directly on the main thread",
        )
        self.assertNotRegex(
            destroy, r"\n        phpBridge\.shutdown\(\)",
            "shutdown() must not be called directly on the main thread",
        )

    def test_lateinit_laravel_env_is_guarded_in_on_destroy(self) -> None:
        """onDestroy can run before the async init thread ever assigns it."""
        source = self.read(MAIN_KT)
        destroy = source[source.index("override fun onDestroy"):]
        destroy = destroy[:destroy.index("\n    override fun")]
        self.assertIn("::laravelEnv.isInitialized", destroy)


if __name__ == "__main__":
    unittest.main(verbosity=2)
