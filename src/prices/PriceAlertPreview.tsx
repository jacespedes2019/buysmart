import { useState } from "react";
import { PriceHistory } from "./PriceHistory";
const history = [{ price: 349, at: "2026-11-22T12:00:00.000Z", seller: "Demo seller", variant: "Sample configuration" },
  { price: 329, at: "2026-11-23T12:00:00.000Z", seller: "Demo seller", variant: "Sample configuration" }];
export function PriceAlertPreview() {
  const [dropped, setDropped] = useState(false);
  return <article className="watch-card"><span className="step-label">ILLUSTRATIVE PREVIEW · SYNTHETIC DATA</span><h2>A price alert in action</h2>
    <p>Sample tablet · target $300. This preview does not monitor a real product or use credits.</p>
    <PriceHistory history={dropped ? [...history, { ...history[0], price: 299, at: "2026-11-24T12:00:00.000Z" }] : history} />
    {dropped && <p className="target-alert" role="status">Demo target reached: $299. A real alert would use a dated Amazon observation.</p>}
    <button className="secondary" onClick={() => setDropped(!dropped)}>{dropped ? "Reset preview" : "Simulate price drop"}</button>
  </article>;
}
