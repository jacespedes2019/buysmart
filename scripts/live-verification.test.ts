import { test, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { LiveProvider } from "../src/buysmart/providers";
import { discoverySchema } from "../src/buysmart/model";
// Separate opt-in; never included by ordinary tests. Obtain owner approval before enabling.
test.skipIf(process.env.BUYSMART_APPROVED_LIVE_TEST !== "true")("approved bounded marketplace and evidence flow", async () => {
  const directory = `docs/live-verification/approved-${Date.now()}`;
  mkdirSync(directory, { recursive: true });
  if (process.env.BUYSMART_RESUME_RUN_ID && !process.env.BUYSMART_RESUME_OBSERVED_AT) throw new Error("Provide the original run observation timestamp when resuming");
  const paidCeiling = process.env.BUYSMART_RESUME_RUN_ID ? 2 : 3;
  let paidCalls = 0;
  let calls = 0;
  const paid = new Set(["apify/run-actor", "exa/search", "openai/chat-completion"]);
  const provider = new LiveProvider(async (endpoint, body) => {
    if (!paid.has(endpoint) && endpoint !== "apify/get-run") throw new Error("Endpoint outside approved flow");
    if (paid.has(endpoint) && ++paidCalls > paidCeiling) throw new Error("Three-paid-call ceiling reached");
    if (++calls > 48) throw new Error("Total request ceiling reached");
    const requestPath = `${directory}/${calls}-request.json`;
    const responsePath = `${directory}/${calls}-response.json`;
    writeFileSync(requestPath, JSON.stringify({ endpoint, body }, null, 2));
    const bodyPath = `${directory}/body.json`;
    writeFileSync(bodyPath, JSON.stringify(body));
    let output: string;
    try {
      output = execFileSync("npx", ["--no-install", "deepspace", "integrations", "invoke", endpoint,
        "--body-file", bodyPath, ...(paid.has(endpoint) ? ["--yes"] : []), "--timeout", "30000", "--json"], { encoding: "utf8", timeout: 35000 });
    } catch (error) {
      const failure = error as { stdout?: string; stderr?: string };
      writeFileSync(responsePath, failure.stdout || JSON.stringify({ error: failure.stderr || "Invocation failed" }));
      throw error; // Never retry a paid invocation after ambiguous transport failure.
    }
    writeFileSync(responsePath, output);
    return JSON.parse(output) as unknown;
  }, process.env.BUYSMART_RESUME_RUN_ID ? {
    resumeRunId: process.env.BUYSMART_RESUME_RUN_ID,
    resumeObservedAt: process.env.BUYSMART_RESUME_OBSERVED_AT,
  } : {});
  const result = discoverySchema.parse(await provider.search({ query: "Apple iPad A16 128GB for a student", budget: 400, category: "Tablets" }));
  writeFileSync(`${directory}/result.json`, JSON.stringify(result, null, 2));
  expect(paidCalls).toBe(paidCeiling);
  expect(result.warnings.join(" ")).not.toContain("Independent research is unavailable");
  expect(result.products.length).toBeGreaterThan(0);
  expect(result.products.some(p => p.price !== null)).toBe(true);
  expect(result.warnings.join(" ")).not.toContain("malformed");
  console.info(JSON.stringify({ directory, paidCalls, totalCalls: calls, pricedProducts: result.products.filter(p => p.price !== null).length, warnings: result.warnings }));
}, 180000);

// Marketplace-only probe: no Exa reservation (which can exceed a small approved budget).
test.skipIf(process.env.BUYSMART_APPROVED_LIVE_TEST !== "true")("approved marketplace variety probe", async () => {
  const { discoverMarketplace } = await import("../src/buysmart/apify");
  const directory = `docs/live-verification/variety-${Date.now()}`;
  mkdirSync(directory, { recursive: true });
  let starts = 0; let calls = 0;
  const products = await discoverMarketplace(async (endpoint, body) => {
    if (!["apify/run-actor", "apify/get-run"].includes(endpoint)) throw new Error("Unapproved endpoint");
    if (endpoint === "apify/run-actor" && ++starts > 1) throw new Error("No paid retries");
    const file = `${directory}/${++calls}-request.json`;
    writeFileSync(file, JSON.stringify(body, null, 2));
    const output = execFileSync("npx", ["--no-install", "deepspace", "integrations", "invoke", endpoint, "--body-file", file,
      ...(endpoint === "apify/run-actor" ? ["--yes"] : []), "--timeout", "30000", "--json"], { encoding: "utf8", timeout: 35000 });
    writeFileSync(`${directory}/${calls}-response.json`, output);
    const envelope = JSON.parse(output);
    if (!envelope.success) throw new Error("Marketplace probe failed; no retry made");
    return envelope.data;
  }, { query: "A tablet under $2000 for a graphic design student apple", budget: 2000, category: "Tablets" });
  writeFileSync(`${directory}/result.json`, JSON.stringify({ products, starts, calls, note: "Marketplace only; no new Exa/OpenAI calls." }, null, 2));
  expect(products.length).toBeGreaterThan(0);
  expect(products.some(p => p.price !== null)).toBe(true);
  console.info(JSON.stringify({ directory, products: products.map(p => ({ id: p.id, name: p.name, price: p.price })) }));
}, 180000);
