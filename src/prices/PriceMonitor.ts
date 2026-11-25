import { z } from "zod";
import { asinSchema, observationSchema, type Observation } from "./model";
interface State { history: Observation[]; lastAttempt?: number; pendingUntil?: number; token?: string; runId?: string; observedAt?: string; error?: string | null; }
export class PriceMonitor {
  constructor(private state: DurableObjectState) {}
  async fetch(request: Request) {
    const input = z.object({ op: z.enum(["status", "enable", "reserve", "attach", "finish", "fail"]), enabled: z.boolean().optional(), userId: z.string().min(1).max(150), asin: asinSchema.optional(), token: z.string().optional(), runId: z.string().min(1).optional(), observation: observationSchema.optional(), error: z.string().max(300).optional() }).parse(await request.json());
    const now = Date.now();
    return this.state.storage.transaction(async tx => {
      const preferenceKey = "user-enabled:" + input.userId;
      const enabled = await tx.get<boolean>(preferenceKey) ?? false;
      const total = await tx.get<number>("total") ?? 0;
      const dailyKey = "daily:" + new Date(now).toISOString().slice(0, 10);
      const daily = await tx.get<number>(dailyKey) ?? 0;
      if (input.op === "enable") { await tx.put(preferenceKey, input.enabled === true); return Response.json({ ok: true }); }
      if (input.op === "status") return Response.json({ enabled, remaining: Math.max(0, 20 - total), todayRemaining: Math.max(0, 5 - daily) });
      if (!input.asin) return Response.json({ error: "ASIN required" }, { status: 400 });
      const key = "asin:" + input.asin;
      const entry = await tx.get<State>(key) ?? { history: [] };
      if (input.op === "reserve") {
        if (entry.pendingUntil && entry.pendingUntil > now) return Response.json({ state: "pending", ...entry });
        const resumable = !!entry.runId && now - (entry.lastAttempt ?? 0) < 86400000;
        if (!resumable && entry.lastAttempt && now - entry.lastAttempt < 86400000) return Response.json({ state: "cached", ...entry });
        if (!enabled || !resumable && (total >= 20 || daily >= 5)) return Response.json({ state: "paused", ...entry });
        if (!resumable) { await tx.put("total", total + 1); await tx.put(dailyKey, daily + 1); }
        const value = { ...entry, token: crypto.randomUUID(), pendingUntil: now + 180000,
          lastAttempt: resumable ? entry.lastAttempt : now, runId: resumable ? entry.runId : undefined, observedAt: resumable ? entry.observedAt : new Date(now).toISOString() };
        await tx.put(key, value); return Response.json({ state: "reserved", ...value });
      }
      if (!input.token || input.token !== entry.token) return Response.json({ error: "Stale reservation" }, { status: 409 });
      if (input.op === "attach") { await tx.put(key, { ...entry, runId: input.runId }); return Response.json({ ok: true }); }
      if (input.op === "finish" && input.observation) {
        const prior = entry.history.at(-1);
        // A seller or configuration change must not masquerade as a price drop.
        if (prior && (prior.seller !== input.observation.seller || prior.variant !== input.observation.variant)) {
          await tx.put(key, { ...entry, runId: undefined, token: undefined, pendingUntil: undefined, error: "Seller or configuration changed; observation excluded. Waiting for the original offer to return." });
        } else await tx.put(key, { ...entry, history: [...entry.history, input.observation].slice(-90), runId: undefined, token: undefined, pendingUntil: undefined, error: null });
      } else await tx.put(key, { ...entry, token: undefined, pendingUntil: undefined, error: input.error ?? "Price check failed; previous observations retained." });
      const updated = await tx.get<State>(key);
      return Response.json({ ok: true, ...updated });
    });
  }
}
