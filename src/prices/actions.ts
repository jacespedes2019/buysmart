import { z } from "zod";
import type { ActionHandler } from "deepspace/worker";
import type { Env } from "../../worker";
import { asinSchema, watchConfigSchema, reportSchema, advanceReport } from "./model";
import { monitor } from "./monitor-client";
export const priceActions: Record<string, ActionHandler<Env>> = {
  watchPrice: async ({ userId, params, tools }) => {
    const parsed = z.object({ asin: asinSchema, title: z.string().trim().min(1).max(300), target: z.number().positive().max(10000) }).safeParse(params);
    if (!parsed.success) return { success: false, error: "Provide an exact ASIN, product name, and USD target above zero (maximum $10,000)." };
    const own = await tools.query("priceWatches", { where: { createdBy: userId }, limit: 6 });
    if (!own.success || !own.data) return { success: false, error: "Watchlist unavailable." };
    const existing = own.data.records.find(r => watchConfigSchema.safeParse(r.data.config).data?.asin === parsed.data.asin);
    if (!existing && own.data.records.length >= 5) return { success: false, error: "Follow up to five products. Remove one before adding another." };
    const old = watchConfigSchema.safeParse(existing?.data.config).data;
    const config = { ...parsed.data, paused: false, since: old?.since ?? new Date().toISOString(), acknowledged: null };
    if (existing) return tools.update("priceWatches", existing.recordId, { config });
    // Deterministic caller-scoped ID makes concurrent adds of the same ASIN idempotent.
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId + ":" + parsed.data.asin));
    const id = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
    return tools.create("priceWatches", { config }, id);
  },
  editPriceWatch: async ({ userId, params, tools }) => {
    const input = z.object({ id: z.string().min(1).max(150), paused: z.boolean().optional(), target: z.number().positive().max(10000).optional(), acknowledge: z.boolean().optional() }).safeParse(params);
    if (!input.success) return { success: false, error: "Invalid watch update." };
    const found = await tools.get("priceWatches", input.data.id);
    if (!found.success || !found.data || found.data.record.createdBy !== userId) return { success: false, error: "Watch unavailable." };
    const config = watchConfigSchema.parse(found.data.record.data.config);
    const report = reportSchema.safeParse(found.data.record.data.report).data;
    if (input.data.target !== undefined) { config.target = input.data.target; config.acknowledged = null; }
    if (input.data.paused !== undefined) config.paused = input.data.paused;
    if (input.data.acknowledge && report?.alert) config.acknowledged = report.alert.key;
    return tools.update("priceWatches", input.data.id, { config,
      ...(input.data.target !== undefined && report ? { report: advanceReport(config, report, report.history, report.checkedAt, report.error) } : {}) });
  },
  priceMonitorStatus: async ({ userId, env }) => {
    const status = await monitor(env, { op: "status" });
    return { success: true, data: { ...status, owner: userId === env.OWNER_USER_ID,
      eligible: env.LIVE_ENABLED === "true" && (env.LIVE_USER_IDS ?? "").split(",").map(s => s.trim()).includes(userId) } };
  },
  setPriceMonitoring: async ({ userId, params, env }) => {
    if (userId !== env.OWNER_USER_ID || params.confirm !== true || typeof params.enabled !== "boolean") return { success: false, error: "Only the owner can explicitly authorize or pause scheduled spending." };
    return { success: true, data: await monitor(env, { op: "enable", enabled: params.enabled }) };
  },
};
