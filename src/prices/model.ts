import { z } from "zod";
export const asinSchema = z.string().regex(/^[A-Z0-9]{10}$/);
export const watchConfigSchema = z.object({ asin: asinSchema, title: z.string().trim().min(1).max(300), target: z.number().positive().max(10000), paused: z.boolean(), since: z.iso.datetime(), acknowledged: z.string().nullable() });
export type WatchConfig = z.infer<typeof watchConfigSchema>;
export const observationSchema = z.object({ price: z.number().positive(), at: z.iso.datetime(), seller: z.string().nullable(), variant: z.string().nullable() });
export type Observation = z.infer<typeof observationSchema>;
export const reportSchema = z.object({ history: z.array(observationSchema).max(90), checkedAt: z.iso.datetime(), error: z.string().nullable(), below: z.boolean(), targetUsed: z.number(), alert: z.object({ key: z.string(), price: z.number(), at: z.iso.datetime() }).nullable() });
export type PriceReport = z.infer<typeof reportSchema>;
export interface WatchRow { recordId: string; createdBy: string; data: { config: WatchConfig; report?: PriceReport }; }
export function advanceReport(config: WatchConfig, previous: PriceReport | undefined, history: Observation[], now: string, error: string | null): PriceReport {
  const relevant = history.filter(o => o.at >= config.since).slice(-90);
  const latest = relevant.at(-1);
  const below = !!latest && latest.price <= config.target;
  const sameTarget = previous?.targetUsed === config.target;
  const alert = below ? sameTarget && previous?.below ? previous.alert : { key: `${config.target}:${latest.at}`, price: latest.price, at: latest.at } : null;
  return { history: relevant, checkedAt: now, error, below, targetUsed: config.target, alert };
}
