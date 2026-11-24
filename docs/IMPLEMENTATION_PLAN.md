# BuySmart implementation plan
1. Native DeepSpace scaffold and verified SDK/catalog schemas; review official Taskspace example.
2. Independent deterministic ranking, runtime validated snapshots, category-specific mock discovery, responsive discovery/results/workspace/history UI.
3. Native authentication and own-record comparison persistence; server-only Amazon, Exa and OpenAI providers; durable bounded usage and cache; no public integration proxy.
4. Unit and browser journey checks, type checking, lint, production build; inspect desktop/mobile.
5. README, assessment draft, development log, approval-gated live tests and deployment.

Decisions: missing criterion values contribute zero without redistributing weights; coverage is separate. Affordability is remaining budget fraction. Over-budget products remain visible and explicitly flagged. A strict budget filter is optional. Demo history is browser-local; signed-in history uses native records. No API calls occur on weight changes or reopening.
