import { describe, expect, it, vi } from "vitest";
import { LiveProvider, completionJson, sourceConcernsProduct } from "./providers";
import { collapseColorVariants, discoverMarketplace, marketplaceRequest, marketplaceQuery, selectMarketplaceProducts, normalizeMarketplaceItems } from "./apify";
import { defaults, comparisonSchema, type Search } from "./model";
import { demoProducts } from "./fixtures";
import { normalizeWeights, scoreProduct } from "./ranking";
import recorded from "../../docs/live-verification/apify-probe/result.json";

const input: Search = { query: "Apple iPad A16 for Canva and CapCut", category: "Tablets", budget: 350 };
const ok = (data: unknown) => ({ success: true, data });
const quote = "Acme Pad 12 supports active stylus input for drawing.";
const source = { title: "Acme Pad 12 specifications", url: "https://example.com/acme-pad-12", text: quote };
const item = { ...recorded.data.items[0], title: "Acme Pad 12", variantAttributes: [], productOverview: [] };
const extraction = (specs: unknown[] = [], extra: Record<string, unknown> = {}) => ok({ choices: [{ message: { content: JSON.stringify({ products: [{ id: item.asin, specs, ...extra }] }) }, finish_reason: "stop" }] });
function providerCall(overrides: Record<string, unknown> = {}) {
  const responses: Record<string, unknown> = {
    "apify/run-actor": ok({ jobId: "known-run" }),
    "apify/get-run": ok({ status: "SUCCEEDED", items: [item] }),
    "exa/search": ok({ results: [source] }),
    "openai/chat-completion": extraction(),
    ...overrides,
  };
  return vi.fn(async (endpoint: string, _body: unknown) => {
    if (!(endpoint in responses)) throw new Error("Unexpected endpoint: " + endpoint);
    return responses[endpoint];
  });
}

