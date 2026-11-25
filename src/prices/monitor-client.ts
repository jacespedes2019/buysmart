import type { Env } from "../../worker";
import type { Observation } from "./model";
export interface MonitorResult { lastAttempt?: number; state?: string; token?: string; runId?: string; observedAt?: string; history: Observation[]; error?: string | null; enabled?: boolean; remaining?: number; todayRemaining?: number; }
export async function monitor(env: Env, body: Record<string, unknown>): Promise<MonitorResult> {
  const stub = env.PRICE_MONITOR.get(env.PRICE_MONITOR.idFromName("amazon-us-price-monitor-v1"));
  const response = await stub.fetch(new Request("https://internal/prices", { method: "POST", body: JSON.stringify(body) }));
  if (!response.ok) throw new Error("Price monitor request failed");
  return response.json();
}
