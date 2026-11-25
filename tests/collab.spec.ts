/**
 * Multi-user collaboration spec — verifies two users sign in into
 * separate browser contexts and the app distinguishes them.
 *
 * `users(2)` takes any two accounts from your pool, so this spec passes on a
 * fresh app with no setup beyond having two test accounts:
 *   npx deepspace test accounts list
 *   npx deepspace test accounts create --email a@deepspace.test --name "A" --password-stdin
 *
 * Ask for accounts *by name* (`users(['Alice', 'Bob'])`) only when the
 * behaviour under test depends on which identity acts — otherwise naming them
 * couples the spec to one machine's pool.
 *
 * The `users` fixture handles sign-in caching (per-account storageState
 * persisted to `~/.deepspace/playwright-states/`), context creation, and
 * cleanup. No need to manage browser contexts manually.
 */
import { test, expect, loadAllTestAccounts } from "deepspace/testing";

// A machine that has never created test accounts is the normal state of a
// fresh checkout, and there `users()` throws — turning "you have no pool yet"
// into three red tests about the app, which it is not. Skip the file instead
// and say what creates the pool. The count is of accounts usable HERE: the
// pool is global per developer, but passwords live only on the machine that
// created the account.
const usableTestAccounts = loadAllTestAccounts().length;
test.skip(
  usableTestAccounts < 2,
  `Needs 2 usable test accounts, found ${usableTestAccounts}. Create them with ` +
    '`npx deepspace test accounts create --email <name>@deepspace.test --name "<name>" ' +
    "--password-stdin`, or fetch existing pool accounts with `npx deepspace test accounts recover --all`.",
);

test("private comparisons survive reload and remain isolated between users", async ({
  users,
}) => {
  const [a, b] = await users(2, { label: "buysmart" });
  await Promise.all([a.page.goto("/home"), b.page.goto("/home")]);
  const unique = "Private study tablet " + Date.now();
  await a.page.getByLabel("Product requirements").fill(unique);
  await a.page.getByRole("button", { name: "Discover demo products" }).click();
  await a.page.getByRole("button", { name: "Compare shortlist" }).click();
  const save = a.page.getByRole("button", {
    name: "Save comparison",
    exact: true,
  });
  await expect(save).toBeEnabled({ timeout: 15000 });
  await save.click();
  await expect(a.page.getByRole("status")).toContainText("private account", {
    timeout: 15000,
  });
  await a.page.reload();
  await a.page.getByRole("button", { name: "History", exact: true }).click();
  await expect(
    a.page.getByRole("heading", { name: unique, exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await b.page.getByRole("button", { name: "History", exact: true }).click();
  await expect(
    b.page.getByRole("heading", { name: unique, exact: true }),
  ).toHaveCount(0);
  await a.page
    .locator(".history-list article")
    .filter({ hasText: unique })
    .getByRole("button", { name: "Reopen" })
    .click();
  await expect(a.page.locator("table")).toBeVisible();
  await expect(a.page.getByRole("status")).toContainText("No credits used");
  await a.page.getByRole("button", { name: "History", exact: true }).click();
  await a.page
    .getByRole("button", { name: "Delete " + unique, exact: true })
    .click();
  await expect(
    a.page.getByRole("heading", { name: unique, exact: true }),
  ).toHaveCount(0);
});

test("API status page renders loading success and error states", async ({
  users,
}) => {
  const [user] = await users(1);
  let shouldFail = false;
  let requestCount = 0;
  let releaseResponse = () => {};
  const responseReady = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });

  await user.page.route("**/api/integrations", async (route) => {
    requestCount += 1;
    if (shouldFail) {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "Catalog unavailable" }),
      });
      return;
    }

    await responseReady;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { integrations: { openai: {}, wikipedia: {} } },
      }),
    });
  });

  await user.page.goto("/api-status");
  await expect(
    user.page.getByText("Loading integration catalog..."),
  ).toBeVisible();
  releaseResponse();
  await expect(user.page.getByText("Integration catalog ready")).toBeVisible();
  await expect(user.page.getByText("2 integrations available.")).toBeVisible();

  shouldFail = true;
  await user.page.getByRole("button", { name: "Refresh" }).click();
  await expect(user.page.getByText("Catalog unavailable")).toBeVisible();
  await expect(
    user.page.getByText("Showing the last loaded catalog"),
  ).toBeVisible();
  await expect(user.page.getByText("Integration catalog ready")).toBeVisible();

  const urlAfterFailure = user.page.url();
  const requestsAfterFailure = requestCount;
  await user.page.getByRole("button", { name: "Refresh" }).click();
  await expect.poll(() => requestCount).toBeGreaterThan(requestsAfterFailure);
  expect(user.page.url()).toBe(urlAfterFailure);
});

