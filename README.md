# BuySmart

**Find what fits. Know why.** An electronics comparison app built on DeepSpace: discover real Amazon offers, inspect source evidence, adjust priorities, and save private comparison snapshots.

## Current status

Amazon discovery now uses **Apify through DeepSpace**. The original `amazon/search-products` route failed because its upstream SerpAPI account had exhausted searches; retrying that endpoint cannot fix the provider quota. A paid Apify probe successfully returned three iPad A16 128GB variants at USD 379 each, including ASIN, stock, seller, and variant metadata. Those are dated observations, not current checkout guarantees.

The current provider chain was verified using that completed Amazon run plus one fresh Exa search and one fresh OpenAI completion. Both succeeded; JSON was complete. The final identity-normalization refinement was verified by replaying those actual responses without further spending. Native auth, private history, and adversarial two-account requests are tested locally. **Live at https://buysmart.app.space**, with production verification of private persistence and isolation. A subsequent twelve-candidate search and exact-ASIN price probe also succeeded; evidence and costs are in docs/VERIFICATION.md.

## Product flow

- `/`: explicitly labeled illustrative demo; no auth/data connection or paid calls.
- `/home`: native sign-in, private account history, demo by default, and a Live research toggle available to every authenticated user.
- A deliberate live search starts one bounded Apify Amazon extraction, polls its free status endpoint, researches with Exa, then extracts cited specifications with OpenAI.
- Up to four offers show USD price, exact ASIN/variant, stock, seller, observation time, shipping availability and tax exclusion. Price/stock may change; verify the original listing and checkout total.
- Compare, reweight, save, reopen and delete. Reweight/reopen uses the stored snapshot and makes no provider calls.
- Switching provider mode preserves existing work. Editing draft search inputs does not rewrite an existing result's budget or provenance.

## Integrations and cost controls

| DeepSpace endpoint | Purpose | Limits |
| --- | --- | --- |
| `apify/run-actor` | Amazon products using `junglee/amazon-crawler` | Server-pinned actor; twelve candidate items; one search page; USD 0.075 provider cap; 60-second actor timeout; no seller/offer/variant fan-out |
| `apify/get-run` | Poll and settle the existing extraction | Free endpoint; at most 45 polls, bounded by a 75-second polling deadline; never starts another extraction |
| `exa/search` | Manufacturer/review research including the original requirements | Four results, bounded excerpts, relevant domains |
| `openai/chat-completion` | Compact specification extraction | `gpt-4.1-mini`, 2,000 output tokens, literal quote and model checks; no AI ranking values |

All calls are developer-billed, server-side, and gated by a verified JWT. The generic browser integration proxy is blocked. No provider API keys are required in the browser.

ResearchGate, a native Durable Object, transactionally prevents duplicate concurrent searches and retains user-scoped cached responses for 24 hours; keys include a provider/policy version. There are no daily per-user or cumulative app search caps. New uncached research consumes integration credits; live access is available to all authenticated accounts.

Reservations have unique lease tokens. Stale completion/failure cannot overwrite a newer attempt. Once an upstream run ID is known it is persisted; a deliberate repeated search can resume that extraction after a disconnect/timeout instead of starting it again. Original observation timestamps survive resume. An ambiguous failure before receiving a run ID cannot be made exactly-once without upstream idempotency support; there is no automatic paid retry.

Per-integration request timeouts and a 120-second action deadline bound waiting; browser cancellation is forwarded. The pending lease is three minutes. Canceling an HTTP request cannot retroactively cancel or refund an already accepted upstream job; its actor timeout and spend cap still apply. Actual billing settlement may require a later status read if the request was interrupted.

**The Apify cap applies to provider charges, not the final DeepSpace bill.** In the verified three-item example the provider reported USD 0.012 and DeepSpace charged USD 0.048 (4.8 credits) on the account's current tier. The runtime twelve-candidate cap is USD 0.075 upstream; its paid variety probe cost USD 0.176 after settlement. Exa/OpenAI are variable-cost; app limits bound calls, not an exact dollar ceiling.

## Scoring and evidence policy

The pure TypeScript engine computes a normalized weighted sum. Defaults: affordability 25%, performance 25%, fit 25%, customer rating 15%, features 10%.

- Affordability: `clamp((1 - price / budget) * 100, 0, 100)`. A price exactly at budget gets zero headroom points.
- Rating: `rating / 5 * 100`.
- Missing criteria contribute zero, without redistributing weights. Coverage counts available criteria separately.
- All-zero weights restore defaults. Scaling before summation prevents finite-weight overflow. Ties use stable IDs and the UI discloses tied leaders.
- Over-budget and unknown-price offers remain visible unless strict budget filtering is selected.

Demo criterion assessments are synthetic. **Live performance, compatibility and feature scores remain unavailable** until reliable criterion-specific rules exist. Literal quotations cannot establish that a model's opinion is correct, so OpenAI cannot set numeric ranking inputs or fabricate strengths. Available offer price/rating alone contribute to live scores. This means a live score is not a complete quality/compatibility verdict.

Structured listing specifications come from the exact ASIN. Additional AI-extracted values must occur literally in accepted source quotes, match model/generation identity and agree with explicit capacity/size information where present. Ambiguous associations are omitted. Source excerpts are untrusted React text, not HTML. Human review is still necessary for software compatibility and exact variants.

## Native persistence and validation

