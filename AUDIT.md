# BuySmart independent technical audit

> **Historical baseline:** this audit predates the authorized fixes. See [current finding dispositions](docs/REMEDIATION.md) and [verification](docs/VERIFICATION.md) for the corrected implementation, Apify replacement and remaining deployment boundary.

**Reviewed:** November 23, 2026 (America/Los_Angeles).  
**Scope:** the actual current checkout, including its pre-existing modified and untracked implementation files, not just commit `6bdf9ea` or the previous agent's claims.  
**Decision:** suitable for remediation and continued evaluation; **not ready to describe as a verified, deployed live product**.

No implementation was edited, no deployment/source claim was made, and **no paid integration calls were executed during this audit**. Standard test/build commands regenerated ignored runtime/build artifacts and the browser suite refreshed its screenshot artifacts. All additional defect probes were written under `/private/tmp`, outside the implementation.

## Executive assessment

The underlying architecture is sensible: a pure ranking module, shared Zod models, explicit mock/live providers, native DeepSpace authentication and private records, and a Durable Object for paid-work admission. The final weighted ranking is independent of OpenAI. The installed SDK supports the APIs used; no fabricated DeepSpace SDK method or integration endpoint was identified.

Passing checks do not establish live integration correctness. The main risks are incorrect evidence attribution influencing rankings, an unverified Amazon-dependent live flow, invalid or inconsistent saved snapshots, and production delivery still being outstanding. The existing documentation acknowledges several of these limitations honestly; acknowledgment does not complete the important live path required by the assessment.

**Findings: 21 total — 0 Critical, 3 High, 13 Medium, 5 Low.** High findings are F02, F07, and F20. Severity describes product/submission risk as well as security impact; an incomplete deployment is not labeled a security exploit.

## Evidence and verification performed

### Sources of authority

