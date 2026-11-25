import { afterEach, expect, it, vi } from "vitest";
import type { CronContext } from "deepspace/worker";
import type { Env } from "../../worker";
import { PriceMonitor } from "./PriceMonitor";
import { advanceReport, type WatchConfig, type Observation } from "./model";
import { directPriceRequest, runPriceChecks } from "./runner";
import marketplace from "../../docs/live-verification/apify-probe/result.json";
const config: WatchConfig = { asin: "B0DZ75TN5F", title: "Apple iPad", target: 300, paused: false, since: "2026-11-24T00:00:00.000Z", acknowledged: null };
const observation: Observation = { price: 299, at: "2026-11-24T01:00:00.000Z", seller: "Amazon.com", variant: "Color: Blue" };
function harness() {
  const values = new Map<string, unknown>();
  const tx = { get: async <T>(k: string) => values.get(k) as T, put: async (k: string, v: unknown) => { values.set(k,v); } };
  let tail: Promise<unknown> = Promise.resolve();
  const storage = { ...tx, transaction: <T>(fn: (t: typeof tx) => Promise<T>) => { const task = tail.then(() => fn(tx)); tail = task.catch(() => {}); return task; } };
  const service = new PriceMonitor({ storage } as unknown as DurableObjectState);
  const env = { OWNER_USER_ID: "owner", LIVE_ENABLED: "true", LIVE_USER_IDS: "alice,bob", PRICE_MONITOR: { idFromName: () => "global", get: () => ({ fetch: (r: Request) => service.fetch(r) }) } } as unknown as Env;
  const call = async (op: string, params: Record<string, unknown> = {}) => {
    const response = await service.fetch(new Request("https://internal", { method: "POST", body: JSON.stringify({ op, ...params }) }));
    return { status: response.status, ...await response.json() as { state?: string; enabled?: boolean; remaining?: number; token?: string; runId?: string; history?: Observation[]; error?: string } };
  };
  return { env, call };
}
afterEach(() => vi.useRealTimers());
it("starts disabled and admits no paid work without explicit activation", async () => {
  const { call } = harness();
  expect(await call("status")).toMatchObject({ enabled: false, remaining: 20 });
  expect((await call("reserve", { asin: config.asin })).state).toBe("paused");
});
it("serializes same-ASIN starts, resumes known jobs and fences stale writers", async () => {
  vi.useFakeTimers(); const { call } = harness(); await call("enable", { enabled: true });
  const results = await Promise.all(Array.from({ length: 8 }, () => call("reserve", { asin: config.asin })));
  expect(results.filter(r => r.state === "reserved")).toHaveLength(1);
  const first = results.find(r => r.token)!;
  await call("attach", { asin: config.asin, token: first.token, runId: "paid-once" });
  vi.advanceTimersByTime(180001);
  const second = await call("reserve", { asin: config.asin });
  expect(second.runId).toBe("paid-once"); expect((await call("status")).remaining).toBe(19);
  expect((await call("finish", { asin: config.asin, token: first.token, observation })).status).toBe(409);
  await call("finish", { asin: config.asin, token: second.token, observation });
  expect((await call("reserve", { asin: config.asin })).state).toBe("cached");
});
it("enforces five starts per UTC day and twenty total even after pause/resume", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-24T00:00:00Z"));
  const { call } = harness(); await call("enable", { enabled: true });
  for (let day = 0; day < 4; day++) {
    for (let i = 0; i < 5; i++) expect((await call("reserve", { asin: `B${String(day * 5 + i).padStart(9,"0")}` })).state).toBe("reserved");
    expect((await call("reserve", { asin: "B999999999" })).state).toBe("paused");
    vi.advanceTimersByTime(86400001);
  }
  await call("enable", { enabled: false }); await call("enable", { enabled: true });
  expect((await call("reserve", { asin: "B999999999" })).state).toBe("paused");
  expect((await call("status")).remaining).toBe(0);
});
it("excludes seller changes and never records missing/invalid prices", async () => {
  vi.useFakeTimers(); const { call } = harness(); await call("enable", { enabled: true });
  const first = await call("reserve", { asin: config.asin });
  await call("finish", { asin: config.asin, token: first.token, observation });
  vi.advanceTimersByTime(86400001);
  const second = await call("reserve", { asin: config.asin });
  const result = await call("finish", { asin: config.asin, token: second.token, observation: { ...observation, seller: "Another seller", price: 100 } });
  expect(result.history).toEqual([observation]); expect(result.error).toContain("Seller or configuration changed");
});
it("emits once below target, rearms after a rise, and excludes observations before tracking", () => {
  const first = advanceReport(config, undefined, [observation], observation.at, null);
  const lower = { ...observation, price: 290, at: "2026-11-25T01:00:00.000Z" };
  const second = advanceReport(config, first, [observation, lower], lower.at, null);
  expect(second.alert).toEqual(first.alert);
  const raised = advanceReport(config, second, [{ ...lower, price: 310 }], lower.at, null);
  expect(raised.alert).toBeNull();
  const next = advanceReport(config, raised, [lower], lower.at, null);
  expect(next.alert?.key).not.toBe(first.alert?.key);
  expect(advanceReport({ ...config, since: "2026-12-01T00:00:00.000Z" }, undefined, [observation], observation.at, null).alert).toBeNull();
});
it("pins direct ASIN extraction to one item and a small provider budget", () => {
  expect(directPriceRequest(config.asin)).toMatchObject({ maxItems: 1, maxTotalChargeUsd: 0.005,
    input: { categoryOrProductUrls: [{ url: "https://www.amazon.com/dp/B0DZ75TN5F" }], maxItemsPerStartUrl: 1, maxOffers: 0, scrapeSellers: false } });
});
it("cron shares one unwrapped integration job across two owners and repeats without paid starts", async () => {
  const { env, call } = harness(); await call("enable", { enabled: true });
  const rows = ["alice", "bob"].map((user, i) => ({ recordId: `watch${i}`, createdBy: user, data: { config: { ...config, target: 400 }, report: undefined as unknown } }));
  const query = vi.fn(async (_collection: string, options?: { where?: { recordId: string } }) => options?.where ? rows.filter(r => r.recordId === options.where?.recordId) : rows);
  const update = vi.fn(async (_collection, id, patch) => { Object.assign(rows.find(r => r.recordId === id)!.data, patch); });
  const integration = vi.fn(async (endpoint: string) => endpoint === "apify/run-actor" ? { jobId: "one-start" } : marketplace.data);
  const ctx = { ownerUserId: "owner", records: { query, update }, integrations: { call: integration } } as unknown as CronContext;
  await runPriceChecks(env, ctx);
  expect(integration.mock.calls.map(([endpoint]) => endpoint)).toEqual(["apify/run-actor", "apify/get-run"]);
  expect(update).toHaveBeenCalledTimes(2);
  expect(rows[0].data.report).toMatchObject({ below: true, history: [{ price: 379 }] });
  await runPriceChecks(env, ctx);
  expect(integration).toHaveBeenCalledTimes(2);
});
it("disabled cron does not access integrations or records", async () => {
  const { env } = harness(); const ctx = { records: { query: vi.fn() }, integrations: { call: vi.fn() } } as unknown as CronContext;
  await runPriceChecks(env, ctx); expect(ctx.records.query).not.toHaveBeenCalled(); expect(ctx.integrations.call).not.toHaveBeenCalled();
});
