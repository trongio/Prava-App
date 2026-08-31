---
paths:
  - composer.json
---

# General

## nativephp/desktop and nativephp/mobile cannot coexist
nativephp/desktop declares a hard Composer conflict with nativephp/mobile ("nativephp/desktop[2.0.0, ..., 2.2.1] conflict with nativephp/mobile *"), so the Windows/Linux build lives on a generated `desktop` branch rather than behind a flag. Regenerate it with deploy/make-desktop-branch.sh, which swaps the packages, drops the private nativephp.composer.sh repository (desktop is all Packagist, so CI needs no licence credentials), points the #nativephp import at resources/js/native-shim.ts, and removes the mobile Vite plugin. Verified 2026-08-31: produces AppImage and .deb for x64 and arm64.