describe("marketplace contract and paid-work lifecycle", () => {
  it("normalizes actual Apify prices, variants and provenance without losing distinct ASINs", () => {
    const products = normalizeMarketplaceItems(recorded.data.items, "2026-11-24T03:16:11Z");
    expect(products).toHaveLength(3);
    expect(products.map(p => p.price)).toEqual([379, 379, 379]);
    expect(new Set(products.map(p => p.id)).size).toBe(3);
    expect(products[0].offer).toMatchObject({ provider: "apify", currency: "USD", market: "US", shipping: null, inStock: true });
    expect(products[0].offer?.variant).toContain("Color: Pink");
  });
  it("pins the actor, market, pages, result count and provider spend cap server-side", () => {
    const request = marketplaceRequest(input);
    expect(request).toMatchObject({ actorId: "junglee/amazon-crawler", maxItems: 12, maxTotalChargeUsd: 0.075, timeout: 60,
      input: { maxSearchPagesPerStartUrl: 1, maxOffers: 0, scrapeSellers: false, proxyCountry: "US" } });
    expect(new URL(request.input.categoryOrProductUrls[0].url).searchParams.get("k")).toBe("tablet apple ipad a16");
  });
  it("starts exactly once and polls only the free get-run endpoint", async () => {
    const call = vi.fn().mockResolvedValueOnce({ jobId: "one" }).mockResolvedValueOnce({ status: "READY" })
      .mockResolvedValueOnce({ status: "RUNNING" }).mockResolvedValueOnce(recorded.data);
    const attached = vi.fn().mockResolvedValue(undefined);
    const wait = vi.fn().mockResolvedValue(undefined);
    expect(await discoverMarketplace(call, input, { onRunAssigned: attached, wait })).toHaveLength(1);
    expect(call.mock.calls.map(c => c[0])).toEqual(["apify/run-actor", "apify/get-run", "apify/get-run", "apify/get-run"]);
    expect(attached).toHaveBeenCalledWith("one", expect.any(String));
    expect(wait).toHaveBeenCalledTimes(2);
  });
  it("resumes a known run without another paid start", async () => {
    const call = vi.fn().mockResolvedValue(recorded.data);
    await discoverMarketplace(call, input, { resumeRunId: "existing" });
    expect(call).toHaveBeenCalledExactlyOnceWith("apify/get-run", { runId: "existing" });
  });
  it("does not retry paid starts after terminal failure or missing prices", async () => {
    const call = vi.fn().mockResolvedValueOnce({ jobId: "failed" }).mockResolvedValueOnce({ status: "FAILED" });
    await expect(discoverMarketplace(call, input)).rejects.toThrow("No automatic paid retry");
    expect(call).toHaveBeenCalledTimes(2);
    expect(normalizeMarketplaceItems([{ ...item, price: { value: 100, currency: "EUR" } }])[0].price).toBeNull();
  });
  it("filters malformed/off-domain entries and normalizes long titles before enrichment", () => {
    const products = normalizeMarketplaceItems([{ bad: true }, { ...item, url: "https://evil.example/dp/" + item.asin },
      { ...item, title: "A".repeat(301) }, { ...item, error: "not_found" }]);
    expect(products).toHaveLength(1);
    expect(products[0].name).toHaveLength(300);
  });
});
describe("evidence and integration boundaries", () => {
  it("retains a valid Exa sibling when content is null, malformed, or missing", async () => {
    const call = providerCall({ "exa/search": ok({ results: [source, { title: "Empty", url: "https://example.com/empty", text: null }, { text: {} }] }) });
    await new LiveProvider(call).search(input);
    expect(call.mock.calls.map(c => c[0])).toEqual(["apify/run-actor", "apify/get-run", "exa/search", "openai/chat-completion"]);
    const researchBody = call.mock.calls.find(c => c[0] === "exa/search")?.[1] as { query: string; includeDomains: string[] };
    expect(researchBody.query).toContain("Canva and CapCut");
    expect(researchBody.includeDomains).toContain("canva.com");
  });
  it("extracts model-specific literal specifications but rejects arbitrary numeric opinions", async () => {
    const call = providerCall({ "openai/chat-completion": extraction([{ label: "Input", value: "active stylus", sourceUrl: source.url, quote }], {
      compatibility: { score: 100, sourceUrl: source.url, quote }, performance: { score: 100, sourceUrl: source.url, quote },
    }) });
    const result = await new LiveProvider(call).search(input);
    expect(result.products[0].specs[0].value).toBe("active stylus");
    expect(Object.values(result.products[0].evidence)).toEqual([null, null, null]);
    expect(result.products[0].strengths).toEqual([]);
    expect(scoreProduct(result.products[0], 350, { ...defaults, compatibility: 100 }).values.compatibility).toBeNull();
  });
  it("rejects cross-product quotes, fabricated URLs, values absent from a quote, and duplicate IDs", async () => {
    const bad = extraction([{ label: "Input", value: "64 GB", sourceUrl: source.url, quote }]);
    expect((await new LiveProvider(providerCall({ "openai/chat-completion": bad })).search(input)).products[0].specs).toEqual([]);
    const product = normalizeMarketplaceItems([item])[0];
    expect(sourceConcernsProduct(product, { title: "Other Pad 14", url: "https://example.com/other", excerpt: "Other Pad 14 has a stylus." }, "Other Pad 14 has a stylus.")).toBe(false);
    const duplicate = ok({ choices: [{ message: { content: JSON.stringify({ products: [{ id: item.asin, specs: [] }, { id: item.asin, specs: [] }] }) } }] });
    expect((await new LiveProvider(providerCall({ "openai/chat-completion": duplicate })).search(input)).products[0].specs).toEqual([]);
  });
  it("returns real offers when enrichment is unavailable or truncated, without paid retries", async () => {
    const failure = providerCall({ "exa/search": { success: false, code: "upstream_error", error: "Unavailable" } });
    const result = await new LiveProvider(failure).search(input);
    expect(result.products[0].price).toBe(379);
    expect(failure).toHaveBeenCalledTimes(3);
    expect(result.warnings.join(" ")).toContain("Independent research is unavailable");
    const truncated = providerCall({ "openai/chat-completion": ok({ choices: [{ message: { content: '{"products":[' }, finish_reason: "length" }] }) });
    expect((await new LiveProvider(truncated).search(input)).warnings.join(" ")).toContain("malformed");
  });
  it("stops immediately on insufficient credits, cancellation or empty offers", async () => {
    const insufficient = providerCall({ "apify/run-actor": { success: false, code: "insufficient_credits" } });
    await expect(new LiveProvider(insufficient).search(input)).rejects.toThrow("insufficient credits");
    expect(insufficient).toHaveBeenCalledTimes(1);
    const aborted = new AbortController(); aborted.abort();
    const call = providerCall();
    await expect(new LiveProvider(call).search(input, aborted.signal)).rejects.toThrow();
    expect(call).not.toHaveBeenCalled();
    const empty = providerCall({ "apify/get-run": ok({ status: "SUCCEEDED", items: [] }) });
    expect((await new LiveProvider(empty).search(input)).products).toEqual([]);
    expect(empty).toHaveBeenCalledTimes(2);
  });
  it("rejects malformed completions and ambiguous dollar/ratings representations", () => {
    expect(normalizeMarketplaceItems([{ ...item, price: { value: "1,2,3", currency: "$" } }])[0].price).toBeNull();
    expect(normalizeMarketplaceItems([{ ...item, stars: { value: 5 } }])[0].rating).toBeNull();
    expect(() => completionJson({ choices: [{ message: { content: "not json" } }] })).toThrow();
  });
});
it("rejects invalid snapshot dates, duplicate IDs, huge weights and budgets while normalizing finite weights safely", () => {
  const base = { id: "sample", query: "Tablet for drawing", budget: 350, category: "Tablets", products: demoProducts("Tablets"), weights: defaults, createdAt: "2026-11-23T00:00:00Z", mode: "demo", explanation: "Example" };
  for (const patch of [{ createdAt: "not-a-date" }, { products: [base.products[0], base.products[0]] }, { budget: 1e308 }, { weights: { ...defaults, price: 1e308 } }]) {
    expect(comparisonSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  }
  expect(normalizeWeights({ price: 1e308, performance: 1e308, compatibility: 0, rating: 0, features: 0 })).toMatchObject({ price: 50, performance: 50 });
});

it("collapses colors deterministically while retaining distinct capacities and the selected offer's exact provenance", () => {
  const products = normalizeMarketplaceItems(recorded.data.items);
  expect(collapseColorVariants(products)).toHaveLength(1);
  expect(collapseColorVariants([...products].reverse())).toEqual(collapseColorVariants(products));
  const differentCapacity = { ...products[0], id: "different", name: products[0].name.replace("128GB", "256GB"), offer: { ...products[0].offer!, variant: products[0].offer!.variant!.replace("128GB", "256GB") } };
  expect(collapseColorVariants([...products, differentCapacity])).toHaveLength(2);
  const cheaper = { ...products[0], price: 300 };
  expect(collapseColorVariants([cheaper, products[1]])[0]).toEqual(cheaper);
  expect(collapseColorVariants(products.map(p => ({ ...p, offer: { ...p.offer!, variant: null } })))).toHaveLength(3);
});

it("keeps different Apple models even when their color and configuration match", () => {
  const base = normalizeMarketplaceItems(recorded.data.items)[0];
  const models = ["Apple iPad A16 128GB — Pink", "Apple iPad Air M3 128GB — Pink", "Apple iPad Pro M4 128GB — Pink"]
    .map((name, index) => ({ ...base, id: `apple-model-${index}`, name }));
  expect(collapseColorVariants(models)).toEqual(models);
});

it("separates shopping keywords from budget and use-case requirements without losing model details", () => {
  expect(marketplaceQuery({ ...input, query: "A tablet under $2000 for a graphic design student apple", budget: 2000 })).toBe("tablet apple ipad");
  expect(marketplaceQuery({ ...input, query: "Apple iPad Pro M4 256GB Wi-Fi for graphic design" })).toBe("tablet apple ipad pro m4 256gb wi-fi");
  expect(marketplaceQuery({ ...input, query: "Apple iPad under $1.5k" })).toBe("tablet apple ipad");
  expect(marketplaceQuery({ ...input, query: "A tablet for a graphic design student" })).toBe("tablet");
  expect(marketplaceQuery({ ...input, category: "Laptops", query: "Lenovo ThinkPad X1 under $1,500 for work" })).toBe("laptop lenovo thinkpad x1");
});
it("collects beyond four color listings before selecting four configurations of the same brand", async () => {
  const base = recorded.data.items[0];
  const variants = Array.from({ length: 12 }, (_, i) => {
    const model = ["iPad A16", "iPad Air M3", "iPad Pro M4", "iPad mini A17 Pro"][Math.floor(i / 3)];
    const color = ["Pink", "Blue", "Silver"][i % 3];
    const asin = `B${String(i).padStart(9, "0")}`;
    return { ...base, asin, url: `https://www.amazon.com/dp/${asin}`, title: `Apple ${model} 128GB — ${color}`,
      variantAttributes: [{ key: "Color", value: color }, { key: "Size", value: "128GB" }] };
  });
  const call = vi.fn().mockResolvedValueOnce({ jobId: "one" }).mockResolvedValueOnce({ status: "SUCCEEDED", items: variants });
  const products = await discoverMarketplace(call, { ...input, budget: 2000 });
  expect(products).toHaveLength(4);
  expect(products.map(p => p.name)).toEqual(expect.arrayContaining([
    expect.stringContaining("iPad A16"), expect.stringContaining("iPad Air M3"), expect.stringContaining("iPad Pro M4"), expect.stringContaining("iPad mini A17 Pro"),
  ]));
  expect(call.mock.calls.filter(([endpoint]) => endpoint === "apify/run-actor")).toHaveLength(1);
  const within = { ...products[0], id: "affordable", name: "Other model", price: 100 };
  expect(selectMarketplaceProducts([...products.map(p => ({ ...p, price: 3000 })), within], 2000)[0]).toEqual(within);
});
