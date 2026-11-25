# Development log

## Phase 1 — inspect and establish the native workflow

- Empty starting directory; read the parent-installed `.agents/skills/deepspace/SKILL.md` and generated app `AGENTS.md`.
- Read the official docs index/corpus, architecture, permissions, server actions, integrations, source/deployment workflow; inspected the official Taskspace worker example. Installed SDK declarations resolve version differences.
- Scaffolded `buysmart` with DeepSpace 0.44.2 using Node 24.17/npm 11.13. Checked the selected CLI identity, feature catalog, and exact integration schemas/prices. Registered the app using `app init`; the official CLI created the initial commit.
- Network access was unavailable in the sandbox, so authorized escalated commands fetched dependencies/docs and started the native runtime. No paid calls in this phase.
- Architecture/decisions: see `docs/IMPLEMENTATION_PLAN.md`.

## Phase 2 — complete the free product workflow

- Added typed runtime schemas, four category fixture sets, deterministic scoring, and browser-local history.
- Built discovery, product cards, results sorting/filtering, comparison selection, score/contribution/coverage table, sliders, recommendation reasoning, research disclosure, save/reopen/delete.
- Created a restrained white/navy/emerald responsive design. Demo prices/specifications/ratings/assessments are explicitly synthetic.
- Decisions: missing evidence contributes zero, never hidden by reweighting; unknown prices do not pass the strict budget filter. Over-budget alternatives remain visible unless filtered.
- Checks: TypeScript and lint. Later tests found and fixed a URL-refinement crash for empty images; dollar display preserves cents.

## Phase 3 — native private data and real adapters

- Retained scaffold auth/record provider boundaries and JWT-verified actions. `comparisons` uses owner-only read/update/delete even for admins. Writes use confirmed acknowledgments.
- Implemented Amazon/Exa/OpenAI through official `tools.integration`. Runtime validates envelopes/LLM JSON and accepts only known-source exact quotations; model prose is not displayed as established evidence.
- Added a native durable ResearchGate: atomic admission, user-scoped 24-hour caches, pending deduplication, two daily attempts/user and eight lifetime attempts/app. Generic direct integration spending is blocked.
- Live mode ships disabled plus an exact account allowlist; no external evaluator provider accounts/keys required.
- Corrected a native-only `callAction` import to the documented browser `getAuthToken`/fetch pattern after type checking.

## Phase 4 — unit, browser, auth, and bounded live verification

- Unit tests cover ranking/weights/budget/missing data/dedup, model validation, integration failures, cache/admission, serialization, and actual installed SDK owner checks.
- Playwright verifies the full desktop/mobile demo journey and no paid requests during reweight/reopen. Screenshots reviewed visually; no page overflow or JS errors observed.
- Created two native test accounts with privately generated credentials. Verified private account save → reload → reopen → delete and second-user nonvisibility. Official full runner passed 14 browser tests, no skips. Real-response replay brings unit total to 23 before final review additions.
- User approved exactly Amazon ×1, Exa ×1, OpenAI ×2. Intent OpenAI call succeeded and parsed. Amazon failed and refunded; no retry. Completed the separately approved Exa and second OpenAI calls. Exa returned Apple/Adobe evidence. Second OpenAI transport succeeded but 800-token probe output was truncated JSON; replay safely rejects it. Compact application extraction prompt updated without another paid call.
- Actual ledger: $0.01164124 net (1.164124 credits), 498.835876 credits remaining. No purchases/upgrades. Detailed Amazon failure response was not captured by the initial harness; failure retention was added for future explicitly approved runs.

## Phase 5 — polish and handoff preparation

- Extracted reusable ProductCard, WeightsPanel, ComparisonTable, and HistoryList views. Added source/pricing/catalog evidence, screenshots, README and assessment draft.
- Final type/lint/unit/browser/build and client-credential scan are recorded in `docs/VERIFICATION.md` once complete.
- Deployment is not authorized yet. Live mode remains off. Successful Amazon verification and production verification are open items, not silently treated as complete.


## November 23, 2026 — independent audit remediation

Replaced exhausted SerpAPI-backed Amazon discovery with the tested native Apify integration. Retained structured price/ASIN/variant/seller/stock/provenance; added free bounded polling and known-run resume. Completed server-side immutable-save validation, direct-write denial, token-fenced reservations, quota visibility/owner reset, cancellation/deadlines, result/draft separation, mode preservation, mobile and accessibility fixes. Removed model numeric scores from live ranking; added model-family/literal-quantity checks and exact-ASIN listing specs. Resolved the esbuild advisory without changing SDK 0.44.2.

The four authorized paid invocations were original Amazon (failed/refunded), one successful Apify job, one Exa search and one OpenAI extraction. Exa/OpenAI reused the completed Amazon job. Total remediation test cost USD 0.05898864; balance 492.937012 credits. No paid retries. The final identity refinement was replay-tested against the actual responses. Current checks and finding dispositions live in docs/VERIFICATION.md and docs/REMEDIATION.md. Native two-user adversarial record requests are denied. No deployment, Git source claim, commit, or portal submission was made.
