import { BarChart3, History, ArrowRight, Trash2 } from "lucide-react";
import type { Comparison } from "./model";
import { money } from "./format";
export function HistoryList({
  items,
  reopen,
  remove,
}: {
  items: Comparison[];
  reopen: (c: Comparison) => void;
  remove: (id: string) => Promise<void>;
}) {
  return items.length ? (
    <div className="history-list">
      {items.map((c) => (
        <article key={c.id}>
          <div className="history-icon">
            <BarChart3 size={21} />
          </div>
          <div>
            <h3>{c.query}</h3>
            <p>
              {c.products.length} products · {money(c.budget)} budget ·{" "}
              {new Date(c.createdAt).toLocaleDateString("en-US")} · {c.mode}{" "}
              snapshot
            </p>
          </div>
          <button onClick={() => reopen(c)}>
            Reopen <ArrowRight size={15} />
          </button>
          <button
            aria-label={"Delete " + c.query}
            onClick={() => void remove(c.id)}
          >
            <Trash2 size={16} />
          </button>
        </article>
      ))}
    </div>
  ) : (
    <div className="empty">
      <History size={25} />
      <h3>Your next good decision belongs here.</h3>
      <p>Discover products, adjust your priorities, and save a comparison.</p>
    </div>
  );
}
