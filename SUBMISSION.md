# BuySmart — submission note

Repository: https://github.com/jacespedes2019/buysmart

Live app: https://buysmart.app.space

Deployment verified November 24, 2026.

BuySmart is a focused electronics-comparison workspace built on DeepSpace. Users describe a need, review synchronized budget/category fields, compare up to four configurations with a deterministic weighted score, and save private comparisons. The public demo is explicitly synthetic and consumes no integration credits; live research is limited to approved accounts.

Three useful DeepSpace integrations power research: Apify supplies Amazon offer snapshots; Exa retrieves manufacturer/review excerpts; OpenAI extracts brief specifications with literal quotes and conservative model checks. Native DeepSpace authentication, records and ownership permissions, server actions, and a Durable Object provide the application backend, private persistence, cached results and duplicate-request suppression.

The main tradeoff is conservative evidence rather than an impressive-looking AI recommendation. Live scores use available prices and customer ratings; performance, fit and feature scores remain unavailable. The interface explains that the score does not establish software compatibility or suitability for design work. Missing values are visible and weights are not redistributed. Shipping/taxes, exact configurations, renewed condition and dated prices require human review. Up to twelve Amazon candidates become at most four configurations; this does not guarantee four model families or new-condition items.

The coding agent implemented, deployed and reviewed the application, corrected integration/security issues, added automated coverage, refined the responsive interface, and ran the checks documented in docs/VERIFICATION.md. The latest authorized paid check exercised Amazon discovery only (USD 0.176, within a USD 0.50 authorization); fresh Exa/OpenAI calls were omitted because Exa's reservation can exceed that authorization. Their earlier live results and offline replays are documented separately.

Applicant verification — complete personally before portal submission: use the deployed search/compare/save/reopen flow; inspect an exact product and its cited sources; explain and modify the ranking and ownership checks; describe which agent changes you reviewed or corrected. Automated agent checks must not be presented as personal verification. This note has not been submitted to the portal.
