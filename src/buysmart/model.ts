import { z } from 'zod'
export const keys = ['price', 'performance', 'compatibility', 'rating', 'features'] as const
export type Criterion = typeof keys[number]
export const labels: Record<Criterion, string> = { price: 'Affordability', performance: 'Performance', compatibility: 'Fit for your needs', rating: 'Customer ratings', features: 'Extra features' }
export type Weights = Record<Criterion, number>
export const defaults: Weights = { price: 25, performance: 25, compatibility: 25, rating: 15, features: 10 }
export const safeUrl = z.string().url().refine(v => ['https:', 'http:'].includes(new URL(v).protocol), 'Unsafe source URL')
export const sourceSchema = z.object({ title: z.string().max(250), url: safeUrl, excerpt: z.string().max(1500) })
export const evidenceSchema = z.object({ score: z.number().min(0).max(100), reason: z.string().max(500), sourceUrls: z.array(safeUrl).min(1).max(5) })
export const productSchema = z.object({
 id: z.string(), name: z.string().min(1).max(300), price: z.number().positive().nullable(), rating: z.number().min(0).max(5).nullable(), url: safeUrl.nullable(), image: safeUrl.nullable(),
 specs: z.array(z.object({ label: z.string().max(80), value: z.string().max(200), sourceUrl: safeUrl })).max(12),
 strengths: z.array(z.string().max(300)).max(5), weaknesses: z.array(z.string().max(300)).max(5),
 evidence: z.object({ performance: evidenceSchema.nullable(), compatibility: evidenceSchema.nullable(), features: evidenceSchema.nullable() }), sources: z.array(sourceSchema).max(12),
})
export type Product = z.infer<typeof productSchema>
export const searchSchema = z.object({ query: z.string().trim().min(8).max(500), budget: z.number().min(25).max(10000), category: z.enum(['Tablets','Laptops','Headphones','Smartphones']) })
export type Search = z.infer<typeof searchSchema>
export const comparisonSchema = z.object({ id: z.string(), query: z.string(), budget: z.number().positive(), category: searchSchema.shape.category, products: z.array(productSchema).min(1).max(4), weights: z.object({price:z.number().nonnegative(),performance:z.number().nonnegative(),compatibility:z.number().nonnegative(),rating:z.number().nonnegative(),features:z.number().nonnegative()}), createdAt: z.string(), mode: z.enum(['demo','live']), explanation: z.string() })
export type Comparison = z.infer<typeof comparisonSchema>
export interface Discovery { products: Product[]; explanation: string; warnings: string[] }
export interface ProductProvider { search(input: Search): Promise<Discovery> }