- Read the installed [DeepSpace skill](/Users/jairocespedes/Documents/Pruebas-tecnicas/.agents/skills/deepspace/SKILL.md), project `AGENTS.md`, and the actual source, configuration, tests, stored catalog schemas, and historical response fixtures.
- Read the official [documentation index](https://docs.deep.space/llms.txt), [architecture](https://docs.deep.space/concepts/architecture.md), [permissions](https://docs.deep.space/concepts/permissions.md), [external APIs](https://docs.deep.space/guides/external-apis.md), [server actions](https://docs.deep.space/guides/server-actions.md), [data storage](https://docs.deep.space/guides/data-storage.md), and [testing guide](https://docs.deep.space/guides/testing.md). For unavailable browser fetches, retrieved the Markdown directly.
- Checked installed `deepspace@0.44.2` declarations and implementation, particularly `ActionTools.integration`, confirmed mutations, JSON column serialization, and permission checks. Installed types take precedence over an older example or conflicting prose.
- Inspected the official Taskspace [Worker source](https://github.com/deepdotspace/taskspace/blob/main/worker.ts) and [schema source](https://github.com/deepdotspace/taskspace/blob/main/src/schemas.ts). Its native Worker/RecordRoom/schema organization is relevant; its older implementation is not a reason to copy obsolete SDK hooks.
- Re-fetched **free catalog metadata only** for `amazon/search-products`, `exa/search`, and `openai/chat-completion` through the installed CLI. Requests used by BuySmart match the current supported endpoint names and fields. OpenAI has no curated catalog output schema; stored actual responses establish the envelope tested here.
- Used the original assessment text supplied by the owner during this review, independently of the agent-authored `ASSESSMENT.md` submission draft.

### Commands and outcomes

Environment: Node **v24.17.0**, npm **11.13.0**, DeepSpace **0.44.2**, installed Vitest **4.1.12**, installed Vite **8.3.8**.

| Check | Result and limits |
| --- | --- |
| `npm run type-check` | Passed. `tsc --noEmit`; configured scope is `src` and `worker.ts`. |
| `npm run lint` | Passed. Only the Rules of Hooks rule is enabled; see F19. |
| `npm run test:unit` | **24 tests passed in 4 files**. |
| `npx --no-install deepspace test run all --port 5184 --json` | **24 unit tests and 14 browser tests passed, zero skips.** Includes real native authentication and two-user private save/reload/reopen/delete. |
| `npm run build` | Passed: Worker/client bundles and public-page prerender. Initial sandbox execution compiled but logged an external Wrangler-log permission error; the approved unrestricted rerun completed cleanly. |
| `npm audit --omit=dev --json` and `npm audit --json` | Both exit **1**, identifying the same **one Low esbuild advisory**; no Moderate/High/Critical advisories reported. See F21. |
| Six independent offline defect probes | **6/6 reproduced the defects**, using mocked providers, fake time, and the real application modules. Their passing assertions confirm undesirable behavior, not correctness. |
| Additional headless Chromium checks | Reproduced invalid-budget save behavior, small buttons, and long-history overflow at 390 px and 320 px; **zero paid-action/provider requests** in this extra demo journey. Inspected the newly captured mobile screenshot. |
| Client credential scan | Scanned **20 built client files** for **4 materialized credential values** read privately from `.dev.vars`: **zero matches**. Credential values were not printed. This is a targeted scan, not proof that every possible secret is absent. |
| `npx --no-install deepspace status --json` | `live: null`, `source: null`, `sourceInference: deepspace`; current worktree dirty. Confirms deployment/source are not complete. |

The `all` suite covers the smoke/API/e2e/unit subsets, so aliases were not redundantly rerun. Watch mode is interactive, not a separate finite test suite. The opt-in paid harness was inspected but deliberately not executed. No package installation, automated dependency fix, release, source push, or integration invocation was performed. Initial sandbox DNS/port failures were retried through approved escalation rather than treated as application failures.

### Independent reproductions

Temporary files available in this review environment:

- `/private/tmp/buysmart-audit-probes.test.ts` and `/private/tmp/buysmart-audit-vitest.config.mjs`: run from the project with `./node_modules/.bin/vitest run --config /private/tmp/buysmart-audit-vitest.config.mjs --reporter verbose`.
- `/private/tmp/buysmart-audit-browser.mjs`: extra demo-only Chromium checks against the audit's local port 5185; that server was stopped after inspection.
- `/private/tmp/buysmart-audit-mobile.png` and `/private/tmp/buysmart-audit-long-history.png`: extra visual evidence. These temporary files are not portable submission assets; the important inputs and outcomes are recorded in the findings below.

## 1. Architecture and separation of concerns

**Assessment:** generally good. Ranking is a small pure module; views are extracted; providers and paid-work authorization are server-side; browser-local history and account persistence have distinct adapters. The single snapshot collection is reasonable for immutable comparisons. There is no need to introduce a separate database or normalize every specification into tables for this exercise.

`BuySmart.tsx` still owns most workflow state, snapshot construction, sorting, and persistence feedback. `providers.ts` combines parsing, prompts, research, and evidence association. These are manageable at this scope, but make the state/data-boundary defects below easier to introduce. Extract targeted state/normalization functions when fixing those defects; a broad framework rewrite would add unnecessary scope.

### F01 — Switching provider mode destroys the current workspace

- **Severity:** Medium.
- **Affected file/line:** `src/pages/(app)/home.tsx:50` (toggle at line 79).
- **Problem:** the React key includes `live`, causing the entire BuySmart component to unmount whenever Live research changes.
- **Evidence:** query, products, selection, weights, and unsaved comparison state all live inside BuySmart. Changing the checkbox changes its key; a costly live result or carefully adjusted demo comparison disappears immediately, without a save/discard choice. An outstanding request is also not canceled by this remount.
- **Recommended solution:** key only by account identity for the privacy boundary. Preserve snapshot provenance separately from the selected provider; explicitly handle outstanding work and any deliberate reset.

## 2. DeepSpace SDK and native platform primitives

**Assessment:** the core SDK usage is valid. `RecordRoom`, provider placement under `(app)`, `RecordScope`, immutable app identity, required `users` schema, confirmed mutations, and record envelopes are used correctly. JSON snapshots are passed as structured values, which is correct for a JSON column. `ActionTools.integration` exists in the installed worker declarations and is implemented by the scaffold's action-tools factory. `getAuthToken`, `createConfirmed`, and `removeConfirmed` are real installed methods.

The custom ResearchGate uses a native Durable Object with manifest, binding, and migration declarations. This is justified transactional admission logic, not a replacement authentication/database service. The agent/tool definitions follow the scaffold's shared registration. In-app paid chat is not registered without the AI chat schema. The generic owner-billed integration route is blocked before the scaffold proxy handler.

There is substantial unused scaffold infrastructure for canvas/Yjs/presence/jobs/cron and settings. It increases review surface, but retaining native scaffold plumbing alone is not a correctness finding. Do not remove it indiscriminately or rebuild equivalent services. JSON-column storage does **not** automatically enforce the application Zod schema: see F08.

## 3. Amazon, Exa, and OpenAI integrations

### F02 — The core live discovery flow is not successfully verified

- **Severity:** High.
- **Affected file/line:** `src/buysmart/providers.ts:134`; `src/buysmart/live-replay.test.ts:12`; `ASSESSMENT.md:29`.
- **Problem:** live discovery requires Amazon success, but there is no retained successful Amazon result or complete successful live research flow. The revised extraction prompt also lacks a complete live success.
- **Evidence:** the replay test substitutes a mock Amazon listing and reuses a truncated OpenAI response. Historical `docs/live-verification/summary.json` records failed/refunded Amazon, successful Exa, valid intent JSON, and truncated extraction. Re-fetching the catalog confirms the adapter contract, not provider availability. This audit ran no paid requests and cannot establish success from those records.
- **Recommended solution:** after offline remediation, request approval for a precisely bounded paid verification. First capture a successful Amazon envelope, then a complete current flow with schema-valid extraction or explicitly accepted fallback. Retain sanitized request/response/error metadata. Do not claim live completion based on mocks or transport success alone.

### F03 — Research retrieval loses the user's actual requirements

- **Severity:** Medium.
- **Affected file/line:** `src/buysmart/providers.ts:173` (domain restrictions at line 180).
- **Problem:** Exa receives concatenated listing titles and a generic research suffix, without the original use case or required software. The original requirements reach extraction only after retrieval.
- **Evidence:** a Canva/CapCut/software-specific query does not put those requirements into the Exa query. The fixed domain list excludes canva.com, capcut.com, anker.com, and sennheiser.com despite supported use cases/categories. Four shared results across up to four products can be consumed by one model or brand. This creates systematic missing coverage and increases the attribution risk in F07.
- **Recommended solution:** retain a bounded, explicit requirement summary in retrieval and associate results with product identity. Use category-relevant domains or a carefully constrained broader search. Improve relevance within an approved total call budget; do not silently add four per-product paid searches.

OpenAI parameters (`gpt-4.1-mini`, `messages`, `temperature`, `max_tokens`) are supported by the DeepSpace catalog. The proxy does not advertise `response_format`, so recommending that field without platform support would be another incorrect assumption. JSON parsing safely rejects malformed/truncated output, and accepted explanations are assembled from quotations rather than unrestricted model prose. The remaining semantic gap is F07.

## 4. Integration request and response schemas

### F04 — One null Exa content field discards all usable research

- **Severity:** Medium.
- **Affected file/line:** `src/buysmart/providers.ts:36` (whole-response parse at line 171).
- **Problem:** content fields advertised as unconstrained in the Exa catalog are treated as optional strings/string arrays. Present-but-null values fail the whole response instead of becoming unavailable content.
- **Evidence:** the independent replay supplied one valid text result and one result with `text: null`, which is allowed by the catalog's `{}` text schema. The provider discarded both results, returned the research-unavailable warning, and made only three calls, skipping extraction despite usable evidence.
- **Recommended solution:** normalize provider content defensively at the adapter boundary, accept null as missing, and validate/filter entries independently. Retain safe usable results and distinguish empty content from provider failure.

### F05 — Catalog-valid listings can fail the whole search after later paid work

- **Severity:** Medium.
- **Affected file/line:** `src/buysmart/providers.ts:21`, `:143`, `:297`; downstream limit in `src/buysmart/model.ts:47`.
- **Problem:** Amazon titles are accepted without a length bound, then copied into products whose names must be at most 300 characters. That constraint is enforced only at the final return, after research/extraction.
- **Evidence:** a catalog-valid 301-character title passed the listing parser and led to four mocked integration calls, then `productSchema.parse` rejected the entire discovery. One malformed/unsafe listing can likewise fail the array parser instead of allowing valid siblings.
- **Recommended solution:** validate and normalize each listing before spending on enrichment. Deliberately truncate display titles while preserving identity/original source, or reject only the bad entry with a warning. Enforce internal invariants before subsequent calls.

Amazon's required `snapEligible` output field is safely ignored because BuySmart does not use it; this is not itself a mismatch. Rating is intentionally unknown in the catalog, and rejecting unrecognized rating representations as missing is reasonable. Additional output fields being stripped by Zod is also acceptable.

## 5. Deterministic multi-criteria ranking algorithm

**Assessment:** the weighted-sum implementation is correct for normal validated/UI inputs. Weights normalize, all-zero weights restore defaults, missing values contribute zero without redistribution, price/rating normalization is explicit, and ID tie-breaking makes normal snapshots reproducible. Coverage is kept separate from score. Budget-exact affordability being zero is a documented policy choice, not an arithmetic bug. Over-budget retention is also documented and the strict filter is separate.

AI still determines three criterion inputs. A deterministic final sum does not make those assessments objective or correct. The default weights, headroom formula, and missing-data penalty need the applicant's explanation, not claims of a scientifically validated recommendation model.

### F06 — Large finite weights overflow normalization

- **Severity:** Low.
- **Affected file/line:** `src/buysmart/ranking.ts:7`; permitted by `src/buysmart/model.ts:83`.
- **Problem:** each weight is checked for finiteness, but their sum can overflow to Infinity. Division then turns every normalized weight into zero.
- **Evidence:** `{ price: 1e308, performance: 1e308, compatibility: 0, rating: 0, features: 0 }` produces a normalized total of **0**, not 100. These finite nonnegative values pass the saved-comparison weight schema. Ordinary sliders cannot produce them, limiting exposure to stored/custom input.
- **Recommended solution:** bound stored raw weights to the UI range, or scale by the maximum positive input before summing. Assert a finite, normalized total and test large finite inputs.

## 6. Data validation, normalization, and missing information

### F07 — Exact quotations can support the wrong product and opposite conclusion

- **Severity:** High.
- **Affected file/line:** `src/buysmart/providers.ts:237`, `:257`, `:273`.
- **Problem:** accepted evidence is checked only for URL membership and literal substring presence. There is no enforced product/variant association or factual compatibility between quotation and score. The model can attach any known source to any listing and select an arbitrary score.
- **Evidence:** the offline probe returned listing **Tablet A**, an actual source excerpt **“Tablet B cannot run the required desktop software.”**, and compatibility **100** for `listing-0`. The provider accepted the quotation, assigned Tablet A a perfect compatibility value, and placed the negative quotation in its **strengths**. The deterministic ranker then trusts that value. Prompt instructions requesting relevance do not enforce it.
- **Recommended solution:** associate sources with normalized product/model/variant identity before extraction. Prefer structured, verifiable facts and explicit requirement states (`supported`, `unsupported`, `unknown`) with deterministic criterion mappings. Do not accept a free-form model score merely because its quote exists. Treat ambiguous identity or unsupported reasoning as unknown; retain reviewable provenance and adversarial tests. Exact product-name substring checks alone will not solve variant or semantic errors.

### F08 — Saved snapshots have no complete server-side application validation

- **Severity:** Medium.
- **Affected file/line:** `src/schemas/comparisons-schema.ts:6`; `src/pages/(app)/home.tsx:59`; `src/buysmart/model.ts:77`.
- **Problem:** the native schema requires a JSON snapshot but does not enforce its BuySmart shape. The account save path does not parse `comparisonSchema`; loading silently hides invalid records. The Zod schema itself permits invalid dates, duplicate/empty product IDs, unconstrained query/explanation lengths, out-of-search-range budgets, and unbounded weights.
- **Evidence:** installed SDK JSON coercion serializes values; it does not call BuySmart's Zod validator. The offline probe successfully parsed a snapshot with `createdAt: 'not-a-date'`, empty ID/query, duplicate product IDs, and budget `1e308`. The loader returns `[]` for invalid snapshots through `flatMap`, leaving such rows inaccessible through History while still stored. Native record tools are another allowed write surface, so browser-only validation cannot establish the invariant.
- **Recommended solution:** share a versioned, bounded snapshot schema with unique stable IDs, valid timestamps, coherent budgets/weights, source references, and size limits. Validate before saving and enforce the application invariant at the server write boundary for every permitted writer. If using a save action, check ownership explicitly because actions bypass record RBAC; otherwise use an appropriate supported RecordRoom validation extension. Surface invalid/legacy records with recover/delete handling instead of silently dropping them. Native `own` permissions should remain.

### F09 — Editable budget corrupts snapshot consistency and save behavior

- **Severity:** Medium.
- **Affected file/line:** `src/buysmart/BuySmart.tsx:82`, `:125`, `:317`; native save at `src/pages/(app)/home.tsx:59`.
- **Problem:** results retain the searched query/category, but ranking and save use the currently edited budget, including invalid values. Save validates neither current budget nor the assembled snapshot on the account path.
- **Evidence:** after a valid $350 demo search, clearing Maximum budget sets state to **0**, changes the first score from **63.6 to 62.1**, and leaves Save enabled. Demo save fails with **“Could not save. Check your connection or browser storage and retry.”**, despite storage working. By source inspection, native save instead sends the zero-budget snapshot, can acknowledge it, then the loader in F08 rejects it. The native invalid-save consequence is a code-path deduction, not an additional live-account test. Controls also remain editable during research, allowing request/result budget mismatch.
- **Recommended solution:** distinguish draft search inputs from the validated result snapshot. Commit budget changes deliberately or provide an explicit validated local budget adjustment. Parse the assembled comparison before both persistence adapters; show field-specific errors and prevent invalid saves. Define how edits during a request affect the returned snapshot.

### F10 — Malformed comma grouping becomes a valid price

- **Severity:** Low.
- **Affected file/line:** `src/buysmart/providers.ts:54`.
- **Problem:** the numeric pattern accepts arbitrary comma placement, then removes every comma.
- **Evidence:** `parsePrice('$1,2,3')` returns **123** rather than missing. The parser is consequently less strict than the stated unambiguous-price policy. Currency/range rejection and missing prices otherwise behave correctly.
- **Recommended solution:** accept either ungrouped digits or correctly grouped thousands with an optional two-digit decimal, then parse and bound the result. Test malformed separators and international formats as unavailable.

## 7. Authentication, authorization, and data isolation

**Assessment:** no cross-user read/write bypass was demonstrated in the reviewed BuySmart paths. Verified JWT identity reaches the discovery action, live access requires both an exact server allowlist and enable flag, and the client cannot select the billed account. Native `createdBy`-based `own` permissions apply to read/update/delete for all signed-in roles, including admin. Anonymous comparison access is denied. Two-user tests passed, and the installed permission engine tests deny another user's read/update/delete. Confirmed mutations are used correctly.

The discovery action does not use RBAC-bypassing record tools, so there is no missing ownership check there. Native agent record tools remain subject to SDK RBAC. React text rendering and HTTP(S)-only links avoid the obvious HTML/javascript URL injection path. These findings are not a penetration-test guarantee; adversarial wire-level authorization tests remain incomplete (F18).

### F11 — The advertised request cap is checked after fully buffering unknown-length bodies

- **Severity:** Medium.
- **Affected file/line:** `src/server/action-routes.ts:65`.
- **Problem:** a small or absent Content-Length reaches `c.req.text()`, which reads the entire body before the length check. The later check counts JavaScript characters, not bytes.
- **Evidence:** the early guard only evaluates the optional header; line 66 unconditionally buffers remaining bodies. An authenticated caller can therefore consume substantially more than 4 KB of memory before rejection. A 4,096-character Unicode body can also exceed 4,096 bytes without that second guard noticing. No large-body denial-of-service request was sent during this review.
- **Recommended solution:** enforce a streaming byte limit using a supported bounded-body helper/middleware before buffering/parsing; keep a header precheck as an optimization. Test missing Content-Length, chunked input, Unicode bytes, and boundary cases. Paid authorization should still fail closed.

## 8. Credits, caching, rate limiting, and duplicates

**Assessment:** important controls are present: an authenticated/allowlisted action, blocked generic paid proxy, transactional admission, per-user hashed cache keys, two uncached attempts per UTC day, eight attempts per lifetime, pending deduplication, bounded result/token counts, and no automatic paid retry. Failed attempts count deliberately. Cache hits precede quota checks, so already cached results remain available after exhaustion. Reweighting/reopening does not call providers. These bound call counts, not a guaranteed dollar spend; the README correctly distinguishes those concepts.

### F12 — Expired reservations have no ownership token for completion

- **Severity:** Medium.
- **Affected file/line:** `src/buysmart/ResearchGate.ts:28`, `:44`, `:51`; `src/actions/index.ts:45`.
- **Problem:** after a pending entry expires, another attempt can reserve the same key, but old `finish` or `fail` operations still overwrite/delete that new attempt's state.
- **Evidence:** the fake-time probe reserved a key, advanced 16 minutes, reserved it again, and then finished the first request. The next reserve returned the **stale first result** as cached, although the second attempt was still outstanding. Old `fail` similarly deletes the new lock. There is no lease ID checked by finish/fail and no orchestration deadline guaranteeing the first request has ended.
- **Recommended solution:** return a unique reservation token; transactionally allow finish/fail only for the matching current token. Set bounded provider/action deadlines shorter than the lease and test expiry, stale completion, stale failure, and simultaneous reservations on a real Worker storage transaction.

### F13 — Eight failed/uncached attempts permanently disable new live research

- **Severity:** Medium.
- **Affected file/line:** `src/buysmart/ResearchGate.ts:3`, `:34`.
- **Problem:** the lifetime counter never resets and has no supported owner management/remaining-quota UI. Across users and days, the ninth uncached search is permanently unavailable without a code/storage intervention, even if all eight failed upstream.
- **Evidence:** existing tests explicitly confirm all eight failed attempts count and the ninth is limited. The counter is durably stored separately from per-day usage. Increasing the constant can change the ceiling, but deploy/restart alone does not replenish it. This is a documented deliberate development fuse, not a hidden arithmetic error.
- **Recommended solution:** retain the conservative fuse until the owner approves a live operating budget. For evaluation, make the remaining allowance and exhaustion state explicit and provide a deliberate owner-controlled reset/window policy with attribution. Do not silently remove limits or auto-replenish paid usage.

Cache limitations to account for in remediation: degraded results are cached for 24 hours; cache keys have no parser/prompt version; immutable saved snapshots have no separate provider-fetch timestamp. Those are acceptable only as explicit policies, with clear freshness/retry messaging. Current lifetime limits also bound retained gate entries, so it would be inaccurate to claim unbounded cache growth in this configuration.

## 9. Mocking strategy and live configuration

**Assessment:** fixtures are clearly labeled illustrative, not current offers. Public `/` mounts no account/data providers and spends no credits. `/home` uses native accounts, while provider selection defaults to demo. Server configuration has `LIVE_ENABLED = "false"` and an empty allowlist; a checkbox cannot override that. Provider credentials stay server-side. Synthetic Google search references are honestly labeled, not claimed as verified source documents.

The demo is a category-based fixed catalog: it does not understand free-text requirements or change its subjective evidence with the query. That is acceptable for an explicitly illustrative demo, but does not verify live relevance. The paid harness is separately excluded from normal unit discovery and has an opt-in guard/call ceiling. Do not run it as part of an unapproved remediation test cycle. F01, F02, F03, and F18 cover the remaining mode/configuration and mocking risks.

## 10. UI responsiveness, accessibility, and usability

Normal desktop and 390 px demo journeys pass; comparison content scrolls within its table container. Fields generally have labels, errors/status use live-region roles, remove/delete buttons have accessible names, and keyboard focus outlines exist. The visual inspection confirms the normal mobile comparison layout is usable. These checks do not establish full accessibility compliance.

### F14 — Long saved requirements break mobile history layout

- **Severity:** Medium.
- **Affected file/line:** `src/buysmart/HistoryList.tsx:21`; `src/buysmart/buysmart.css:665`, `:680`.
- **Problem:** history flex children have no `min-width: 0`/robust word wrapping for a permitted long unbroken query.
- **Evidence:** replacing a saved query with `'A'.repeat(500)` (within the search input's supported length), then opening History produced document `scrollWidth = 4745` at **390 px** and **320 px** viewport widths. Reopen/delete are pushed out of the usable mobile area. This is layout overflow, not HTML execution.
- **Recommended solution:** constrain shrinking flex children, wrap long text with `overflow-wrap: anywhere`, and let actions wrap or use a stable responsive action layout. Test populated history with long queries at narrow widths and zoom, not only the empty history state.

### F15 — Tiny action targets and unannounced workspace changes impede accessibility

- **Severity:** Medium.
- **Affected file/line:** `src/buysmart/ComparisonTable.tsx:27`; `src/buysmart/buysmart.css:624`; `src/buysmart/BuySmart.tsx:191`.
- **Problem:** comparison-remove buttons are icon-sized, and page changes/active navigation are conveyed visually without an explicit active-state attribute or heading focus transition.
- **Evidence:** Chromium measured remove buttons at **14 × 14 CSS px** and Reset at **32 × 18 px**. The navigation uses only `className="active"`; page state replaces content while the clicked button retains focus. There are no automated keyboard/screen-reader checks for this transition. Small dimensions establish a usability concern; spacing exceptions mean dimensions alone are not a complete formal WCAG determination.
- **Recommended solution:** expand hit areas with padding/minimum sizing, provide explicit active navigation semantics, and manage focus or announce substantial workspace changes. Add table caption/header relationships where helpful, test keyboard access to horizontal scrolling, and respect reduced-motion preferences for skeletons. Verify with both automated accessibility checks and manual keyboard review.

## 11. Error handling and edge cases

### F16 — Paid research has no bounded application deadline or cancellation propagation

- **Severity:** Medium.
- **Affected file/line:** `src/pages/(app)/home.tsx:20`; `src/server/action-routes.ts:130`; `src/buysmart/providers.ts:68`.
- **Problem:** browser action fetch and sequential integration calls supply no timeout/abort signal. Navigating away or changing modes does not explicitly cancel the application orchestration, and a stalled provider can leave the UI researching indefinitely or continue work after the result is no longer wanted.
- **Evidence:** IntegrationCall accepts endpoint/body only; the action tools' `apiWorkerFetch` receives no signal. The frontend has no AbortController/deadline. ResearchGate releases pending protection based on time rather than confirmed termination, interacting with F12. Upstream infrastructure may impose its own limits; that does not establish an application deadline or safe cancellation policy.
- **Recommended solution:** use bounded per-step/overall deadlines, propagate cancellation where the installed API supports it, and check cancellation before later paid steps. Do not automatically retry a paid call after an ambiguous timeout. Settle the reservation safely and give a recoverable, accurate status.

### F17 — Provider failures lose actionable diagnostic context

- **Severity:** Low.
- **Affected file/line:** `src/buysmart/providers.ts:71`, `:204`, `:291`; `src/actions/index.ts:73`.
- **Problem:** most upstream codes/status/issues are discarded, and enrichment/extraction catches produce generic warnings without a structured server-side diagnostic. Admission/cache failures outside the try can also become generic 500s; a failed cleanup request can mask the original error.
- **Evidence:** `invoke` preserves only the insufficient-credit distinction; the Exa/extraction catch blocks capture no error variable. The historical Amazon failure already lacks its detailed upstream envelope. That historical omission is evidence of the diagnostic gap, not evidence of a particular Amazon root cause.
- **Recommended solution:** attach a request ID and log bounded, sanitized stage/endpoint/code/status/validation-path details server-side. Preserve safe machine codes in app errors, handle gate failures explicitly, and make cleanup best-effort without masking the first failure. Never log tokens, secrets, or full sensitive prompts by default.

The current malformed-JSON rejection, insufficient-credit stop, Exa fallback, local-storage exception handling, loading/empty displays, and confirmed-write feedback are useful. Empty results currently reuse budget-filter wording even when nothing was found; image load failure also has no fallback. Treat these as small follow-ups alongside the error-state work. A zero-score/tied shortlist should avoid implying a substantively established winner when evidence is absent.

## 12. Automated test quality and coverage

### F18 — Passing tests leave critical integration and security boundaries unexercised

- **Severity:** Medium.
- **Affected file/line:** `src/buysmart/core.test.ts:315`; `tests/journey.spec.ts:59`; `tests/collab.spec.ts:34`; `src/buysmart/live-replay.test.ts:12`.
- **Problem:** tests cover useful normal paths but do not substantiate the full reliability implied by their count or names.
- **Evidence:** gate tests use a plain Map whose `transaction` just invokes a callback, run sequentially, and have no expiry/restart/concurrency assertions. Browser overflow is asserted after all history entries are deleted, so populated-history overflow escapes. Isolation tests show B cannot see A's row in the UI, but do not send forged get/update/delete requests for a known foreign ID. Provider mocks return ordered envelopes without asserting outbound bodies against the catalog. The only historical flow replay mocks Amazon and expects malformed extraction. The six extra offline probes reproduce defects while all 24 existing unit tests pass. No numerical coverage threshold/report is configured.
- **Recommended solution:** add targeted regression cases for the findings, authenticated disabled/allowlist action tests, request-contract assertions from catalog fixtures, and direct foreign-ID denial tests. Exercise ResearchGate concurrent admission/expiry/fencing on a native Worker or a faithful transactional harness. Assert populated responsive states and native invalid-save behavior. Use mocked transports for all routine provider tests; keep paid validation opt-in. Avoid padding the suite with assertions that merely mirror implementation.

### F19 — Lint/type/build checks have narrower scope than a quality gate suggests

- **Severity:** Low.
- **Affected file/line:** `eslint.config.js:35`; `tsconfig.json:19`; `package.json:15`, `:24`.
- **Problem:** lint enables only Rules of Hooks, TypeScript excludes root/config/scripts/browser specs, and the build has lint checking but no explicit TypeScript check. Unit scripts accept no tests as success. There is no repository CI definition tying the checks together.
- **Evidence:** read the exact ESLint/TypeScript/Vite configs. `vite-plugin-checker` is configured only for ESLint. Existing manual type/unit/build checks all pass, so this is a future-regression protection gap, not a current compile error.
- **Recommended solution:** provide one finite pre-release command/CI job for scoped type checks, meaningful lint, unit/browser tests, and build. Add an appropriate Node/test config type-check without mixing Worker/browser globals. Remove `--passWithNoTests` once the suite is established. Adopt a modest relevant lint baseline; avoid a sweeping unrelated style rewrite or assuming GitHub hosting is required.

## 13. Deployment readiness

### F20 — Required deployed URL and releasable repository state are outstanding

- **Severity:** High.
- **Affected file/line:** `README.md:158`; `ASSESSMENT.md:42`; `wrangler.toml:1`.
- **Problem:** the assessment requires a working deployed full-stack app and repository, but the application has no confirmed live deployment and the reviewed implementation is not captured in a clean release commit/source state.
- **Evidence:** independent CLI status returned `live: null`, `source: null`, and a dirty worktree; Git has only the initial commit plus existing implementation changes/untracked files. A successful local Worker/client build cannot verify production assets, auth callbacks, DO persistence, account isolation, platform bindings, or public evaluation access. This was an intentional owner approval boundary, not an unauthorized omission to fix during audit.
- **Recommended solution:** after reviewing/approving remediation, retain a clean reviewed release commit, choose/confirm the native source workflow, deploy only after authorization, and verify the returned URL on its important paths. Check public demo, sign-in, private save/reload/reopen/delete, two-user isolation, assets/headers, live entitlement/quota messaging, and logs. Submit the accessible repository and exact live URL with an honest short note. Do not claim `buysmart.app.space` is owned/serving until the platform confirms it.

### F21 — Locked transitive esbuild version has a published Low advisory

- **Severity:** Low.
- **Affected file/line:** `package-lock.json:5255`; dependency introduced through `package.json:36`.
- **Problem:** the lock resolves `esbuild@0.27.7`, within the advisory's affected range, through DeepSpace and Vite.
- **Evidence:** both npm audit commands report one Low issue, [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr). `npm ls esbuild --all` confirms 0.27.7 under DeepSpace/Vite and separate patched 0.28.2 instances under Wrangler. The advisory concerns the esbuild development server on **Windows**, not an established production Cloudflare exploit or this macOS review environment.
- **Recommended solution:** follow DeepSpace's supported update guidance and resolve compatible tooling to a patched esbuild (0.28.1+ for this advisory); rerun relevant checks. Do not use an unreviewed force-upgrade or silently change SDK versions during this audit. Keep Windows development servers restricted until updated.

The target credential values were absent from client assets, and `.dev.vars`, `.deepspace`, and build output are ignored/untracked. Build output does contain a Worker-side `.dev.vars`; publish only through the platform deployment process, not by uploading the entire dist tree as public assets. No evidence establishes that those Worker secrets are publicly served.

## 14. Compliance with the internship assessment

The owner-supplied brief is the requirements authority. Its deadline is **Wednesday, November 25, 2026 at 11:59 PM Eastern**, equivalent to **8:59 PM America/Los_Angeles**. This audit does not infer a deadline from host UTC timestamps.

| Requirement | Independent assessment |
| --- | --- |
| Focused, finished full-stack application with technical depth | Substantial local core: discovery, deterministic comparison, native private persistence. Scope is credible; live evidence correctness and delivery remain incomplete (F02/F07/F20). |
| Build and deploy on DeepSpace | Native SDK/Worker/DO implementation is present and builds. **Deployment/live URL requirement is unmet.** |
| Useful integrations and explained tradeoffs | Three real supported adapters exist; Amazon discovery, Exa research, OpenAI intent/extraction have defensible roles. Their complete live interaction has not passed. |
| Understandable code, protected secrets, native primitives | Generally met in reviewed normal paths, with validation, spend-lifecycle, and test gaps detailed above. No need for an external database/auth service. |
| Explain what the agent did and what the applicant verified | Draft distinguishes those categories honestly. Applicant's personal review/verification is still explicitly pending; this independent agent audit does not count as the applicant personally verifying the app. |
| Read official examples and make a focused app | Development log claims example review; this audit independently inspected Taskspace source. Originality/commercial value is not a selection requirement. |
| Submit live URL, repository, short note in portal | Pending F20. The draft can inform the note but should be edited to reflect actual applicant verification and remaining limitations. No submission was made here. |

**Integration-count ambiguity:** the brief first says there is no minimum count, while its later “helpful project bar” says to use at least three. Treat three as the conservative target until clarified; BuySmart already contains three adapters, so adding a fourth would not improve compliance. Counting three source files is not proof that three integrations work on the deployed important path. Avoid expanding project size simply to satisfy an assumed numeric scoring rule.

The assessment values sound judgment and explanation. Explicitly disclosing shallow research, synthetic fixtures, unverified live work, and agent contributions is appropriate. It does not replace shipping and personally understanding the important path.

## Prioritized remediation plan for owner review

No items below have been implemented or authorized by this report.

### Priority 1 — Correctness before enabling live research

1. **F07/F03:** enforce product/variant evidence association and explicit requirement states; preserve requirement context in bounded retrieval. Add contradictory/cross-product evidence regressions first. Acceptance: unrelated or contrary quotes cannot produce a perfect fit or a positive strength without a validated factual mapping.
2. **F08/F09/F01:** define a versioned snapshot invariant, validate all saves, separate draft inputs from result inputs, and preserve workspace state across mode changes while resetting on account identity changes. Acceptance: invalid budget cannot be acknowledged as a successful hidden save; reopening reproduces the saved snapshot; mode changes preserve costly results and privacy.
3. **F04/F05/F10:** normalize each provider item before enrichment and handle nullable/invalid optional content. Acceptance: one bad listing/result does not discard good siblings or trigger avoidable downstream paid work.
4. **F12/F16/F11:** add lease tokens, bounded orchestration/cancellation, and streaming byte-limited action requests. Acceptance: stale finish/fail cannot affect a new reservation; oversized/chunked bodies are rejected before full buffering; ambiguous paid timeouts are not retried automatically.

### Priority 2 — Make the evaluation path robust

5. **F14/F15:** repair long-history wrapping, touch targets, active navigation/focus, and keyboard table access. Test populated desktop/mobile/history/error states.
6. **F18/F19/F06:** add focused contract, concurrency, boundary, and adversarial authorization regressions; strengthen the finite release-check command. Fix numeric overflow as part of schema/ranking boundaries. All routine tests must remain zero-credit.
7. **F13/F17:** make quota state and owner operations explicit; retain sanitized provider diagnostics and distinct cache/degraded-result policy. Owner must approve any change increasing available paid usage.

### Priority 3 — Approved live verification and delivery

8. **F02:** present the owner with a concrete bounded paid test plan and expected cost range, then obtain approval before invocation. Validate Amazon first and the revised complete chain second; retain sanitized evidence and inspect whether sources actually concern the returned variants. Do not treat a response's HTTP success as content success.
9. **F21:** resolve the Low tooling advisory through a compatible supported update, then run the release checks once on the final reviewed state.
10. **F20:** after deployment approval, capture a clean commit and native source release, deploy, and verify the actual HTTPS URL and private account journey. Have the applicant perform and describe their own verification. Finish the portal note with real remaining limitations, the repository, and live URL before the stated deadline.

If time is constrained, prioritize a reliably working, honestly scoped important path over more categories, integrations, collaboration features, or infrastructure. Do not enable unverified paid research just to make the interface appear complete.
