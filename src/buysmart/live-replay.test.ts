import { expect, it, vi } from "vitest";
import { LiveProvider, completionJson } from "./providers";
import intent from "../../docs/live-verification/1-openai-chat-completion.json";
import research from "../../docs/live-verification/3-exa-search.json";
import truncated from "../../docs/live-verification/4-openai-chat-completion.json";
import currentResearch from "../../docs/live-verification/approved-1795491410782/2-response.json";
import currentExtraction from "../../docs/live-verification/approved-1795491410782/3-response.json";
import marketplace from "../../docs/live-verification/apify-probe/result.json";
it("accepts historical intent JSON and rejects the historically truncated extraction", () => {
  expect(completionJson(intent.data)).toHaveProperty("query");
  expect(() => completionJson(truncated.data)).toThrow();
});
it("replays actual Apify, Exa, and OpenAI envelopes without network or paid calls", async () => {
  const call = vi.fn().mockResolvedValueOnce({ success: true, data: { jobId: "recorded" } })
    .mockResolvedValueOnce(marketplace).mockResolvedValueOnce(research).mockResolvedValueOnce(truncated);
  const result = await new LiveProvider(call).search({ query: "Apple iPad A16 for a student", budget: 350, category: "Tablets" });
  expect(result.products).toHaveLength(1);
  expect(result.products[0].price).toBe(379);
  expect(result.products[0].specs.length).toBeGreaterThan(0);
  expect(result.products[0].evidence.performance).toBeNull();
  expect(result.warnings.join(" ")).toContain("malformed");
  expect(call).toHaveBeenCalledTimes(4);
});

it("accepts current live manufacturer quotes for the exact model family while retaining listing facts", async () => {
  const call = vi.fn().mockResolvedValueOnce({ success: true, data: { jobId: "recorded" } })
    .mockResolvedValueOnce(marketplace).mockResolvedValueOnce(currentResearch).mockResolvedValueOnce(currentExtraction);
  const result = await new LiveProvider(call).search({ query: "Apple iPad A16 for a student", budget: 350, category: "Tablets" });
  expect(result.products).toHaveLength(1);
  for (const product of result.products) {
    expect(product.specs.some(spec => spec.label === "Chip" && spec.value === "A16 chip")).toBe(true);
    expect(product.specs.some(spec => spec.label === "Memory Storage Capacity" && spec.value === "128 GB")).toBe(true);
    expect(product.evidence.compatibility).toBeNull();
  }
});