`comparisons` stores versioned bounded JSON snapshots; the required native `users` schema is retained. Saving goes through `saveComparison`, which validates shape, unique IDs, dates, weights, budget, text/size limits and creates a fresh row under the verified caller. Client-chosen ownership is never forwarded. Direct native creates and updates are denied for all roles; snapshots are immutable. Native owner-only reads/deletes remain enabled, including confirmed delete acknowledgments. Invalid legacy snapshots are visible as recoverable deletion controls rather than silently disappearing.

The public demo stores up to 30 snapshots in browser storage. Account data stays separate; there is no automatic migration of device-local history.

## Code map

| Area | Source |
| --- | --- |
| UI workflow and result/draft boundary | `src/buysmart/BuySmart.tsx` |
| Offer cards, provenance, comparison and history | `ProductCard.tsx`, `OfferDetails.tsx`, `ComparisonTable.tsx`, `HistoryList.tsx` |
| Types and runtime invariants | `src/buysmart/model.ts` |
| Pure ranking | `src/buysmart/ranking.ts` |
| Pinned marketplace adapter | `src/buysmart/apify.ts` |
| Research and extraction | `src/buysmart/providers.ts` |
| Validated actions and admission | `src/actions/index.ts`, `ResearchGate.ts`, `src/server/action-routes.ts` |
| Native schema/account boundary | `src/schemas/comparisons-schema.ts`, `src/pages/(app)/home.tsx` |

## Development and checks

Supported Node: 22.15+, 24 or 26; npm 11.6+. Verified with Node 24.17.0 and npm 11.13.0. DeepSpace remains pinned to 0.44.2. A scoped esbuild 0.28.2 override resolves the published development-server advisory; CLI tests and builds verify compatibility.

```sh
npm ci
npx deepspace auth whoami --json
npx deepspace dev start --port 5182
```

Use the already registered app ID. The CLI materializes `.dev.vars`; do not hand-edit or commit it.

```sh
npm run validate
npx deepspace test run all --port 5184 --json
npm run build
npm audit
```

`npm run check` combines the finite release checks. Type checking includes Worker/client source and a separate tooling/test config. Lint checks hooks and focused correctness rules. Routine provider tests use recorded responses or mocked external transport and consume no credits. The browser suite includes native private CRUD and foreign-ID denial, 320/390px views, preserved result budgets/mode changes, and recorded live offer provenance.

The separately configured `scripts/live-verification.test.ts` is opt-in, requires owner approval, caps paid calls, records evidence, and never retries paid operations. It supports resuming an existing upstream run with its original observation timestamp. Do not enable it during ordinary tests.

See `docs/VERIFICATION.md` for evidence and costs, `AUDIT.md` for the historical independent review, and `docs/REMEDIATION.md` for the finding-by-finding disposition.

## Deployment and assessment

The app is deployed at https://buysmart.app.space with GitHub source (jacespedes2019/buysmart). Commit and push reviewed changes, then deploy with `npx deepspace deploy`; the release ships the local working tree. HTTPS serving, desktop/mobile demo journeys, private persistence and two-user isolation have been verified in production. Do not publish the entire local dist tree as static assets: Worker-side `.dev.vars` is a local ignored artifact.

The assessment deadline supplied by the owner is November 25, 2026 at 11:59 PM Eastern (8:59 PM Pacific). The applicant must personally verify and explain the work, edit the submission note, and supply the live URL and repository. Agent testing is not personal candidate verification. See `ASSESSMENT.md`.

Color variants are grouped after marketplace normalization when the listing declares its color and other configuration attributes. Matching titles with only that color removed and identical remaining attributes produce one result: prefer in-stock offers, then the lowest price, then ASIN for ties. Capacity, connectivity and warranty differences remain separate. The selected price, URL and metadata always belong to the same offer. Missing variant metadata is not guessed. Up to twelve candidates are collected before grouping; up to four configurations are selected, preferring prices within the supplied budget while retaining marketplace order within price buckets. There is no per-brand cap. Fewer than four configurations produce an explicit warning, never an additional paid search. Existing saved snapshots remain unchanged.

Marketplace keywords use deterministic English/Spanish cleanup for common budget/use-case phrases, retaining model codes and capacity/connectivity terms. For example, “A tablet under $2000 for a graphic design student apple” becomes `tablet apple ipad`. This is a bounded heuristic, not general language understanding. Clear USD budget expressions and supported product-category words synchronize the text and editable fields locally, without AI calls. Editing a field rewrites matching explicit text; omitted values keep the selected field. Conflicting amounts/categories, incomplete budget expressions and unsupported currencies block submission. The live action repeats consistency validation before reserving work. The full synchronized requirements remain available for research, scoring and saved snapshots. Saved results are immutable when draft fields change.

Live app: https://buysmart.app.space · Repository: https://github.com/jacespedes2019/buysmart · Submission note: [SUBMISSION.md](SUBMISSION.md).

## Price alerts

The **Price alerts** tab offers a synthetic public preview and private signed-in watches with target prices, dated charts, pause/resume, and in-app alerts. Live result cards prefill an exact-ASIN watch. A native CronRoom and transactional PriceMonitor share bounded daily checks across matching ASINs. Automatic checks start paused for each account. Every signed-in user can independently opt in or out; price tracking does not use the live-research allowlist. A shared transactional automation budget still applies. See [PRICE_TRACKING.md](docs/PRICE_TRACKING.md) for costs, privacy, observation semantics, operational limits and pending direct-ASIN verification.
