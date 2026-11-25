import { Laptop, Check, ArrowUpRight } from "lucide-react";
import { money, productLinkLabel } from "./format";
import { useState } from "react";
import { OfferDetails } from "./OfferDetails";
import type { scoreProduct } from "./ranking";
import type { Dispatch, SetStateAction } from "react";
export function ProductCard({
  r,
  live = false,
  isTopMatch,
  category,
  selected,
  setSelected,
}: {
  r: ReturnType<typeof scoreProduct>;
  live?: boolean;
  isTopMatch: boolean;
  category: string;
  selected: string[];
  setSelected: Dispatch<SetStateAction<string[]>>;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <article className="product-card" key={r.product.id}>
      <div className="product-visual">
        {r.product.image && !imageFailed ? (
          <img
            src={r.product.image}
            alt={r.product.name}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <>
            <Laptop size={62} strokeWidth={1} />
            <span>{category.slice(0, -1)}</span>
          </>
        )}
        {isTopMatch && <span className="top-pick">{live ? "LISTING LEADER" : "TOP MATCH"}</span>}
      </div>
      <div className="product-body">
        <div className="product-meta">
          <span>{category}</span>
          <span>★ {r.product.rating ?? "Unavailable"}</span>
        </div>
        <h3>{r.product.name}</h3>
        <div className="price-row">
          <strong>{money(r.product.price)}</strong>
          <span className={r.overBudget ? "budget over" : "budget"}>
            {r.product.price === null
              ? "Price unavailable"
              : r.overBudget
                ? "Over budget"
                : "Within budget"}
          </span>
        </div>
        <div className="spec-list">
          {r.product.specs.slice(0, 3).map((s) => (
            <span key={s.label}>{s.value}</span>
          ))}
        </div>
        <OfferDetails product={r.product} />
        {!live && <><p className="pro">
          <Check size={14} />
          {r.product.strengths[0] ?? "Strengths unavailable"}
        </p>
        <p className="con">
          {r.product.weaknesses[0] ?? "Limitations unavailable"}
        </p>
        </>}
        <div className="score-row">
          <div>
            <strong>{r.score.toFixed(1)}</strong>
            <span>/ 100 weighted score</span>
          </div>
          <span>{r.coverage.toFixed(0)}% coverage</span>
        </div>
        <button
          className={selected.includes(r.product.id) ? "selected" : "secondary"}
          disabled={!selected.includes(r.product.id) && selected.length >= 4}
          onClick={() =>
            setSelected(
              selected.includes(r.product.id)
                ? selected.filter((id) => id !== r.product.id)
                : [...selected, r.product.id],
            )
          }
        >
          {selected.includes(r.product.id) ? (
            <>
              <Check size={16} />
              Added to comparison
            </>
          ) : (
            "Add to comparison"
          )}
        </button>
        <details>
          <summary>Sources & specifications</summary>
          {r.product.specs.map((s) => (
            <p key={s.label}>
              {s.label}: {s.value}
            </p>
          ))}
          {r.product.sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
              {s.title}
              <ArrowUpRight size={12} />
            </a>
          ))}
          {r.product.url && (
            <a href={r.product.url} target="_blank" rel="noreferrer">
              {productLinkLabel(r.product.url)}
              <ArrowUpRight size={12} />
            </a>
          )}
        </details>
      </div>
    </article>
  );
}
