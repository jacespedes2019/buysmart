import { Hono } from "hono";
import { expect, it, vi } from "vitest";
import type { VerifyResult } from "deepspace/worker";
import type { AppContext, Env } from "../../worker";
import { registerActionRoutes } from "./action-routes";
import { defaults } from "../buysmart/model";
import { demoProducts } from "../buysmart/fixtures";
import marketplace from "../../docs/live-verification/apify-probe/result.json";
import { ResearchGate } from "../buysmart/ResearchGate";
const snapshot = { id: "snapshot", query: "Tablet for drawing", budget: 350, category: "Tablets", products: demoProducts("Tablets"), weights: defaults, createdAt: "2026-11-23T00:00:00Z", mode: "demo", explanation: "Example" };
function setup(signedIn = true) {
  const recordFetch = vi.fn(async (request: Request) => {
    const body = await request.clone().json() as { params: { data: unknown } };
    return Response.json({ success: true, data: { recordId: "created", ...body.params } });
  });
  const values = new Map<string, unknown>();
  const tx = { get: async (k: string) => values.get(k), put: async (k: string, v: unknown) => { values.set(k,v); }, delete: async (k: string) => values.delete(k) };
  const gate = new ResearchGate({ storage: { ...tx, transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } } as unknown as DurableObjectState);
  const env = { OWNER_USER_ID: "owner", LIVE_ENABLED: "false", LIVE_USER_IDS: "", DEEPSPACE_APP_ID: "test",
    RECORD_ROOMS: { idFromName: (s: string) => s, get: () => ({ fetch: recordFetch }) },
    RESEARCH_GATE: { idFromName: (s: string) => s, get: () => ({ fetch: (r: Request) => gate.fetch(r) }) },
  } as unknown as Env;
  const app = new Hono<AppContext>();
  registerActionRoutes(app, async () => signedIn ? { userId: "alice", claims: {} } as VerifyResult : null);
  const post = (name: string, body: unknown) => app.request(`/api/actions/${name}`, { method: "POST", headers: { Authorization: "Bearer verified-by-test-resolver", "Content-Type": "application/json" }, body: JSON.stringify(body) }, env);
  return { app, env, post, recordFetch };
}
it("requires verified identity and guards prototype action names", async () => {
  expect((await setup(false).post("saveComparison", { snapshot })).status).toBe(401);
  const s = setup(); expect((await s.post("constructor", {})).status).toBe(404);
  expect(s.recordFetch).not.toHaveBeenCalled();
});
it("validates snapshots server-side and uses verified ownership for a fresh immutable row", async () => {
  const s = setup();
  const invalid = await s.post("saveComparison", { snapshot: { ...snapshot, budget: 0 } });
  expect(await invalid.json()).toMatchObject({ success: false }); expect(s.recordFetch).not.toHaveBeenCalled();
  const valid = await s.post("saveComparison", { snapshot, createdBy: "bob" });
  expect(await valid.json()).toMatchObject({ success: true });
  const request = s.recordFetch.mock.calls[0][0];
  expect(request.headers.get("X-User-Id")).toBe("alice");
  expect(request.headers.get("X-App-Action")).toBe("true");
  expect(await request.json()).toMatchObject({ tool: "records.create", params: { collection: "comparisons", data: { snapshot: { version: 1, budget: 350 } } } });
});
it("rejects oversized Unicode/chunked bodies before dispatch and handles malformed JSON", async () => {
  const s = setup();
  const bytes = new TextEncoder().encode(JSON.stringify({ query: "🙂".repeat(1500) }));
  let cursor = 0;
  const stream = new ReadableStream<Uint8Array>({ pull(controller) {
    if (cursor >= bytes.length) return controller.close();
    controller.enqueue(bytes.slice(cursor, cursor + 1024)); cursor += 1024;
  } });
  const response = await s.app.request(new Request("https://local/api/actions/discover", { method: "POST", headers: { Authorization: "Bearer test" }, body: stream, duplex: "half" } as RequestInit), {}, s.env);
  expect(response.status).toBe(413); expect(s.recordFetch).not.toHaveBeenCalled();
  const malformed = await s.app.request("/api/actions/discover", { method: "POST", headers: { Authorization: "Bearer test" }, body: "{" }, s.env);
  expect(malformed.status).toBe(400);
});
it("blocks disabled live research and removes the obsolete quota reset endpoint", async () => {
  const s = setup();
  expect(await (await s.post("discover", { query: "Tablet for drawing", budget: 350, category: "Tablets" })).json()).toMatchObject({ success: false });
  expect((await s.post("resetResearchAllowance", { confirm: true })).status).toBe(404);
  expect(await (await s.post("researchStatus", {})).json()).toMatchObject({ success: true, data: { enabled: false } });
});

it("runs the authorized discovery action through mocked external transport and caches without another paid start", async () => {
  const s = setup();
  s.env.LIVE_ENABLED = "true"; s.env.LIVE_USER_IDS = "alice"; s.env.APP_OWNER_JWT = "owner-billing-test";
  const apiFetch = vi.fn(async (target: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof target === "string" ? target : target instanceof URL ? target.href : target.url;
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer owner-billing-test");
    if (url.endsWith("/apify/run-actor")) return Response.json({ success: true, data: { jobId: "one-start" } });
    if (url.endsWith("/apify/get-run")) return Response.json(marketplace);
    if (url.endsWith("/exa/search")) return Response.json({ success: true, data: { results: [{ title: "Apple specifications", url: "https://apple.com/ipad", text: "Specifications and model compatibility require review." }] } });
    if (url.endsWith("/openai/chat-completion")) return Response.json({ success: true, data: { choices: [{ message: { content: '{"products":[]}' } }] } });
    throw new Error("Unexpected external route");
  });
  s.env.API_WORKER = { fetch: apiFetch } as unknown as Fetcher;
  const request = { query: "Apple iPad A16 for a student", budget: 350, category: "Tablets" };
  const first = await (await s.post("discover", request)).json();
  expect(first).toMatchObject({ success: true, data: { products: [{ price: 379 }] } });
  expect(apiFetch).toHaveBeenCalledTimes(4);
  expect(await (await s.post("discover", { ...request, query: request.query.toUpperCase() })).json()).toEqual(first);
  expect(apiFetch).toHaveBeenCalledTimes(4);
});

it("rejects contradictory search text and fields before starting paid research", async () => {
  const s = setup();
  s.env.LIVE_ENABLED = "true"; s.env.LIVE_USER_IDS = "alice";
  const apiFetch = vi.fn();
  s.env.API_WORKER = { fetch: apiFetch } as unknown as Fetcher;
  for (const input of [
    { query: "A tablet under $500 for design", budget: 700, category: "Tablets" },
    { query: "A tablet under $500 for design", budget: 500, category: "Laptops" },
    { query: "A tablet under $500 or $700", budget: 500, category: "Tablets" },
  ]) expect(await (await s.post("discover", input)).json()).toMatchObject({ success: false });
  expect(apiFetch).not.toHaveBeenCalled();
});