test("API status page shows local retry after first-load API failure", async ({
  users,
}) => {
  const [user] = await users(1);
  let requestCount = 0;
  let releaseResponse = () => {};
  const responseReady = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });

  await user.page.route("**/api/integrations", async (route) => {
    requestCount += 1;
    await responseReady;
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ success: false, error: "Catalog unavailable" }),
    });
  });

  await user.page.goto("/api-status");
  await expect(
    user.page.getByText("Loading integration catalog..."),
  ).toBeVisible();
  releaseResponse();
  await expect(user.page.getByText("Could not load API data")).toBeVisible();
  await expect(
    user.page.getByText("Retried 1 time automatically."),
  ).toBeVisible();

  const retryButton = user.page.getByRole("button", { name: "Retry" });
  await expect(retryButton).toBeVisible();

  const urlAfterFailure = user.page.url();
  const requestsAfterFailure = requestCount;
  await retryButton.click();
  await expect.poll(() => requestCount).toBeGreaterThan(requestsAfterFailure);
  expect(user.page.url()).toBe(urlAfterFailure);
});

test("native tool requests cannot read, update, delete, or overwrite another user's comparison", async ({ users }) => {
  const [a, b] = await users(2);
  await Promise.all([a.page.goto("/home"), b.page.goto("/home")]);
  await a.page.getByLabel("Product requirements").fill("__test-private-wire-" + Date.now());
  await a.page.getByRole("button", { name: "Discover demo products" }).click();
  await a.page.getByRole("button", { name: "Compare shortlist" }).click();
  await expect(a.page.getByRole("button", { name: "Save comparison", exact: true })).toBeEnabled();
  const saved = a.page.waitForResponse(response => response.url().endsWith("/api/actions/saveComparison"));
  await a.page.getByRole("button", { name: "Save comparison", exact: true }).click();
  const recordId = (await (await saved).json()).data.recordId as string;
  expect(recordId).toBeTruthy();
  const modulePath = "/src/buysmart/actions-client.ts";
  try {
    await expect.poll(async () => b.page.evaluate(async path => {
      const { actionHeaders } = await import(path);
      return (await fetch("/_deepspace/agent/browser/tools", { headers: await actionHeaders() })).status;
    }, modulePath)).toBe(200);
    const metadata = await b.page.evaluate(async path => {
      const { actionHeaders } = await import(path);
      return (await fetch("/_deepspace/agent/browser/tools", { headers: await actionHeaders() })).json();
    }, modulePath) as { tools: { name: string }[] };
    expect(metadata.tools.map((tool: { name: string }) => tool.name)).toEqual(expect.arrayContaining(["records_get", "records_update", "records_delete", "records_create"]));
    for (const [name, input] of [
      ["records_get", { collection: "comparisons", recordId }],
      ["records_update", { collection: "comparisons", recordId, data: { snapshot: {} } }],
      ["records_delete", { collection: "comparisons", recordId }],
      ["records_create", { collection: "comparisons", recordId, data: { snapshot: {} } }],
    ] as const) {
      const response = await b.page.evaluate(async ({ path, name, input }) => {
        const { actionHeaders } = await import(path);
        return (await fetch(`/_deepspace/agent/browser/tools/${name}`, { method: "POST", headers: await actionHeaders(), body: JSON.stringify({ input }) })).json();
      }, { path: modulePath, name, input }) as { ok?: boolean; result?: { success?: boolean; data?: { record?: unknown } } };
      expect(response.ok === false || response.result?.success === false).toBe(true);
      expect(response.result?.data?.record).toBeUndefined();
    }
    const invalid = await a.page.evaluate(async path => {
      const { actionHeaders } = await import(path);
      return (await fetch("/api/actions/saveComparison", { method: "POST", headers: await actionHeaders(), body: JSON.stringify({ snapshot: { budget: 0 } }) })).json();
    }, modulePath) as { success: boolean };
    expect(invalid.success).toBe(false);
  } finally {
    // Cleanup as the real owner through native RBAC, including on assertion failure.
    await a.page.evaluate(async ({ path, recordId }) => {
      const { actionHeaders } = await import(path);
      await fetch("/_deepspace/agent/browser/tools/records_delete", { method: "POST", headers: await actionHeaders(), body: JSON.stringify({ input: { collection: "comparisons", recordId } }) });
    }, { path: modulePath, recordId });
  }
});

