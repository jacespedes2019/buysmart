import { SlidersHorizontal } from "lucide-react";
import { defaults, keys, labels, type Weights } from "./model";
import { normalizeWeights } from "./ranking";
import type { Dispatch, SetStateAction } from "react";
export function WeightsPanel({
  live = false,
  weights,
  setWeights,
  busy,
  comparisonCount,
  persistenceReady,
  save,
}: {
  live?: boolean;
  weights: Weights;
  setWeights: Dispatch<SetStateAction<Weights>>;
  busy: boolean;
  comparisonCount: number;
  persistenceReady: boolean;
  save: () => Promise<void>;
}) {
  const normalized = normalizeWeights(weights);
  return (
    <aside className="weights">
      <div className="section-heading">
        <h2>
          <SlidersHorizontal size={17} />
          Your priorities
        </h2>
        <button onClick={() => setWeights({ ...defaults })}>Reset</button>
      </div>
      <p>Move a slider to rethink the tradeoffs. No new API calls.</p>
      {keys.map((k) => (
        <label key={k}>
          {labels[k]}{live && !["price", "rating"].includes(k) && <small className="criterion-unavailable">Not scored in live research</small>}
          <strong>{normalized[k].toFixed(1)}%</strong>
          <input
            aria-label={labels[k] + " weight"}
            type="range"
            min="0"
            max="100"
            value={weights[k]}
            onChange={(e) =>
              setWeights({
                ...weights,
                [k]: Number(e.target.value),
              })
            }
          />
        </label>
      ))}
      <div className="method">
        <strong>How scoring works</strong>
        <p>
          Weighted sum of 0–100 criterion values. Missing values score zero;
          weights are normalized to 100%. Affordability measures remaining
          budget. Coverage counts available criteria, not certainty.
        </p>
        <p>
          Scores describe this model’s tradeoffs, not objective quality or
          probabilities.
        </p>
      </div>
      <button
        className="primary"
        disabled={busy || !comparisonCount || !persistenceReady}
        onClick={() => void save()}
      >
        {busy ? "Saving…" : "Save comparison"}
      </button>
    </aside>
  );
}
