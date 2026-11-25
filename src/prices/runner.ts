import type { CronContext } from "deepspace/worker";
import type { Env } from "../../worker";
import { marketplaceRequest, discoverMarketplace } from "../buysmart/apify";
import { advanceReport, watchConfigSchema, reportSchema, type WatchRow } from "./model";
import { monitor } from "./monitor-client";
export function directPriceRequest(asin: string) {
  const request = marketplaceRequest({ query: "Exact Amazon product", category: "Tablets", budget: 10000 });
  return { ...request, input: { ...request.input, categoryOrProductUrls: [{ url: `https://www.amazon.com/dp/${asin}` }], maxItemsPerStartUrl: 1 }, maxItems: 1, maxTotalChargeUsd: 0.005 };
}
export async function runPriceChecks(env: Env, ctx: CronContext) {
  const status = await monitor(env, { op: "status" });
  if (!status.enabled) return;
  const rows = await ctx.records.query("priceWatches", { limit: 500 }) as WatchRow[];
  if (rows.length >= 500) throw new Error("Watchlist scan limit reached; pause monitoring and paginate before scaling.");
  const eligible = (env.LIVE_USER_IDS ?? "").split(",").map(s => s.trim());
  const active = rows.flatMap(row => {
    const parsed = watchConfigSchema.safeParse(row.data.config);
    return parsed.success && !parsed.data.paused && env.LIVE_ENABLED === "true" && eligible.includes(row.createdBy) ? [{ ...row, data: { ...row.data, config: parsed.data } }] : [];
  });
  // Least recently observed first; over-budget ASINs stay queued for another day.
  const asins = [...new Set(active.sort((a,b) => (a.data.report?.checkedAt ?? "").localeCompare(b.data.report?.checkedAt ?? "")).map(r => r.data.config.asin))];
  let failures = 0;
  for (const asin of asins) {
    const reservation = await monitor(env, { op: "reserve", asin });
    if (reservation.state === "pending" || reservation.state === "paused") continue;
    let outcome = reservation;
    if (reservation.state === "reserved") {
      try {
        const products = await discoverMarketplace(async (endpoint, body) => {
          // buildCronContext already unwraps the integration envelope and throws on failure.
          return ctx.integrations.call(endpoint, endpoint === "apify/run-actor" ? directPriceRequest(asin) : body as Record<string, unknown>);
        }, { query: "Exact Amazon product", category: "Tablets", budget: 10000 }, {
          resumeRunId: reservation.runId, resumeObservedAt: reservation.observedAt,
          onRunAssigned: async runId => { await monitor(env, { op: "attach", asin, token: reservation.token, runId }); },
        });
        const product = products.find(p => p.id === asin);
        if (!product || product.price === null || product.offer?.inStock !== true || !product.offer.seller || !product.offer.variant) throw new Error("Exact in-stock USD offer with seller and variant data unavailable.");
        outcome = await monitor(env, { op: "finish", asin, token: reservation.token, observation: {
          price: product.price, at: product.offer.observedAt, seller: product.offer.seller, variant: product.offer.variant,
        } });
      } catch {
        outcome = await monitor(env, { op: "fail", asin, token: reservation.token, error: "Price unavailable or provider failed. Previous observations retained; no automatic paid retry." });
        failures++;
      }
    }
    for (const row of active.filter(r => r.data.config.asin === asin)) {
      // Read fresh config so a pause, deletion or target edit during extraction is respected.
      const current = (await ctx.records.query("priceWatches", { where: { recordId: row.recordId }, limit: 1 }) as WatchRow[])[0];
      if (!current) continue;
      const config = watchConfigSchema.parse(current.data.config);
      if (config.paused) continue;
      const report = advanceReport(config, reportSchema.safeParse(current.data.report).data, outcome.history ?? [], new Date(outcome.lastAttempt ?? Date.now()).toISOString(), outcome.error ?? null);
      await ctx.records.update("priceWatches", row.recordId, { report });
    }
  }
  if (failures) throw new Error(`${failures} price check(s) failed; inspect per-watch status. No paid retry.`);
}
