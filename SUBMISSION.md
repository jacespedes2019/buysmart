# BuySmart — submission note

Repository: https://github.com/jacespedes2019/buysmart

Live app: https://buysmart.app.space

Deployment verified November 24, 2026.

BuySmart is a focused electronics-comparison workspace built on DeepSpace. Users describe a need, review synchronized budget/category fields, compare up to four configurations with a deterministic weighted score, and save private comparisons. A price watchlist adds target-price alerts and dated observations, with native scheduled jobs, shared ASIN checks and personal opt-in under a bounded shared spending allowance. The public demo is explicitly synthetic and consumes no integration credits; live product research is available to all signed-in users.

Three useful DeepSpace integrations power research: Apify supplies Amazon offer snapshots; Exa retrieves manufacturer/review excerpts; OpenAI extracts brief specifications with literal quotes and conservative model checks. Native DeepSpace authentication, records and ownership permissions, server actions, and a Durable Object provide the application backend, private persistence, cached results and duplicate-request suppression.

The main tradeoff is conservative evidence rather than an impressive-looking AI recommendation. Live scores use available prices and customer ratings; performance, fit and feature scores remain unavailable. The interface explains that the score does not establish software compatibility or suitability for design work. Missing values are visible and weights are not redistributed. Shipping/taxes, exact configurations, renewed condition and dated prices require human review. Up to twelve Amazon candidates become at most four configurations; this does not guarantee four model families or new-condition items.

The coding agent implemented, deployed and reviewed the application, corrected integration/security issues, added automated coverage, refined the responsive interface, and ran the checks documented in docs/VERIFICATION.md. An authorized Amazon discovery check cost USD 0.176 within a USD 0.50 authorization, and a subsequent exact-ASIN price probe cost USD 0.02 within a separate USD 0.05 authorization; fresh Exa/OpenAI calls were omitted because Exa's reservation can exceed that authorization. Their earlier live results and offline replays are documented separately.

Applicant verification — complete personally before portal submission: use the deployed search/compare/save/reopen flow; inspect an exact product and its cited sources; explain and modify the ranking and ownership checks; describe which agent changes you reviewed or corrected. Automated agent checks must not be presented as personal verification. This note has not been submitted to the portal.

Price tracking status: public synthetic preview and private CRUD are available; automated checks start paused per account; every signed-in user can independently enable or disable their own checks under the shared app budget. A separately authorized exact-ASIN probe succeeded at USD 0.02; a production scheduled-task execution receipt remains pending because recurring paid monitoring has not been enabled. The retained-history minimum is explicitly labeled, not presented as Amazon’s all-time low.
