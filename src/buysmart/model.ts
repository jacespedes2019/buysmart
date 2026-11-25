import { z } from "zod";
export const keys = [
  "price",
  "performance",
  "compatibility",
  "rating",
  "features",
] as const;
export type Criterion = (typeof keys)[number];
export const labels: Record<Criterion, string> = {
  price: "Affordability",
  performance: "Performance",
  compatibility: "Fit for your needs",
  rating: "Customer ratings",
  features: "Extra features",
};
export type Weights = Record<Criterion, number>;
export const defaults: Weights = {
  price: 25,
  performance: 25,
  compatibility: 25,
  rating: 15,
  features: 10,
};
export const safeUrl = z
  .string()
  .url()
  .refine((v) => {
    try {
      return ["https:", "http:"].includes(new URL(v).protocol);
    } catch {
      return false;
    }
  }, "Unsafe source URL");
export const sourceSchema = z.object({
  title: z.string().max(250),
  url: safeUrl,
  excerpt: z.string().max(1500),
});
export const evidenceSchema = z.object({
  score: z.number().min(0).max(100),
  reason: z.string().max(500),
  sourceUrls: z.array(safeUrl).min(1).max(5),
});
export const productSchema = z.object({
  id: z.string().trim().min(1).max(150),
  name: z.string().min(1).max(300),
  price: z.number().positive().nullable(),
  rating: z.number().min(0).max(5).nullable(),
  url: safeUrl.nullable(),
  image: safeUrl.nullable(),
  offer: z.object({
    provider: z.literal("apify"), currency: z.literal("USD"), market: z.literal("US"),
    observedAt: z.iso.datetime(), inStock: z.boolean().nullable(),
    seller: z.string().max(200).nullable(), shipping: z.number().nonnegative().nullable(),
    variant: z.string().max(300).nullable(),
  }).optional(),
  specs: z
    .array(
      z.object({
        label: z.string().max(80),
        value: z.string().max(200),
        sourceUrl: safeUrl,
      }),
    )
    .max(12),
  strengths: z.array(z.string().max(300)).max(5),
  weaknesses: z.array(z.string().max(300)).max(5),
  evidence: z.object({
    performance: evidenceSchema.nullable(),
    compatibility: evidenceSchema.nullable(),
    features: evidenceSchema.nullable(),
  }),
  sources: z.array(sourceSchema).max(12),
});
export type Product = z.infer<typeof productSchema>;
export const searchSchema = z.object({
  query: z.string().trim().min(8).max(500),
  budget: z.number().min(25).max(10000),
  category: z.enum(["Tablets", "Laptops", "Headphones", "Smartphones"]),
});
export type Search = z.infer<typeof searchSchema>;
export const comparisonSchema = z.object({
  version: z.literal(1).default(1),
  id: z.string().trim().min(1).max(150),
  query: searchSchema.shape.query,
  budget: searchSchema.shape.budget,
  category: searchSchema.shape.category,
  products: z.array(productSchema).min(1).max(4).refine(
    products => new Set(products.map(p => p.id)).size === products.length,
    "Product IDs must be unique",
  ),
  weights: z.object({
    price: z.number().min(0).max(100),
    performance: z.number().min(0).max(100),
    compatibility: z.number().min(0).max(100),
    rating: z.number().min(0).max(100),
    features: z.number().min(0).max(100),
  }),
  createdAt: z.iso.datetime(),
  mode: z.enum(["demo", "live"]),
  explanation: z.string().max(2000),
});
export type Comparison = z.input<typeof comparisonSchema>;
export interface Discovery {
  products: Product[];
  explanation: string;
  warnings: string[];
}
export interface ProductProvider {
  search(input: Search, signal?: AbortSignal): Promise<Discovery>;
}

export const discoverySchema = z.object({
  products: z.array(productSchema).max(4),
  explanation: z.string().max(2000),
  warnings: z.array(z.string().max(1000)).max(12),
});
