import { test, expect } from "@playwright/test";
for (const mobile of [false, true])
  test(`demo journey ${mobile ? "mobile" : "desktop"}`, async ({ page }) => {
    await page.setViewportSize(
      mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    );
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const paid: string[] = [];
    page.on("request", (r) => {
      if (
        r.url().includes("/api/actions/") ||
        /\/api\/integrations\/[^/]+\/[^/]+/.test(r.url())
      )
        paid.push(r.url());
    });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Find what fits. Know why." }),
    ).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/${mobile ? "mobile" : "desktop"}-discovery.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Discover demo products" }).click();
    await expect(page.locator(".product-card")).toHaveCount(4);
    await page.getByLabel("Within budget", { exact: true }).check();
    await expect(page.locator(".product-card")).toHaveCount(3);
    await page.getByLabel("Within budget", { exact: true }).uncheck();
    await page
      .getByRole("button", { name: "Add to comparison", exact: true })
      .click();
    await page.getByRole("button", { name: "Compare shortlist" }).click();
    await expect(page.locator("table")).toBeVisible();
    const initial = await page.locator("tbody tr").first().innerText();
    await page.getByLabel("Fit for your needs weight").fill("100");
    await page.getByLabel("Affordability weight").fill("0");
    await expect(page.locator("tbody tr").first()).not.toHaveText(initial);
    await page
      .getByRole("button", { name: "Save comparison", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "saved in this browser",
    );
    await page.screenshot({
      path: `docs/screenshots/${mobile ? "mobile" : "desktop"}-comparison.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "History", exact: true }).click();
    await expect(page.locator(".history-list article")).toHaveCount(1);
    await page.reload();
    await page.getByRole("button", { name: "History", exact: true }).click();
    await page.getByRole("button", { name: "Reopen" }).click();
    await expect(page.locator("table")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("No credits used");
    await page.getByRole("button", { name: "History", exact: true }).click();
    await page.getByRole("button", { name: /Delete A tablet/ }).click();
    await expect(page.locator(".history-list article")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(paid).toEqual([]);
    expect(errors).toEqual([]);
  });
test("unrestricted paid proxy and unauthenticated actions are blocked", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/integrations/amazon/search-products", {
        data: { query: "tablet" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/actions/discover", { data: { query: "tablet" } })
    ).status(),
  ).toBe(401);
});

test("draft budget edits do not rewrite the compared or saved snapshot", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Discover demo products" }).click();
  const before = await page.locator(".score-row strong").first().innerText();
  await page.getByLabel("Maximum budget", { exact: true }).fill("");
  await expect(page.locator(".score-row strong").first()).toHaveText(before);
  await page.getByRole("button", { name: "Compare shortlist" }).click();
  await page.getByRole("button", { name: "Save comparison", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("saved in this browser");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("buysmart-demo-history-v1") ?? "[]"));
  expect(stored[0].budget).toBe(350);
  expect(stored[0].version).toBe(1);
});

test("populated mobile history wraps long queries and keyboard navigation names the active view", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await page.getByLabel("Product requirements").fill("A".repeat(500));
  await page.getByRole("button", { name: "Discover demo products" }).click();
  await page.getByRole("button", { name: "Compare shortlist" }).click();
  const targetSizes = await page.getByRole("button", { name: /^Remove / }).evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect(); return { width: rect.width, height: rect.height };
  }));
  expect(targetSizes.every(size => size.width >= 24 && size.height >= 24)).toBe(true);
  await page.getByRole("button", { name: "Save comparison", exact: true }).click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByRole("button", { name: "History", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(page.locator(".history-list article")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Reopen" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "Reopen" })).toBeInViewport();
});

test("recorded live offers show prices and variants, survive mode changes, and reopen without providers", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/__fixture_view", route => route.fulfill({ contentType: "text/html", body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true; const { mountFixturePage } = await import("/tests/fixture-page.tsx"); mountFixturePage();</script></body></html>' }));
  await page.goto("/__fixture_view");
  await page.getByRole("button", { name: "Research products" }).click();
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(page.locator(".price-row strong").first()).toHaveText("$379");
  await expect(page.locator(".offer-details").filter({ hasText: "Color: Blue" })).toHaveCount(1);
  await expect(page.locator(".offer-details").first()).toContainText("Shipping: unknown");
  await expect(page.locator(".offer-details").first()).toContainText("Taxes excluded");
  await page.getByLabel("Live research", { exact: true }).uncheck();
  await expect(page.locator(".product-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Compare shortlist" }).click();
  await expect(page.locator(".recommendation h2")).toContainText("Apple iPad");
  await page.getByRole("button", { name: "Save comparison", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("saved in this browser");
  await page.screenshot({ path: "docs/screenshots/live-comparison-replay.png", fullPage: true });
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByRole("button", { name: "Reopen" }).click();
  await expect(page.getByRole("status")).toContainText("No credits used");
  const modulePath = "/tests/fixture-page.tsx";
  expect(await page.evaluate(async path => (await import(path)).integrationCalls, modulePath)).toEqual([
    "apify/run-actor", "apify/get-run", "exa/search", "openai/chat-completion",
  ]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("text and fields stay synchronized and ambiguous requirements block research", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", r => { if (/\/api\/(actions|integrations)\//.test(r.url())) requests.push(r.url()); });
  await page.goto("/");
  const query = page.getByLabel("Product requirements", { exact: true });
  const budget = page.getByLabel("Maximum budget", { exact: true });
  const category = page.getByLabel("Category", { exact: true });
  const search = page.getByRole("button", { name: "Discover demo products" });
  await query.fill("A tablet under $500 for a graphic design student apple");
  await expect(budget).toHaveValue("500");
  await expect(category).toHaveValue("Tablets");
  await budget.fill("700");
  await expect(query).toHaveValue("A tablet under $700 for a graphic design student apple");
  await category.selectOption("Laptops");
  await expect(query).toHaveValue("A laptop under $700 for a graphic design student apple");
  await query.fill("Headphones under $250 for working from home");
  await expect(budget).toHaveValue("250");
  await expect(category).toHaveValue("Headphones");
  await expect(search).toBeEnabled();
  await query.fill("A tablet under $500 or $700");
  await expect(search).toBeDisabled();
  await expect(page.locator("#search-interpretation")).toContainText("one maximum budget");
  await query.fill("A tablet or laptop under $500");
  await expect(search).toBeDisabled();
  await expect(page.locator("#search-interpretation")).toContainText("one product category");
  await query.fill("A tablet under $500 for design");
  await expect(search).toBeEnabled();
  await search.click();
  await expect(page.locator(".product-card")).toHaveCount(4);
  expect(requests).toEqual([]);
});
