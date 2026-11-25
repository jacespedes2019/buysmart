import type { ActionHandler } from "deepspace/worker";
import type { Env } from "../../worker";
import { comparisonSchema, discoverySchema, searchSchema, type Discovery } from "../buysmart/model";
import { searchIntentConflict } from "../buysmart/search-intent";
import { LiveProvider } from "../buysmart/providers";
export function liveAllowed(userId: string, env: Pick<Env, "LIVE_ENABLED" | "LIVE_USER_IDS">) {
  return env.LIVE_ENABLED === "true" && (env.LIVE_USER_IDS ?? "").split(",").map(s => s.trim()).includes(userId);
}
const gateFor = (env: Env) => env.RESEARCH_GATE.get(env.RESEARCH_GATE.idFromName("research-budget-v1"));
async function gateRequest(env: Env, body: Record<string, unknown>) {
  const response = await gateFor(env).fetch(new Request("https://internal/gate", { method: "POST", body: JSON.stringify(body) }));
  if (!response.ok) throw new Error("Research reservation is no longer current");
  return response.json() as Promise<{ state?: string; token?: string; runId?: string; observedAt?: string; result?: Discovery }>;
}
const discover: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  if (!liveAllowed(userId, env)) return { success: false, error: "Live research is disabled for this account. The free demo is available at /." };
  const parsed = searchSchema.safeParse(params);
  if (!parsed.success) return { success: false, error: "Enter a valid query, category, and budget between $25 and $10,000." };
  const input = parsed.data;
  const conflict = searchIntentConflict(input);
  if (conflict) return { success: false, error: conflict };
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ version: 5, userId, ...input, query: input.query.toLowerCase().replace(/\s+/g, " ") })));
  const key = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
  let token: string | undefined;
  try {
    const reservation = await gateRequest(env, { op: "reserve", key, userId });
    if (reservation.state === "cached" && reservation.result) return { success: true, data: discoverySchema.parse(reservation.result) };
    if (reservation.state !== "reserved" || !reservation.token) return { success: false, error: reservation.state === "pending"
      ? "An identical search is already running. Please wait before retrying."
      : "Research could not start. Please retry." };
    token = reservation.token;
    const provider = new LiveProvider((endpoint, body) => tools.integration(endpoint, body), {
      resumeRunId: reservation.runId,
      resumeObservedAt: reservation.observedAt,
      onRunAssigned: async (runId, observedAt) => { await gateRequest(env, { op: "attach", key, userId, token, runId, observedAt }); },
    });
    const result = discoverySchema.parse(await provider.search(input));
    await gateRequest(env, { op: "finish", key, userId, token, result });
    return { success: true, data: result };
  } catch (error) {
    console.warn("[research] action failed", { name: error instanceof Error ? error.name : "unknown" });
    if (token) {
      try { await gateRequest(env, { op: "fail", key, userId, token }); } catch { console.warn("[research] reservation cleanup failed"); }
    }
    return { success: false, error: error instanceof Error && !/reservation/.test(error.message) ? error.message : "Research is temporarily unavailable. Existing comparisons are safe." };
  }
};
const saveComparison: ActionHandler<Env> = async ({ params, tools }) => {
  const parsed = comparisonSchema.safeParse(params?.snapshot);
  if (!parsed.success || new TextEncoder().encode(JSON.stringify(parsed.data)).length > 60_000)
    return { success: false, error: "Comparison is invalid or too large. Check its query, budget, products, and weights." };
  // New immutable row; createdBy comes from the verified action caller, never from a client field.
  return tools.create("comparisons", { snapshot: parsed.data });
};
const researchStatus: ActionHandler<Env> = async ({ userId, env }) => {
  return { success: true, data: { enabled: liveAllowed(userId, env) } };
};
export const actions: Record<string, ActionHandler<Env>> = { discover, saveComparison, researchStatus };
