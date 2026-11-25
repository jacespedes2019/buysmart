import { money } from "../buysmart/format";
import type { Observation } from "./model";
export function PriceHistory({ history }: { history: Observation[] }) {
  if (!history.length) return <p>No observed prices yet. Saving a watch does not make a paid API call.</p>;
  const prices = history.map(o => o.price); const low = Math.min(...prices); const high = Math.max(...prices);
  const first = Date.parse(history[0].at); const duration = Date.parse(history.at(-1)!.at) - first;
  const point = (o: Observation) => `${duration ? 12 + (Date.parse(o.at) - first) / duration * 296 : 160},${70 - (o.price - low) / (high - low || 1) * 48}`;
  return <>
    <svg viewBox="0 0 320 90" role="img" aria-label={`Observed USD price history: ${history.length} observation(s), lowest ${money(low)}`}>
      <line x1="12" y1="76" x2="308" y2="76" stroke="#d5dfd3" />
      {history.length > 1 && <polyline points={history.map(point).join(" ")} fill="none" stroke="#12614e" strokeWidth="2" />}
      {history.map(o => { const [cx,cy] = point(o).split(","); return <circle key={o.at} cx={cx} cy={cy} r="3" fill="#12614e"><title>{o.at}: {money(o.price)}</title></circle>; })}
    </svg>
    <p><strong>Lowest shown: {money(low)}</strong> · {history.length} observation(s). Not Amazon’s all-time lowest price.</p>
    <details><summary>Observation dates and prices</summary><ul>{history.map(o => <li key={o.at}><time dateTime={o.at}>{new Date(o.at).toLocaleString()}</time> — {money(o.price)}</li>)}</ul></details>
  </>;
}
