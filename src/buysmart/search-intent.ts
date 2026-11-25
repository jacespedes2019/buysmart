import type { Search } from "./model";

const budgetPattern = /\b(?:under|below|less than|up to|maximum(?: budget)?(?: of)?|budget(?: of)?|menos de|hasta)\s*(?:USD\s*)?\$?\s*\d(?:[\d,.]*\d)?(?:\s*k\b)?(?:\s*(?:USD|dollars?|dólares))?|(?:\$|\bUSD\s+)\s*\d(?:[\d,.]*\d)?(?:\s*k\b)?/giu;
const categoryPatterns: Record<Search["category"], RegExp> = {
  Tablets: /\b(?:tablets?|tabletas?|ipads?)\b/giu,
  Laptops: /\b(?:laptops?|portátiles?|macbooks?)\b/giu,
  Headphones: /\b(?:headphones?|earbuds?|auriculares|audífonos)\b/giu,
  Smartphones: /\b(?:smartphones?|phones?|iphones?|teléfonos|móviles)\b/giu,
};
export function readSearchIntent(query: string) {
  const budgets = [...query.matchAll(budgetPattern)];
  const values = budgets.map(([text]) => {
    const amount = text.match(/\d(?:[\d,.]*\d)?/)?.[0] ?? "";
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(amount)) return NaN;
    return Number(amount.replaceAll(",", "")) * (/\d\s*k\b/i.test(text) ? 1000 : 1);
  });
  const categories = (Object.keys(categoryPatterns) as Search["category"][]).filter(category => query.match(categoryPatterns[category]));
  const issues: string[] = [];
  if (values.some(v => !Number.isFinite(v) || v < 25 || v > 10000)) issues.push("Use a USD budget between $25 and $10,000, for example ‘under $500’.");
  if (new Set(values).size > 1 || /\b(?:between|entre)\b[^.!?]*\d/i.test(query)) issues.push("Specify one maximum budget, rather than multiple amounts or a range.");
  if (/\b(?:under|below|less than|up to|budget|maximum|menos de|hasta)\b/iu.test(query.replace(budgetPattern, " "))) issues.push("Write the maximum budget as a number, for example ‘under $500’.");
  if (/(?:€|£|\b(?:EUR|GBP|euros?|pesos)\b)/iu.test(query)) issues.push("Budgets are in USD. Convert the amount and remove other currencies before searching.");
  if (categories.length > 1) issues.push("Choose one product category and remove the other category from the text.");
  return { budget: !issues.length && values.length ? values[0] : undefined,
    category: categories.length === 1 ? categories[0] : undefined, issues };
}
export function searchIntentConflict(input: Search): string | undefined {
  const intent = readSearchIntent(input.query);
  return intent.issues[0] ?? (intent.budget !== undefined && intent.budget !== input.budget
    ? "The budget in your text and Maximum budget must match. Edit either before searching."
    : intent.category && intent.category !== input.category ? "The category in your text and Category must match. Edit either before searching." : undefined);
}
export function rewriteBudget(query: string, budget: number): string {
  if (!Number.isFinite(budget) || budget < 25 || budget > 10000) return query;
  return query.replace(budgetPattern, `under $${budget}`);
}
export function rewriteCategory(query: string, category: Search["category"]): string {
  const intent = readSearchIntent(query);
  if (!intent.category || intent.category === category) return query;
  const noun = { Tablets: "tablet", Laptops: "laptop", Headphones: "headphones", Smartphones: "smartphone" }[category];
  return query.replace(categoryPatterns[intent.category], noun);
}

export function stripExplicitBudget(query: string): string {
  return query.replace(budgetPattern, " ");
}
