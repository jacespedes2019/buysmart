# Verification — November 24, 2026

## Current automated checks

- Type checking covers client/Worker source plus tooling, scripts and browser tests through separate configs.
- ESLint checks hooks and focused correctness rules.
- Unit suite: **60 passed in 9 files**, including search-intent synchronization, server-side contradiction rejection, twelve-candidate selection, same-brand model preservation, query cleanup, and unlimited search admission.
- Browser suite: **21 passed, zero skips**, including native two-account CRUD and direct foreign-ID denial.
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

## November 24 — interface and delivery preparation

Refined desktop/mobile spacing, typography, search hierarchy and product cards. A prominent ranking-scope panel explains the live score, unavailable criteria and suitability limits. Research warnings are expandable; live cards omit unsupported strengths/weaknesses. The priorities panel marks its three unscored live criteria. Full suite: 50 unit tests / 8 files and 19 browser tests with zero skips; includes live-snapshot scope disclosure and unchanged native two-user isolation tests. Screenshots regenerated under docs/screenshots/ and visually reviewed.

An authorized marketplace-only probe used the actual cleaned query `tablet apple ipad`, up to twelve candidates, one paid start and nine free polls. Four priced configurations survived selection: A16 256GB (USD 479.99), A16 128GB (USD 379), renewed 8th-generation 32GB (USD 119), and a renewed 2020 32GB listing (USD 118). These are observed listings, not a promise of four model families; uncertain identity differences are preserved. Probe evidence: docs/live-verification/variety-1795568924999/. Cost: USD 0.176 (17.6 credits), within the explicit USD 0.50 approval. No new Exa/OpenAI invocation was made: Exa can reserve USD 0.65, exceeding that authorization. Earlier live integration checks and replay evidence remain applicable, but are not a new full live search.

Submission draft: SUBMISSION.md. Candidate verification remains explicitly incomplete until the applicant performs it.

### Deployed release and production verification

Live URL: https://buysmart.app.space. Release `rel_01M8842V6R3PK24PYCECJ0XDBS`, source commit `c2f6b51`, clean GitHub working tree. DeepSpace reported `serving: confirmed` and `dataPlane: confirmed`. The app's first release selected GitHub source (`jacespedes2019/buysmart`).

Four Playwright checks ran against the real deployed URL and passed: full desktop demo journey, full mobile demo journey, bidirectional text/filter synchronization with ambiguity blocking, and native private save/reload/reopen/delete with two separate authenticated accounts verifying isolation. These flows used demo products and did not trigger paid integrations. Screenshots under docs/screenshots/ now reflect the production demo. Candidate personal verification remains separate.

## November 24 — private price tracking

Added private target-price watches, own-record read/delete, server-validated configuration changes, history charts and dated threshold alerts, acknowledgement/rearming, and a no-credit synthetic preview. Native CronRoom wakes every 15 minutes; a new PriceMonitor Durable Object shares one ASIN extraction per 24 hours, five paid starts per UTC day and twenty total. Owner consent is required to enable the initially disabled monitor; only live-approved accounts are eligible. Direct extraction caps provider charge at USD 0.005 with one result. Exa/OpenAI are not involved.

Validation: 58 unit tests / 9 files, 21 browser tests with zero skips, type checks, lint and build. New tests exercise same-ASIN concurrency, stale lease fencing, interrupted run reuse, budget exhaustion, seller changes, alert threshold/rearm semantics, shared cron updates, private watch CRUD/reload/targets/pause, non-owner activation refusal and foreign-ID/native-tool denials. The installed SDK unwrapped CronContext integration contract was inspected and tested. Mobile watch screenshot: docs/screenshots/mobile-price-watches.png.

One authorized exact-ASIN paid probe returned B0DZ75TN5F at USD 379 with seller and variant metadata; one start plus three free polls cost USD 0.02 (2 credits), within USD 0.05. Evidence: docs/live-verification/exact-asin-1795570415140/. No scheduled paid monitoring was enabled, and no additional Exa/OpenAI calls were made.

### Price-tracking release and hydration correction

The initial price-tracking release was `rel_01M885K06RM06CA707XMQF9Q1W`. A production test then exposed a prerender/hydration race: text could be entered before React connected input handlers. The fix disables search and navigation controls until hydration; an explicit slow-JavaScript production regression checks the prerendered disabled textarea, releases the JS requests and verifies synchronized editing.

The corrected release is `rel_01M8863AHAZMCAG70B9Z77Y2CG`, clean source commit `f1bddb8`. DeepSpace confirmed serving and data plane. Production private watch CRUD/isolation and the delayed-hydration regression both passed. Paid monitoring remains disabled; no scheduled paid check was activated. Production checks create/delete their own private test rows and use no paid integrations.

After the corrected release, five additional production flows passed: private comparison save/reopen/isolation, desktop demo, mobile demo, text/filter synchronization, and the synthetic no-credit alert preview. Together with private watch CRUD/isolation and the explicit delayed-hydration check, seven production checks passed. No additional paid requests were made.

## Personal price-check consent

Changed scheduled price checks from an owner-only global switch and research allowlist to verified-caller personal preferences. All authenticated accounts can opt in independently; opting out does not affect other subscribers. The old global enabled flag is ignored, so deployment does not silently enroll anyone. Shared per-ASIN caching and five/day, twenty-total spending counters remain unchanged. Unit coverage includes non-owner consent, parameter-spoofing rejection, independent settings and shared checks for accounts outside the research allowlist. Ordinary tests toggle settings only while their watchlists are empty and leave settings off; they do not invoke paid integrations.

Personal opt-in release: `rel_01M886ZEN138FPQQMWH8CP6CYM`, source commit `12df8e4`, serving/data-plane confirmed. Validation: 60 unit tests, 21 local browser tests, both type checks, lint and build passed. Two production checks passed, including personal opt-in/out by a non-owner account without changing the second account, private watch CRUD/isolation, and the delayed-hydration regression. Test accounts opted in only with empty watchlists and opted out before creating rows; no paid integration was invoked.

## Live discovery for every signed-in account

Removed the exact-user allowlist from live product discovery. Verified authentication is still required at the server action boundary; the app-wide LIVE_ENABLED switch remains available for operational pauses. Live research stays opt-in in the interface, with no automatic paid calls on login. Anonymous discovery remains rejected. Unit/transport checks cover ordinary users, anonymous rejection and cache reuse without another integration invocation. Search cost ownership and the separate shared price-monitor budget are unchanged.

Discovery access release: `rel_01M887EF8PGGQRYNAZRXGJQ7CX`, clean source commit `dffe192`, serving/data plane confirmed. All 60 unit tests and 21 local browser tests passed, together with type checks, lint and build. Two production checks passed; both ordinary accounts had an enabled Live research switch, and one switched into live mode and back without submitting a paid search. Personal alert opt-in/isolation, private watch CRUD and delayed hydration checks also passed. No paid integrations were called.
