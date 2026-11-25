import { defaults, keys, type Product, type Weights } from "./model";
const clamp = (n: number) => Math.max(0, Math.min(100, n));
export function normalizeWeights(input: Weights): Weights {
  const values = keys.map((k) =>
    Number.isFinite(input[k]) ? Math.max(0, input[k]) : 0,
  );
  // Scaling before summing prevents overflow for large but finite inputs.
  const scale = Math.max(...values);
  const scaled = values.map(value => scale ? value / scale : 0);
  const total = scaled.reduce((a, b) => a + b, 0);
  return Object.fromEntries(
    keys.map((k, i) => [k, total ? (scaled[i] / total) * 100 : defaults[k]]),
  ) as Weights;
}
export function withinBudget(product: Product, budget: number) {
  return product.price !== null && product.price <= budget;
}
export function scoreProduct(product: Product, budget: number, input: Weights) {
  const weights = normalizeWeights(input);
  const values = {
    price:
      product.price === null || budget <= 0
        ? null
        : clamp((1 - product.price / budget) * 100),
    rating: product.rating === null ? null : (product.rating / 5) * 100,
    performance: product.evidence.performance?.score ?? null,
    compatibility: product.evidence.compatibility?.score ?? null,
    features: product.evidence.features?.score ?? null,
  };
  const contributions = Object.fromEntries(
    keys.map((k) => [k, ((values[k] ?? 0) * weights[k]) / 100]),
  ) as Weights;
  return {
    product,
    values,
    contributions,
    score: Object.values(contributions).reduce((a, b) => a + b, 0),
    coverage:
      (keys.filter((k) => values[k] !== null).length / keys.length) * 100,
    overBudget: product.price !== null && product.price > budget,
  };
}
export function rankProducts(
  products: Product[],
  budget: number,
  weights: Weights,
) {
  return products
    .map((p) => scoreProduct(p, budget, weights))
    .sort(
      (a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id),
    );
}
export function deduplicate(products: Product[]) {
  const seen = new Set<string>();
  return products.filter((p) => {
    const key =
      p.url?.match(/\/dp\/([A-Z0-9]{10})/i)?.[1].toUpperCase() ??
      p.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
