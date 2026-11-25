# Price tracking

## Product behavior

Price alerts are available from the main navigation. The public page provides a synthetic, explicitly labeled preview. Signed-in users can follow up to five exact Amazon-US ASINs, set a USD target, edit it, pause/resume, delete a watch, and acknowledge an in-app alert. Live product cards prefill the form. Saving or editing a watch makes no paid request.

Native `priceWatches` records are private. Configuration and observed reports are separate fields: cron updates reports without overwriting an edited target or pause setting. Verified server actions validate input and check ownership before privileged updates. Direct native creates/updates are denied to every client role; read/delete are own-record only. A deterministic caller+ASIN record ID prevents duplicate concurrent adds of the same product. The five-watch creation limit is checked before creation, not transactionally across different ASINs; the global paid budget remains transactionally enforced even under concurrent adds.

## Scheduled checks and consent

The existing native CronRoom wakes every 15 minutes, including while the browser is closed. The PriceMonitor Durable Object admits at most one new extraction per ASIN per 24 hours, five new starts per UTC day, and twenty total starts. Scheduling starts disabled per account. Every authenticated user can independently enable or disable automatic checks from the Price alerts checkbox. The verified caller identifies the preference; client-supplied user IDs are ignored. Toggling does not refill counters. A future budget top-up UI is out of scope; after twenty starts, monitoring needs a deliberately reviewed allowance change. Search admission remains uncapped; these are independent automation controls.

All authenticated accounts are eligible after personal opt-in, independently of live-research approval. Opting out removes only that user’s watches from future scheduled work and report updates. If another opted-in account follows the same ASIN, its checks continue. The shared budget still bounds the owner-funded cost. Watches of the same ASIN share one global extraction and history; their targets, acknowledgement state and notifications stay private.

An extraction uses `junglee/amazon-crawler` through DeepSpace with one exact `/dp/ASIN` URL, one result, no extra offer/seller/variant fan-out, and USD 0.005 maximum provider charge. DeepSpace pricing is additional; this is not a guaranteed retail-dollar ceiling. Exa/OpenAI are not called. The app’s twenty-start allowance bounds cumulative provider caps at USD 0.10, subject to additional DeepSpace pricing. The user checkbox enables that account’s participation; it does not authorize a personal charge or reset shared counters. Failed starts consume allowance, including ambiguous transport failures.

Concurrent runs use transactionally assigned leases and fencing tokens. Assigned upstream run IDs survive interruptions and resume using free status reads; paid starts are not automatically retried before the next daily eligibility period. Leases expire after three minutes. The scheduler does not promise exact wall-clock execution or capture short-lived intraday discounts. A batch is deliberately bounded to fewer than 500 watches and must be paginated before larger deployment.

## Observation and alert semantics

A successful observation requires the exact ASIN, positive USD price, reported in-stock status, seller and variant metadata. Missing data, provider failures, or out-of-stock results retain the last successful history and show an error; they never become zero prices. Changes of seller or variant relative to the prior accepted observation are excluded until the original offer returns. This is conservative and can omit legitimate offers. The scraper cannot guarantee that every change in item condition is exposed separately; users must verify the exact listing and checkout condition.

Histories contain actual successful observations after the watch's creation, with up to 90 retained observations. “Lowest shown” is the minimum in that retained history, not Amazon's all-time low. The graph uses actual observation timestamps, displays a single point when only one exists, and has an accessible label and dated text list. Shipping and taxes are excluded.

An alert is created when an observed price is at or below the target. It retains its identity while later observations stay below the same target, so marking it as read prevents repeated alerts. A price rise above target rearms the alert. Changing the target recomputes against retained observations; every alert displays its observation date. Alerts appear in the app on opening the watchlist; this version does not send email, browser push or SMS.

## Validation status

Unit coverage exercises disabled scheduling, same-ASIN deduplication, stale writer fencing, resumed jobs without another start, daily/lifetime budgets, seller-change exclusion, threshold/rearm behavior, history boundaries, direct-ASIN request limits, and shared cron updates with the installed SDK's unwrapped integration response contract. Browser coverage exercises private CRUD, target edits, pause/resume, foreign-ID/native-tool denials, reload, mobile width, and the no-credit synthetic chart preview.

An explicitly approved direct-ASIN invocation succeeded on November 24: B0DZ75TN5F returned USD 379, in-stock status, Amazon.com seller, and its Wi-Fi/128GB/Blue variant. One paid start plus three free polls cost USD 0.02 (2 credits), within a USD 0.05 authorization. Evidence: `docs/live-verification/exact-asin-1795570415140/`. No production scheduler was enabled. Do not claim automated daily production observations until an account has explicitly opted in and a task execution receipt inspected.

## Personal opt-in migration

The old global `enabled` storage flag is intentionally ignored. Existing accounts start with their own setting off and choose explicitly; the change never enrolls existing watches automatically. Pausing or resuming an account cannot affect another account or replenish the shared budget. Users do not gain access to anyone else’s targets, observations or notifications. Live-research search permissions remain unchanged.
