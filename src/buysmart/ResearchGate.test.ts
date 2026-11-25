import { afterEach, expect, it, vi } from "vitest";
import { ResearchGate, PENDING_MS } from "./ResearchGate";

function harness() {
  const values = new Map<string, unknown>();
  const tx = { get: async <T>(key: string) => values.get(key) as T | undefined,
    put: async (key: string, value: unknown) => { values.set(key, value); }, delete: async (key: string) => values.delete(key) };
  let tail: Promise<unknown> = Promise.resolve();
  const storage = { ...tx, transaction: <T>(fn: (transaction: typeof tx) => Promise<T>) => {
    const task = tail.then(() => fn(tx)); tail = task.catch(() => {}); return task;
  } };
  const gate = new ResearchGate({ storage } as unknown as DurableObjectState);
  return async (op: string, params: Record<string, unknown> = {}) => {
    const response = await gate.fetch(new Request("https://internal/gate", { method: "POST", body: JSON.stringify({ op, key: "same", userId: "alice", ...params }) }));
    return { status: response.status, ...await response.json() as { state?: string; token?: string; runId?: string; result?: unknown } };
  };
}
afterEach(() => vi.useRealTimers());
it("serializes simultaneous reservations and admits exactly one identical search", async () => {
  const g = harness();
  const results = await Promise.all(Array.from({ length: 8 }, () => g("reserve")));
  expect(results.filter(r => r.state === "reserved")).toHaveLength(1);
  expect(results.filter(r => r.state === "pending")).toHaveLength(7);
});
it("fences stale finish/fail, persists upstream IDs, and resumes without another start", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-23T00:00:00Z"));
  const g = harness(); const first = await g("reserve");
  await g("attach", { token: first.token, runId: "paid-run" });
  vi.advanceTimersByTime(PENDING_MS + 1);
  const second = await g("reserve");
  expect(second.runId).toBe("paid-run"); expect(second.token).not.toBe(first.token);
  expect((await g("fail", { token: first.token })).status).toBe(409);
  expect((await g("finish", { token: first.token, result: { products: [], explanation: "stale", warnings: [] } })).status).toBe(409);
  expect((await g("reserve")).state).toBe("pending");
  await g("finish", { token: second.token, result: { products: [], explanation: "current", warnings: [] } });
  expect((await g("reserve")).result).toMatchObject({ explanation: "current" });
});
it("retains an assigned paid job after failure without limiting retries or distinct searches", async () => {
  const g = harness(); const first = await g("reserve");
  await g("attach", { token: first.token, runId: "existing" });
  await g("fail", { token: first.token });
  expect((await g("reserve")).runId).toBe("existing");
  for (let i = 0; i < 12; i++) {
    expect((await g("reserve", { key: `different-${i}` })).state).toBe("reserved");
  }
});
it("isolates cache keys and expires cached results after 24 hours", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-23T00:00:00Z"));
  const g = harness(); const a = await g("reserve", { key: "alice-key" });
  await g("finish", { key: "alice-key", token: a.token, result: { products: [], explanation: "private", warnings: [] } });
  expect((await g("reserve", { userId: "bob", key: "bob-key" })).state).toBe("reserved");
  expect((await g("reserve", { key: "alice-key" })).state).toBe("cached");
  vi.advanceTimersByTime(86_400_001);
  expect((await g("reserve", { key: "alice-key" })).state).toBe("reserved");
});
