# Authentication is enforced by middleware, not by handlers

All `/api/*` requests (except `/api/auth/login` and `/api/auth/signup`) are authenticated by `middleware.ts`. The middleware accepts a JWT from either an httpOnly `session` cookie (web) or an `Authorization: Bearer` header (Chrome extension), verifies it, strips any inbound `x-user-id`, and forwards the request with a trusted `x-user-id` header. Route handlers never call `jwtVerify`; they read `userId` from `x-user-id`. Request bodies never carry a `userId` field — existing endpoints that accept one (notably `/api/weekly-planner`) are changed to drop it.

## Why

Before this decision, JWT verification was inlined in ~29 route handlers and `userId` was in some cases trusted from the request body (e.g. `/api/weekly-planner`), which let any authenticated client request data for any user. Forgetting to verify was a silent vulnerability with no compiler or framework support to catch it. Concentrating verification in middleware makes the seam framework-enforced: a handler that "forgets" to authenticate cannot, because the middleware ran first.

## Considered alternatives

- **Shared `requireUser(request)` helper called by each handler.** Rejected: same failure mode as today — forgetting the call is silent. Locality of *implementation* improves, but locality of *enforcement* doesn't.
- **`localStorage` token storage on the web (status quo).** Rejected: XSS-readable. The httpOnly cookie removes a class of token-exfiltration attacks at the cost of needing a fetch wrapper that sends `credentials: "include"`.
- **Cross-origin cookies for the Chrome extension.** Rejected: would require `SameSite=None; Secure` on the `session` cookie, weakening the web's CSRF posture. The extension keeps its existing `Authorization: Bearer` ingress; the middleware tries the cookie first and falls back to the bearer header, so there's still one verifier.
- **Separate long-lived API keys for the extension.** Rejected: introduces a second token format with its own lifecycle for marginal benefit; revisit only if per-device revocation becomes a real requirement.

## Consequences

- The Chrome extension's current "grab the token from the web app via `postMessage`" bootstrap goes away. The extension grows its own login form that calls `/api/auth/login` and stores the returned token in `chrome.storage`.
- `/api/auth/login` and `/api/auth/signup` set the `session` cookie via `Set-Cookie` for web callers, and continue to return the token in the response body for the extension.
- Any future endpoint that needs a "verified user" gets it for free by virtue of being under `/api/*`. Adding a new authenticated route requires no auth code in the handler.
