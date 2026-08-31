---
paths:
  - 'routes/**'
---

# Routes

## APP_PLATFORM decides which auth surface exists
One codebase ships two apps. APP_PLATFORM=native (the default, and what the Play Store build uses) keeps the device profile picker: `/` lists every local user and logs in without a password, CSRF is skipped, and /api/users, /api/login, /native-file/preview and the review-prompt routes exist. APP_PLATFORM=web (driving.hackerman.ge) registers Fortify login/register/reset plus guest sessions instead, enforces CSRF, and 404s all the device-only routes via the `native.only` middleware. Never register the profile-picker routes on web: on a shared server they list every account and let anyone sign in as any of them. Check with App\Support\Platform, not config() directly.
