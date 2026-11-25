# DeepSpace internship assessment — submission draft

This is a draft for the applicant to edit after personal verification; agent-run checks are not personal candidate verification.

## What was built

BuySmart compares electronics using real Amazon offer snapshots, cited research, adjustable deterministic criteria and private saved comparisons. A public illustrative demo costs no credits. Native DeepSpace accounts own immutable snapshots; another account cannot read, change or delete them.

## Integrations and tradeoff

- **Apify through DeepSpace:** automatic Amazon offers with structured prices, ASINs, variants, seller and stock. This replaced `amazon/search-products`, whose upstream SerpAPI account had exhausted searches. A real bounded extraction succeeded.
- **Exa:** bounded manufacturer/review research that retains the user's requirements.
- **OpenAI:** extracts literal cited specifications. Its numeric opinions never determine live ranking.

The main tradeoff is conservative evidence and bounded spend. Real prices/ratings contribute to live weighted scores; live performance, compatibility and feature values remain unknown until trustworthy criterion-specific rules exist. Missing criteria contribute zero without weight redistribution. Demo assessments demonstrate all five criteria and are explicitly synthetic. This avoids treating an exact quote as proof that an AI-assigned quality/compatibility score is correct.

## Platform depth

Native auth, own-record read/delete, server-validated immutable saves, Worker actions, and a transactional Durable Object for private caching, admission and token-fenced reservations. Known asynchronous upstream run IDs and original timestamps survive failure/resume. No replacement auth/database service or browser provider keys were added.

## What the coding agent did

The agent implemented and independently audited the app, inspected the skill/docs/catalog/types, corrected the findings, verified the replacement provider within an approved four-paid-invocation ceiling, and added contract, browser, actual-response replay and adversarial two-user tests. The agent prepared deployment and the submission draft; it did not submit in the portal or perform the candidate's personal verification. See SUBMISSION.md and docs/VERIFICATION.md for current deployment evidence.

## Verification and unfinished edges

Local type/lint/unit/browser/build checks and npm audit are documented in `docs/VERIFICATION.md`; finding dispositions are in `docs/REMEDIATION.md`. The real provider sequence reused the completed paid Amazon job and completed fresh Exa/OpenAI calls; the latest identity refinement is checked by offline replay. Prices are dated USD/Amazon-US observations and shipping/taxes need review. Evidence coverage is shallow and exact variant/software claims still require human review.

Deployment was authorized on November 24; the observed result is recorded in docs/VERIFICATION.md. The applicant must personally use the app, explain/modify its ranking and security design, review current source claims, deploy when ready, and submit the actual live URL, repository and short note. Deadline supplied: November 25, 2026 at 11:59 PM Eastern (8:59 PM Pacific).

The brief contains conflicting integration-count guidance; the implemented product uses three useful DeepSpace integrations without adding a fourth to inflate feature count.
