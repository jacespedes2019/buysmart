import { z } from "zod";
import { productSchema, safeUrl, type Product, type Search } from "./model";
import { deduplicate } from "./ranking";
import { stripExplicitBudget } from "./search-intent";

export const APIFY_ACTOR = "junglee/amazon-crawler";
export const APIFY_MAX_ITEMS = 12;
export const APIFY_PROVIDER_CAP_USD = 0.075;
type Call = (endpoint: string, body: unknown) => Promise<unknown>;
export interface MarketplaceOptions {
  resumeRunId?: string;
  resumeObservedAt?: string;
  onRunAssigned?: (runId: string, observedAt: string) => Promise<void>;
  wait?: (milliseconds: number) => Promise<void>;
}
export const MAX_COMPARISON_PRODUCTS = 4;
/** Deterministic keyword cleanup; keep the full requirements for Exa and specification extraction. */
export function marketplaceQuery(input: Search): string {
  const category = { Tablets: "tablet", Laptops: "laptop", Headphones: "headphones", Smartphones: "smartphone" }[input.category];
  const withoutBudget = stripExplicitBudget(input.query.toLowerCase());
  const filler = new Set(["a", "an", "the", "for", "and", "or", "with", "i", "want", "need", "looking", "please", "recommend", "best",
    "student", "students", "graphic", "design", "designer", "drawing", "school", "college", "university", "work", "gaming", "editing",
    "una", "un", "el", "la", "para", "de", "y", "con", "quiero", "necesito", "estudiante", "diseño", "grafico", "gráfico",
    "tablet", "tablets", "laptop", "laptops", "headphones", "smartphone", "smartphones", "canva", "capcut", "photoshop", "illustrator"]);
  const terms = [...new Set((withoutBudget.match(/[\p{L}\p{N}]+(?:[.-][\p{L}\p{N}]+)*/gu) ?? []).filter(t => !filler.has(t)))];
  if (input.category === "Tablets" && terms.includes("apple") && !terms.includes("ipad")) terms.push("ipad");
  return [category, ...terms].join(" ").slice(0, 500);
}
export function selectMarketplaceProducts(products: Product[], budget: number): Product[] {
  // Preserve marketplace relevance within each price bucket; never impose a one-product-per-brand rule.
  return collapseColorVariants(products).map((product, index) => ({ product, index }))
    .sort((a, b) => {
      const bucket = (p: Product) => p.price === null ? 2 : p.price <= budget ? 0 : 1;
      return bucket(a.product) - bucket(b.product) || a.index - b.index;
    }).slice(0, MAX_COMPARISON_PRODUCTS).map(entry => entry.product);
}
export function marketplaceRequest(input: Search) {
  return {
    actorId: APIFY_ACTOR,
    input: {
      categoryOrProductUrls: [{ url: `https://www.amazon.com/s?k=${encodeURIComponent(marketplaceQuery(input))}` }],
      maxItemsPerStartUrl: APIFY_MAX_ITEMS,
      maxSearchPagesPerStartUrl: 1,
      maxProductVariantsAsSeparateResults: 0,
      maxOffers: 0,
      scrapeSellers: false,
      scrapeProductVariantPrices: false,
      scrapeProductDetails: true,
      useCaptchaSolver: false,
      proxyCountry: "US",
      language: "en",
    },
    maxItems: APIFY_MAX_ITEMS,
    maxTotalChargeUsd: APIFY_PROVIDER_CAP_USD,
    timeout: 60,
  };
}
const itemSchema = z.object({
  title: z.string().trim().min(1),
  url: safeUrl,
  asin: z.string().regex(/^[A-Z0-9]{10}$/i),
  price: z.unknown().optional(), stars: z.unknown().optional(),
  thumbnailImage: z.unknown().optional(),
  inStock: z.boolean().nullable().optional(),
  seller: z.unknown().optional(), shippingPrice: z.unknown().optional(),
  productOverview: z.unknown().optional(),
  variantAttributes: z.unknown().optional(), error: z.unknown().optional(),
});
const amountSchema = z.object({ value: z.number().positive(), currency: z.enum(["$", "USD"]) });
export function normalizeMarketplaceItems(raw: unknown, observedAt = new Date().toISOString()): Product[] {
  const items = z.array(z.unknown()).max(100).parse(raw);
  return deduplicate(items.flatMap(item => {
    const parsed = itemSchema.safeParse(item);
    if (!parsed.success || parsed.data.error) return [];
    const p = parsed.data;
    const asin = p.asin.toUpperCase();
    const url = new URL(p.url);
    // The actor is fixed server-side to Amazon US; reject off-domain/currency surprises.
    if (url.protocol !== "https:" || !["amazon.com", "www.amazon.com"].includes(url.hostname)
      || url.pathname.match(/\/dp\/([A-Z0-9]{10})/i)?.[1].toUpperCase() !== asin) return [];
    const price = amountSchema.safeParse(p.price);
    const shipping = z.object({ value: z.number().nonnegative(), currency: z.enum(["$", "USD"]) }).safeParse(p.shippingPrice);
    const seller = z.object({ name: z.string().max(200) }).safeParse(p.seller);
    const variants = z.array(z.object({ key: z.string(), value: z.string() })).safeParse(p.variantAttributes);
    const variant = variants.success ? variants.data.map(v => `${v.key}: ${v.value}`).join(" · ").slice(0, 300) : null;
    const overview = z.array(z.object({ key: z.string(), value: z.string() })).safeParse(p.productOverview);
    const specs = overview.success ? overview.data.filter(spec => spec.key && spec.value && !["Brand", "Model Name"].includes(spec.key)).slice(0, 6)
      .map(spec => ({ label: spec.key.slice(0, 80), value: spec.value.slice(0, 200), sourceUrl: `https://www.amazon.com/dp/${asin}` })) : [];
    const normalized = productSchema.safeParse({
      id: asin, name: p.title.slice(0, 300),
      price: price.success ? price.data.value : null,
      rating: typeof p.stars === "number" && p.stars >= 0 && p.stars <= 5 ? p.stars : null,
      url: `https://www.amazon.com/dp/${asin}`,
      image: safeUrl.safeParse(p.thumbnailImage).success ? p.thumbnailImage : null,
      offer: { provider: "apify", currency: "USD", market: "US", observedAt, inStock: p.inStock ?? null,
        seller: seller.success ? seller.data.name : null, shipping: shipping.success ? shipping.data.value : null, variant },
      specs, strengths: [], weaknesses: [],
      evidence: { performance: null, compatibility: null, features: null },
      sources: [{ title: "Amazon product data via Apify", url: `https://www.amazon.com/dp/${asin}`,
        excerpt: `Observed ${observedAt}. ${price.success ? `USD ${price.data.value}` : "Price unavailable"}. ${variant ?? "Exact variant requires review"}. Taxes excluded; verify shipping and checkout total.`.slice(0, 1500) }],
    });
    return normalized.success ? [normalized.data] : [];
  })).slice(0, APIFY_MAX_ITEMS);
}
/** Collapse only listings whose declared difference is color; preserve configuration and offer provenance. */
export function collapseColorVariants(products: Product[]): Product[] {
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    const attributes = product.offer?.variant?.split(" · ") ?? [];
    const colorAttribute = attributes.find(attribute => /^(color|colour): /i.test(attribute));
    const color = colorAttribute?.replace(/^(color|colour): /i, "").trim();
    const configuration = attributes.filter(attribute => attribute !== colorAttribute).sort();
    let key = product.id;
    if (color && configuration.length) {
      const escaped = color.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu");
      const name = product.name.replace(pattern, "").replace(/[\s—–|,:-]+$/g, "").replace(/\s+/g, " ").trim().toLowerCase();
      if (name !== product.name.trim().toLowerCase()) key = JSON.stringify([name, configuration]);
    }
    const group = groups.get(key) ?? []; group.push(product); groups.set(key, group);
  }
  return [...groups.values()].map(group => [...group].sort((a, b) => {
    const availability = (p: Product) => p.offer?.inStock === true ? 0 : p.offer?.inStock === null ? 1 : 2;
    return availability(a) - availability(b) || (a.price ?? Infinity) - (b.price ?? Infinity) || a.id.localeCompare(b.id);
  })[0]);
}
export async function discoverMarketplace(call: Call, input: Search, options: MarketplaceOptions = {}): Promise<Product[]> {
  let runId = options.resumeRunId;
  const observedAt = options.resumeObservedAt ?? new Date().toISOString();
  if (!runId) {
    const started = z.object({ jobId: z.string().min(1).max(100) }).parse(await call("apify/run-actor", marketplaceRequest(input)));
    runId = started.jobId;
    // Persist the returned id before polling so a later attempt resumes this job.
    await options.onRunAssigned?.(runId, observedAt);
  }
  const wait = options.wait ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  const deadline = Date.now() + 75_000;
  for (let attempt = 0; attempt < 45 && Date.now() < deadline; attempt++) {
    const result = z.object({ status: z.string(), items: z.array(z.unknown()).optional() }).parse(
      await call("apify/get-run", { runId }),
    );
    if (result.status === "SUCCEEDED") return selectMarketplaceProducts(normalizeMarketplaceItems(result.items ?? [], observedAt), input.budget);
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(result.status)) {
      throw new Error("Amazon extraction did not complete. No automatic paid retry was made.");
    }
    await wait(1500);
  }
  throw new Error("Amazon extraction is still pending. An identical search can resume this job; no automatic paid retry was made.");
}