test("private price watches survive reload, support targets and pause, and reject foreign edits", async ({ users }) => {
  const [a,b] = await users(2);
  await Promise.all([a.page.goto("/home"), b.page.goto("/home")]);
  await a.page.getByRole("button", { name: "Price alerts", exact: true }).click();
  await b.page.getByRole("button", { name: "Price alerts", exact: true }).click();
  const checksA = a.page.getByRole("checkbox", { name: "Automatically check my followed products" });
  const checksB = b.page.getByRole("checkbox", { name: "Automatically check my followed products" });
  await checksA.click();
  await expect(checksA).toBeChecked();
  await expect(checksB).not.toBeChecked();
  await checksA.click();
  await expect(checksA).not.toBeChecked();
  const title = "Price watch test " + Date.now();
  await a.page.getByLabel("Amazon ASIN", { exact: true }).fill("B0DZ75TN5F");
  await a.page.getByLabel("Product name", { exact: true }).fill(title);
  await a.page.getByLabel("Target price (USD)", { exact: true }).fill("300");
  const created = a.page.waitForResponse(r => r.url().endsWith("/api/actions/watchPrice"));
  await a.page.getByRole("button", { name: "Save price watch", exact: true }).click();
  const body = await (await created).json(); expect(body.success).toBe(true);
  const id = body.data.recordId as string;
  const card = a.page.locator(".watch-card").filter({ hasText: title });
  try {
    await expect(card).toContainText("No observed prices yet");
    await expect(b.page.getByRole("heading", { name: title, exact: true })).toHaveCount(0);
    await a.page.reload(); await a.page.getByRole("button", { name: "Price alerts", exact: true }).click();
    await expect(card).toBeVisible();
    await card.getByLabel("Target for " + title, { exact: true }).fill("250");
    await card.getByRole("button", { name: "Update target", exact: true }).click();
    await expect(card).toContainText("Target: $250");
    await card.getByRole("button", { name: "Pause watch", exact: true }).click();
    await expect(card.getByRole("button", { name: "Resume watch", exact: true })).toBeVisible();
    await card.getByRole("button", { name: "Resume watch", exact: true }).click();
    await expect(card.getByRole("button", { name: "Pause watch", exact: true })).toBeVisible();
    const foreign = await b.page.evaluate(async recordId => {
      const { actionHeaders } = await import(String("/src/buysmart/actions-client.ts"));
      return (await fetch("/api/actions/editPriceWatch", { method: "POST", headers: await actionHeaders(), body: JSON.stringify({ id: recordId, target: 1 }) })).json();
    }, id) as { success: boolean };
    expect(foreign.success).toBe(false);
    for (const [name, input] of [
      ["records_get", { collection: "priceWatches", recordId: id }],
      ["records_update", { collection: "priceWatches", recordId: id, data: { report: { history: [{ price: 1 }] } } }],
      ["records_delete", { collection: "priceWatches", recordId: id }],
      ["records_create", { collection: "priceWatches", recordId: id, data: { config: {} } }],
    ] as const) {
      const result = await b.page.evaluate(async ({ name, input }) => {
        const { actionHeaders } = await import(String("/src/buysmart/actions-client.ts"));
        return (await fetch(`/_deepspace/agent/browser/tools/${name}`, { method: "POST", headers: await actionHeaders(), body: JSON.stringify({ input }) })).json();
      }, { name, input }) as { ok?: boolean; result?: { success?: boolean } };
      expect(result.ok === false || result.result?.success === false).toBe(true);
    }
    await a.page.setViewportSize({ width: 390, height: 844 });
    await card.screenshot({ path: "docs/screenshots/mobile-price-watches.png" });
    expect(await a.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await card.getByRole("button", { name: "Delete watch", exact: true }).click();
    await expect(card).toHaveCount(0);
  }
});
