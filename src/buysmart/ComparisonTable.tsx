import { X } from "lucide-react";
import { keys, labels, type Weights } from "./model";
import { money, productLinkLabel } from "./format";
import { OfferDetails } from "./OfferDetails";
import type { rankProducts } from "./ranking";
import type { Dispatch, SetStateAction } from "react";
export function ComparisonTable({
  comparison,
  normalized,
  selected,
  setSelected,
}: {
  comparison: ReturnType<typeof rankProducts>;
  normalized: Weights;
  selected: string[];
  setSelected: Dispatch<SetStateAction<string[]>>;
}) {
  return (
    <div className="table-scroll" role="region" aria-label="Product comparison, scroll horizontally for more products" tabIndex={0}>
      <table>
        <caption className="sr-only">Selected products, criterion contributions, and supporting sources</caption>
        <thead>
          <tr>
            <th scope="col">Comparison</th>
            {comparison.map((r, i) => (
              <th scope="col" key={r.product.id}>
                <span className="rank">#{i + 1}</span>
                <h3>{r.product.name}</h3>
                <button
                  aria-label={"Remove " + r.product.name}
                  onClick={() =>
                    setSelected(selected.filter((id) => id !== r.product.id))
                  }
                >
                  <X size={14} />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>Weighted score</th>
            {comparison.map((r) => (
              <td key={r.product.id}>
                <strong className="big-score">{r.score.toFixed(1)}</strong>
                <small> / 100</small>
              </td>
            ))}
          </tr>
          <tr>
            <th>Price / budget</th>
            {comparison.map((r) => (
              <td key={r.product.id}>
                {money(r.product.price)}
                <OfferDetails product={r.product} />
                <small className={r.overBudget ? "over" : ""}>
                  {r.product.price === null
                    ? "Unavailable"
                    : r.overBudget
                      ? "Over your budget"
                      : "Within your budget"}
                </small>
              </td>
            ))}
          </tr>
          <tr>
            <th>Evidence coverage</th>
            {comparison.map((r) => (
              <td key={r.product.id}>
                {r.coverage.toFixed(0)}%
                <div className="coverage">
                  <span style={{ width: r.coverage + "%" }} />
                </div>
              </td>
            ))}
          </tr>
          {keys.map((k) => (
            <tr key={k}>
              <th>
                {labels[k]}
                <small>{normalized[k].toFixed(1)}% weight</small>
              </th>
              {comparison.map((r) => (
                <td key={r.product.id}>
                  <strong>
                    {r.values[k] === null
                      ? "Unavailable"
                      : r.values[k]?.toFixed(1) + " / 100"}
                  </strong>
                  <small>+{r.contributions[k].toFixed(2)} points</small>
                  {k !== "price" && k !== "rating" && (
                    <details>
                      <summary>Evidence</summary>
                      <p>
                        {r.product.evidence[k]?.reason ??
                          "No supported evidence was found."}
                      </p>
                      {r.product.evidence[k]?.sourceUrls.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Supporting source ↗
                        </a>
                      ))}
                    </details>
                  )}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th>Limitations</th>
            {comparison.map((r) => (
              <td key={r.product.id}>
                {r.product.weaknesses.map((s) => (
                  <p key={s}>{s}</p>
                ))}
              </td>
            ))}
          </tr>
          <tr>
            <th>Research sources</th>
            {comparison.map((r) => (
              <td key={r.product.id}>
                {r.product.sources.map((s) => (
                  <details key={s.url}>
                    <summary>{s.title}</summary>
                    <p>{s.excerpt}</p>
                    <a href={s.url} target="_blank" rel="noreferrer">
                      Open original source ↗
                    </a>
                  </details>
                ))}
                {r.product.url && (
                  <a href={r.product.url} target="_blank" rel="noreferrer">
                    {productLinkLabel(r.product.url)} ↗
                  </a>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
