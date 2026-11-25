// Explicit production smoke check; excluded from ordinary local test discovery.
// Run using a Playwright config pointing at the deployed app. Demo/watch CRUD only: no paid integrations.
import { test, expect } from "deepspace/testing";
test("production price watch CRUD and private isolation", async ({ users }) => {
  const [a,b] = await users(2);
  await Promise.all([a.page.goto("/home"), b.page.goto("/home")]);
  await a.page.getByRole("button", { name: "Price alerts", exact: true }).click();
  await b.page.getByRole("button", { name: "Price alerts", exact: true }).click();
  const title = "Production watch check " + Date.now();
  await a.page.getByLabel("Amazon ASIN", { exact: true }).fill("B0DZ75TN5F");
  await a.page.getByLabel("Product name", { exact: true }).fill(title);
  await a.page.getByLabel("Target price (USD)", { exact: true }).fill("300");
  await a.page.getByRole("button", { name: "Save price watch", exact: true }).click();
  const card = a.page.locator(".watch-card").filter({ hasText: title });
  try {
    await expect(card).toBeVisible();
    await expect(b.page.getByRole("heading", { name: title, exact: true })).toHaveCount(0);
    await a.page.reload(); await a.page.getByRole("button", { name: "Price alerts", exact: true }).click();
    await expect(card).toContainText("No observed prices yet");
    await card.getByLabel("Target for " + title, { exact: true }).fill("250");
    await card.getByRole("button", { name: "Update target", exact: true }).click();
    await expect(card).toContainText("Target: $250");
    await card.getByRole("button", { name: "Pause watch", exact: true }).click();
    await expect(card.getByRole("button", { name: "Resume watch", exact: true })).toBeVisible();
  } finally {
    await card.getByRole("button", { name: "Delete watch", exact: true }).click();
    await expect(card).toHaveCount(0);
  }
});

test("production SSR controls wait for hydration before accepting edits", async ({ page, request }) => {
  const html = await (await request.get("/")).text();
  expect(html).toMatch(/<textarea[^>]*disabled/);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/assets/*.js", async route => { await gate; await route.continue(); });
  try {
    await page.goto("/", { waitUntil: "commit" });
    const query = page.getByLabel("Product requirements", { exact: true });
    await expect(query).toBeDisabled();
    release();
    await expect(query).toBeEnabled();
    await query.fill("A tablet under $500 for a graphic design student apple");
    await expect(page.getByLabel("Maximum budget", { exact: true })).toHaveValue("500");
  } finally { release(); }
});
