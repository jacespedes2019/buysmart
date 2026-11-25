import { expect, it } from "vitest";
import { readSearchIntent, rewriteBudget, rewriteCategory, searchIntentConflict } from "./search-intent";

it("reads clear English and Spanish budgets, categories, separators and decimal shorthand", () => {
  for (const query of ["A tablet under $500 for design", "Una tableta hasta 500 USD para diseño", "iPad below $500."]) {
    expect(readSearchIntent(query)).toMatchObject({ budget: 500, category: "Tablets", issues: [] });
  }
  expect(readSearchIntent("MacBook under $1,500.50")).toMatchObject({ budget: 1500.5, category: "Laptops", issues: [] });
  expect(readSearchIntent("headphones below $1.5k")).toMatchObject({ budget: 1500, category: "Headphones", issues: [] });
  expect(readSearchIntent("iPhone for photography")).toMatchObject({ budget: undefined, category: "Smartphones", issues: [] });
});
it("rejects conflicting amounts, unsupported currencies, invalid budgets and multiple categories", () => {
  for (const query of ["tablet under $500 or $700", "tablet between $300 and $500", "tablet under $1,2,3", "tablet below $5", "tablet below $20000", "tablet under five hundred", "tablet under $", "tablet under", "tablet under €500", "tablet or laptop under $500"]) {
    expect(readSearchIntent(query).issues.length, query).toBeGreaterThan(0);
  }
});
it("updates explicit text from fields without inserting a budget or category that was not mentioned", () => {
  expect(rewriteBudget("A tablet under $500 for design", 700)).toBe("A tablet under $700 for design");
  expect(rewriteBudget("A tablet for design", 700)).toBe("A tablet for design");
  expect(rewriteBudget("A tablet under $500", 0)).toBe("A tablet under $500");
  expect(rewriteCategory("A tablet under $500 for design", "Laptops")).toBe("A laptop under $500 for design");
  expect(rewriteCategory("Something for design", "Laptops")).toBe("Something for design");
});
it("blocks inconsistent request fields while allowing implicit fields", () => {
  const input = { query: "A tablet under $500 for design", budget: 500, category: "Tablets" as const };
  expect(searchIntentConflict(input)).toBeUndefined();
  expect(searchIntentConflict({ ...input, budget: 700 })).toContain("budget");
  expect(searchIntentConflict({ ...input, category: "Laptops" })).toContain("category");
  expect(searchIntentConflict({ ...input, query: "For graphic design work" })).toBeUndefined();
});
