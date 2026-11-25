// Browser component verification: only the external provider transport is replaced.
// This module is a test entry, not an application route or a production data source.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import BuySmart from "../src/buysmart/BuySmart";
import { LiveProvider } from "../src/buysmart/providers";
import { mockProvider } from "../src/buysmart/fixtures";
import marketplace from "../docs/live-verification/apify-probe/result.json";
import extraction from "../docs/live-verification/approved-1795491410782/3-response.json";
import research from "../docs/live-verification/approved-1795491410782/2-response.json";
import "../src/styles.css";
export const integrationCalls: string[] = [];
const provider = new LiveProvider(async endpoint => {
  integrationCalls.push(endpoint);
  if (endpoint === "apify/run-actor") return { success: true, data: { jobId: "recorded-browser-run" } };
  if (endpoint === "apify/get-run") return marketplace;
  if (endpoint === "exa/search") return research;
  if (endpoint === "openai/chat-completion") return extraction;
  throw new Error("Unexpected external endpoint");
}, { resumeObservedAt: "2026-11-24T03:15:42Z" });
function FixturePage() {
  const [live, setLive] = useState(true);
  return <BuySmart live={live} provider={live ? provider : mockProvider}
    account={<label><input type="checkbox" checked={live} onChange={event => setLive(event.target.checked)} />Live research</label>} />;
}
export function mountFixturePage() {
  const host = document.createElement("div"); document.body.appendChild(host);
  createRoot(host).render(<FixturePage />);
}
