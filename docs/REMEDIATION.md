# Audit remediation — November 23, 2026

This records the implemented changes against the original independent `AUDIT.md`. The original report remains a historical baseline; its pre-change line numbers and verification counts should not be read as the current state.

## Current result

Amazon discovery is implemented through DeepSpace's Apify integration, using the pinned `junglee/amazon-crawler` actor. It replaces the failing SerpAPI-backed Amazon endpoint. Prices, variants, ASIN, seller, stock and observation timestamps are retained; shipping is unknown when absent and taxes are explicitly excluded. The owner is the sole live-allowlisted account; demo is still the initial UI mode. A live search is a deliberate owner-credit action, never page-load work.

The verified paid sequence comprised one failed/refunded original Amazon request, one successful Apify extraction, then one Exa search and one OpenAI extraction. The last two reused the completed Amazon job. Total remediation-test cost: **USD 0.05898864 (5.898864 credits)**; balance after verification: **492.937012 credits**. No paid retries or extra Apify starts were made. The current normalization/identity refinement was verified by replaying the actual fresh responses, not by spending again.

## Finding disposition

| Finding | Disposition and evidence |
| --- | --- |
| F01 — Mode switch loses workspace | Fixed: Home keys by account identity, not provider mode. BuySmart cancels obsolete work while preserving the completed result and its mode. Recorded-offer browser test changes modes and reopens without more provider calls. |
| F02 — Unverified live discovery | Replaced failing provider; actual Apify prices verified. Existing completed run + fresh Exa/OpenAI succeeded. Current parser accepts the recorded responses and A16 quotes. Evidence under `docs/live-verification/apify-probe/` and `approved-1795491410782/`. This is local/provider verification, not production verification. |
| F03 — Retrieval loses requirements | Fixed: original requirements, category and returned names reach Exa; manufacturer/software domains expanded. Research remains one bounded shared query, so per-product coverage is not guaranteed. |
| F04 — Null Exa field discards siblings | Fixed: entry/content normalization preserves usable siblings and treats unknown/null content as unavailable. Regression tests cover it. |
| F05 — Listings fail after downstream spend | Fixed: each Apify item is normalized to the product schema before enrichment; long titles are bounded and malformed/error/off-domain entries are skipped independently. |
| F06 — Finite-weight overflow | Fixed: scale before summation; persist weights only in 0–100. Large finite input regression passes. |
| F07 — Unrelated or contrary quotation can score 100 | Risk removed from live ranking: model numeric scores and strengths are never accepted. Model/generation identity, literal values and explicit capacity checks gate additional specifications. Exact-ASIN listing facts remain available. Live performance/fit/features deliberately remain unscored until trustworthy criterion-specific rules exist. Source relevance still requires human review. |
| F08 — Invalid snapshots persisted/hidden | Fixed: bounded versioned snapshots are validated by the server save action. Native direct create/update are denied for every role; owner-only read/delete remain. Invalid legacy snapshots have visible deletion controls. Native foreign-ID attempts are tested. |
| F09 — Draft budget mutates result/save | Fixed: validated result budget/query/category are separated from editable draft fields; both storage paths parse the snapshot. Browser test clears draft budget and saves the original valid budget. |
| F10 — Malformed price commas | Eliminated string-based live price parsing: the new adapter accepts finite positive numeric USD amounts from the structured Apify field. Malformed/non-USD values become null. |
| F11 — Body cap buffers first | Fixed: installed SDK streaming byte-limit helper runs before JSON parsing; Unicode/chunked oversize requests return 413. Save has a separate bounded payload allowance. |
| F12 — Stale reservation overwrites new work | Fixed: token-checked transactional finish/fail/attach; stale operations return 409. Known upstream job ID and original observation time survive failure/resume. Concurrent and expired-lease regressions pass. |
| F13 — Research allowance | Updated by owner request: daily and cumulative search caps and reset controls removed. User-scoped cache, duplicate-request suppression and live-access authorization remain. |
| F14 — Populated history overflow | Fixed: shrink/wrap rules plus 320px navigation adjustment. A 500-character unbroken query is saved and displayed without document overflow. |
| F15 — Small targets/navigation feedback | Improved: 32px remove targets, active navigation semantics, heading focus on view changes, keyboard-focusable table region, caption and reduced-motion support. Full screen-reader certification remains outside this review. |
| F16 — Unbounded waiting/cancellation | Fixed application deadlines: bounded actor/polling, 10/15/25-second transport timeouts, 120-second action deadline, browser abort propagation, three-minute lease. Known jobs resume without another start. An accepted upstream job cannot be retroactively canceled/refunded by aborting HTTP; an ambiguous start before receiving a run ID remains a documented distributed-systems limitation. |
| F17 — Diagnostic loss | Improved: provider endpoint/code and stage-safe errors are logged; gate errors are handled and cleanup cannot mask the original failure. Raw API error and billing envelopes are retained in approved verification artifacts. No credential values are logged. |
| F18 — Test gaps | Added contract, actual-response replay, contradictory-score rejection, transactional reservation/fencing, server validation, chunked body, action cache, mobile/history, mode/provenance, and native foreign-ID tests. Gate logic uses a serialized harness, not a claim of exhaustive native storage fault testing. |
| F19 — Narrow tooling gate | Fixed: client/Worker and separate Node/tooling/test type checks, expanded focused lint rules, finite release command, build type checking, and no pass-with-zero-tests flag. No external Git host/CI service was introduced. |
| F20 — Deployment/submission incomplete | **Pending owner authorization**. No deploy, source claim, public URL assertion, commit or portal submission was performed. The applicant's own verification/note is still required. |
| F21 — esbuild advisory | Fixed via scoped esbuild 0.28.2 override; SDK stays 0.44.2. npm audit reports zero advisories. CLI dev/tests and production build work with the resolved toolchain. |

## Remaining product limits

- Price observations are USD/Amazon-US snapshots, not a checkout guarantee. Tax/shipping, exact variant and seller need review.
- Live ranking uses available price/rating only; other three criteria remain explicitly unavailable. Demo assessments illustrate the complete weighted engine and are synthetic.
- Manufacturer model-family evidence does not establish every seller SKU/variant or software claim. Uncertain values are omitted and do not influence scores.
- Shared research and per-request limits favor cost predictability over exhaustive coverage.
- No new paid verification is authorized beyond the four-call sequence already completed. Future paid harness runs need deliberate owner approval.
- Deployment, production account-isolation checks, personal candidate verification and portal submission remain outstanding.
