import { z } from "zod";
import { discoverySchema, type Discovery } from "./model";
export const PENDING_MS = 180_000;
interface Entry { until: number; result?: Discovery; pendingUntil?: number; token?: string; runId?: string; observedAt?: string; }
export class ResearchGate {
  constructor(private state: DurableObjectState) {}
  async fetch(request: Request): Promise<Response> {
    const input = z.object({
      op: z.enum(["reserve", "finish", "fail", "attach"]),
      key: z.string().min(1).max(100), userId: z.string().min(1).max(150),
      token: z.string().optional(), runId: z.string().min(1).max(100).optional(), observedAt: z.iso.datetime().optional(), result: discoverySchema.optional(),
    }).parse(await request.json());
    const now = Date.now();
    const cacheKey = "cache:" + input.key;
    return this.state.storage.transaction(async tx => {
      const entry = await tx.get<Entry>(cacheKey);
      if (input.op === "reserve") {
        if (entry?.result && entry.until > now) return Response.json({ state: "cached", result: entry.result });
        if (entry?.pendingUntil && entry.pendingUntil > now) return Response.json({ state: "pending" });
        const token = crypto.randomUUID();
        await tx.put(cacheKey, { until: now + 86_400_000, pendingUntil: now + PENDING_MS, token, runId: entry?.until && entry.until > now ? entry.runId : undefined, observedAt: entry?.until && entry.until > now ? entry.observedAt : undefined });
        return Response.json({ state: "reserved", token, runId: entry?.until && entry.until > now ? entry.runId : undefined, observedAt: entry?.until && entry.until > now ? entry.observedAt : undefined });
      }
      if (!input.token || entry?.token !== input.token) return Response.json({ ok: false, state: "stale" }, { status: 409 });
      if (input.op === "attach" && input.runId) {
        await tx.put(cacheKey, { ...entry, runId: input.runId, observedAt: input.observedAt });
        return Response.json({ ok: true });
      }
      if (input.op === "finish" && input.result) {
        await tx.put(cacheKey, { until: now + 86_400_000, result: input.result });
      } else if (entry.runId) {
        // Preserve the already-started upstream job across a client disconnect/timeout.
        await tx.put(cacheKey, { until: entry.until, runId: entry.runId, observedAt: entry.observedAt });
      } else await tx.delete(cacheKey);
      return Response.json({ ok: true });
    });
  }
}
