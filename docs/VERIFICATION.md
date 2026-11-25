# Verification — November 23, 2026

## Current automated checks

- Type checking covers client/Worker source plus tooling, scripts and browser tests through separate configs.
- ESLint checks hooks and focused correctness rules.
- Unit suite: **50 passed in 8 files**, including search-intent synchronization, server-side contradiction rejection, twelve-candidate selection, same-brand model preservation, query cleanup, and unlimited search admission.
- Browser suite: **19 passed, zero skips**, including native two-account CRUD and direct foreign-ID denial.
- Production build compiles Worker/client and prerenders the public demo. It runs both type checks first.
- `npm audit --json`: **zero vulnerabilities** after resolving esbuild to 0.28.2.

Commands: `npm run validate`, `npx deepspace test run all --port 5184 --json`, `npm run build`, `npm audit`. The earlier audit's 24/14 counts describe the old implementation.

## Important regression coverage

Real source modules are tested with mocked external transport: fixed Apify actor/cap/market, one paid start with free bounded polling, resume without start, per-item schema normalization, non-USD/invalid prices, real offer provenance, null Exa siblings, malformed JSON, model identity, literal specification grounding and discarded model numeric scores. Known actual Apify/Exa/OpenAI responses are replayed.

Worker action tests exercise validation, verified-identity forwarding, streaming byte limits, disabled/allowlist access and user-scoped caching without hitting paid providers. ResearchGate tests serialize transactions and exercise concurrent duplicate admission, stale finish/fail fencing, upstream job retention, UTC-day and cache expiry. These logic tests do not claim exhaustive Cloudflare storage fault-injection coverage.

Browser tests use actual native authentication and records for private save/reload/reopen/delete. A second account sends forged record get/update/delete/create requests against a known foreign ID, and all are denied. Invalid server saves are rejected. Desktop/mobile demo journeys spend no credits. A browser component test replaces only the external provider transport with recorded responses and verifies actual live-price rendering, mode preservation, tied leaders, saving and free reopen.

The populated-history regression exposed both long-text flex sizing and narrow navigation width. Both were corrected; target sizes, active navigation and heading focus are asserted. Screenshots include `docs/screenshots/live-comparison-replay.png`; its transport is recorded, not a new live request.

## Paid verification and accounting

Earlier implementation probes are retained for historical context. During remediation the authorized ceiling was four paid invocations:

1. Original `amazon/search-products`: failed, `upstream_provider_error`; SerpAPI reported its account had run out of searches. Billing released. Detailed envelope: `docs/live-verification/remediation/amazon-response.json`.
2. `apify/run-actor`, `junglee/amazon-crawler`: succeeded, three iPad A16 128GB color variants at USD 379. Provider cost USD 0.012; DeepSpace net USD 0.048. Source/limits/results: `docs/live-verification/apify-probe/`.
3. One fresh Exa search using the current provider query: succeeded; four Apple/manufacturer results.
4. One fresh OpenAI extraction using the current compact prompt: succeeded with complete JSON, two quoted specs per product. No model scoring was requested or accepted.

Steps 3–4 reused the already completed Amazon job through a free `apify/get-run` read; there was **no second paid Apify start**. Evidence: `docs/live-verification/approved-1795491410782/`. The last two calls cost **USD 0.01098864**. Entire remediation verification cost **USD 0.05898864 = 5.898864 credits**. Final recorded balance: **492.937012 credits**. This excludes the separate earlier agent's historical USD 0.01164124 probes, whose records remain intact.

The paid run's initial normalized result omitted model specs because the first identity gate overmatched marketing numbers. The refinement distinguishes true generation/model codes from capacity, camera and Wi-Fi units, checks explicit capacities, and retains exact-ASIN listing overview specs. The fresh actual responses pass the updated offline replay, including A16 chip and 128GB specification acceptance. This refinement did not trigger another paid request.

## Credential protection

`.dev.vars`, credential stores, local runtime state and build output remain ignored. Final private scan: 20 built client files, four materialized credential values checked, zero matches. Worker-local `.dev.vars` must never be published as static assets. No credentials are present in paid request fixtures; all calls use the native CLI session.

## Delivery boundary

No deployment or portal submission was performed. Live access in the checkout is restricted to the owner allowlist and requires a deliberate search; demo remains the UI default. The generic paid proxy is blocked. Production verification and the applicant's personal verification are still outstanding.
