---
paths:
  - bootstrap/app.php
---

# Bootstrap

## config() is not available inside withMiddleware()
The withMiddleware() callback runs on afterResolving(HttpKernel), which fires before the framework bootstraps, so config() throws `Class "config" does not exist` there. Anything that must vary by platform has to decide at request time inside a middleware instead - that is why CSRF is handled by ValidateCsrfTokenUnlessNative rather than a conditional validateCsrfTokens() call, and why trustProxies is unconditional.
