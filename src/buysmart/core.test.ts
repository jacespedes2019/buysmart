import { canRead, canUpdate, canDelete } from "deepspace/worker";
import { describe, expect, it, vi } from "vitest";
import { defaults, keys, comparisonSchema, type Comparison } from "./model";
import { demoProducts } from "./fixtures";
import {
  deduplicate,
  normalizeWeights,
  rankProducts,
  scoreProduct,
  withinBudget,
} from "./ranking";
import { readHistory, saveHistory, deleteHistory } from "./history";
import { ResearchGate } from "./ResearchGate";
import { comparisonsSchema } from "../schemas/comparisons-schema";
import { liveAllowed } from "../actions";
const input = {
  query: "A creative study tablet",
  budget: 350,
  category: "Tablets" as const,
};
const products = demoProducts("Tablets");
const allPrice = {
  price: 100,
  performance: 0,
  compatibility: 0,
  rating: 0,
  features: 0,
};
const allFit = {
  price: 0,
  performance: 0,
  compatibility: 100,
  rating: 0,
  features: 0,
};
describe("deterministic decision engine", () => {
  it("normalizes weights, rejects negative/nonfinite inputs, and restores zero defaults", () => {
    expect(
      Object.values(normalizeWeights({ ...defaults, price: 50 })).reduce(
        (a, b) => a + b,
      ),
    ).toBeCloseTo(100);
    expect(
      normalizeWeights({
        price: 0,
        performance: 0,
        compatibility: 0,
        rating: 0,
        features: 0,
      }),
    ).toEqual(defaults);
    const n = normalizeWeights({ ...defaults, price: -10, rating: NaN });
    expect(n.price).toBe(0);
    expect(n.rating).toBe(0);
  });
  it("calculates known contributions exactly and reproduces results", () => {
    const p = { ...products[0], price: 175, rating: 5 };
    const r = scoreProduct(p, 350, defaults);
    expect(r.contributions.price).toBe(12.5);
    expect(r.contributions.rating).toBe(15);
    expect(r.score).toBeCloseTo(12.5 + 22 + 18 + 15 + 8);
    expect(rankProducts(products, 350, defaults)).toEqual(
      rankProducts([...products].reverse(), 350, defaults),
    );
  });
  it("handles unavailable evidence without redistributing weights", () => {
    const r = scoreProduct(
      {
        ...products[0],
        price: null,
        rating: null,
        evidence: { performance: null, compatibility: null, features: null },
      },
      350,
      defaults,
    );
    expect(r.score).toBe(0);
    expect(r.coverage).toBe(0);
    expect(keys.every((k) => r.values[k] === null)).toBe(true);
    expect(scoreProduct(products[3], 350, defaults).coverage).toBe(80);
  });
  it("flags budget excess and excludes unknown prices in strict filtering", () => {
    expect(scoreProduct(products[3], 350, defaults).overBudget).toBe(true);
    expect(scoreProduct(products[3], 350, defaults).values.price).toBe(0);
    expect(withinBudget({ ...products[0], price: null }, 350)).toBe(false);
    expect(products.filter((p) => withinBudget(p, 350))).toHaveLength(3);
  });
  it("changes ranking when preferences change", () => {
    expect(rankProducts(products, 350, allPrice)[0].product.id).toBe(
      "Tablets-2",
    );
    expect(rankProducts(products, 350, allFit)[0].product.id).toBe("Tablets-3");
  });
  it("deduplicates tracking variants of Amazon ASINs and normalized names", () => {
    expect(
      deduplicate([
        { ...products[0], url: "https://amazon.com/dp/B123456789?tag=a" },
        { ...products[1], url: "https://amazon.com/dp/B123456789?tag=b" },
      ]),
    ).toHaveLength(1);
    expect(
      deduplicate([products[0], { ...products[0], id: "duplicate" }]),
    ).toHaveLength(1);
  });
});
describe("saved comparisons and access policy", () => {
  const snapshot: Comparison = {
    id: "test",
    query: input.query,
    budget: 350,
    category: "Tablets",
    weights: defaults,
    products,
    createdAt: "2026-11-23T00:00:00Z",
    mode: "demo",
    explanation: "Demo",
  };
  function store() {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => {
        m.set(k, v);
      },
    };
  }
  it("saves, reopens exact snapshots and deletes without any providers", () => {
    const s = store();
    saveHistory(s, snapshot);
    expect(readHistory(s)[0]).toEqual({ ...snapshot, version: 1 });
    saveHistory(s, snapshot);
    expect(readHistory(s)).toHaveLength(1);
    deleteHistory(s, "test");
    expect(readHistory(s)).toEqual([]);
  });
  it("discards malformed stored history and unsafe URLs", () => {
    const s = store();
    s.setItem("buysmart-demo-history-v1", "broken");
    expect(readHistory(s)).toEqual([]);
    expect(
      comparisonSchema.safeParse({
        ...snapshot,
        products: [{ ...products[0], url: "javascript:alert(1)" }],
      }).success,
    ).toBe(false);
  });
  it("requires explicit server enablement AND allowlist", () => {
    expect(
      liveAllowed("a", { LIVE_ENABLED: "false", LIVE_USER_IDS: "a" }),
    ).toBe(false);
    expect(liveAllowed("b", { LIVE_ENABLED: "true", LIVE_USER_IDS: "a" })).toBe(
      false,
    );
    expect(liveAllowed("a", { LIVE_ENABLED: "true", LIVE_USER_IDS: "a" })).toBe(
      true,
    );
  });
  it("enforces isolation using the installed SDK permission engine", () => {
    expect(canUpdate(comparisonsSchema, "member", { createdBy: "alice", data: {} }, "alice")).toBe(false);
    const record = { createdBy: "alice", data: { snapshot: {} } };
    for (const check of [canRead, canDelete]) {
      expect(check(comparisonsSchema, "member", record, "alice")).toBe(true);
      expect(check(comparisonsSchema, "member", record, "bob")).toBe(false);
      expect(check(comparisonsSchema, "admin", record, "bob")).toBe(false);
    }
  });
  it("declares owner-only read/write/delete for every signed-in role", () => {
    for (const role of ["viewer", "member", "admin"]) {
      expect(comparisonsSchema.permissions?.[role]).toEqual({
        read: "own",
        create: false,
        update: false,
        delete: "own",
      });
    }
    expect(comparisonsSchema.permissions?.["*"]?.read).toBe(false);
  });
});
describe("durable research admission and cache", () => {
  function gate() {
    const m = new Map<string, unknown>();
    const tx = {
      get: async (k: string) => m.get(k),
      put: async (k: string, v: unknown) => {
        m.set(k, v);
      },
      delete: async (k: string) => m.delete(k),
    };
    const state = {
      storage: {
        ...tx,
        transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
      },
    } as unknown as DurableObjectState;
    const g = new ResearchGate(state);
    const tokens = new Map<string, string>();
    return async (op: string, key = "a", userId = "u", result?: unknown) => {
      const r = await g.fetch(
        new Request("https://internal", {
          method: "POST",
          body: JSON.stringify({ op, key, userId, result, token: tokens.get(key) }),
        }),
      );
      const response = await r.json() as { state: string; token?: string; result?: unknown };
      if (response.token) tokens.set(key, response.token);
      return response;
    };
  }
  it("deduplicates pending calls and returns cached results while allowing new queries", async () => {
    const g = gate();
    expect((await g("reserve")).state).toBe("reserved");
    expect((await g("reserve")).state).toBe("pending");
    await g("finish", "a", "u", {
      products: [],
      explanation: "cached",
      warnings: [],
    });
    expect((await g("reserve")).state).toBe("cached");
    expect((await g("reserve", "b")).state).toBe("reserved");
    expect((await g("reserve", "c")).state).toBe("reserved");
  });
  it("failed attempts do not impose a global search cap", async () => {
    const g = gate();
    for (let i = 0; i < 8; i++) {
      expect((await g("reserve", String(i), "u" + i)).state).toBe("reserved");
      await g("fail", String(i), "u" + i);
    }
    expect((await g("reserve", "ninth", "another-user")).state).toBe("reserved");
  });
});

