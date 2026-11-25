import { ProductCard } from "./ProductCard";
import { ComparisonTable } from "./ComparisonTable";
import { WeightsPanel } from "./WeightsPanel";
import { HistoryList } from "./HistoryList";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  History,
  Search as SearchIcon,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import {
  comparisonSchema,
  discoverySchema,
  defaults,
  keys,
  labels,
  searchSchema,
  type Comparison,
  type Discovery,
  type ProductProvider,
  type Weights,
} from "./model";
import { rankProducts, normalizeWeights, withinBudget } from "./ranking";
import { mockProvider } from "./fixtures";
import { deleteHistory, readHistory, saveHistory } from "./history";
import "./buysmart.css";
import { readSearchIntent, rewriteBudget, rewriteCategory, searchIntentConflict } from "./search-intent";
interface Props {
  provider?: ProductProvider;
  cloudHistory?: Comparison[];
  onSave?: (c: Comparison) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  account?: React.ReactNode;
  accountStatus?: React.ReactNode;
  onResearchSettled?: () => void;
  live?: boolean;
  persistenceReady?: boolean;
}
const examples = [
  "A tablet under $350 for a graphic design student",
  "Noise-canceling headphones for working from home",
  "A laptop for programming and everyday study",
];
export default function BuySmart({
  provider = mockProvider,
  cloudHistory,
  onSave,
  onDelete,
  account,
  accountStatus,
  onResearchSettled,
  live = false,
  persistenceReady = true,
}: Props) {
  const [page, setPage] = useState<"discover" | "compare" | "history">(
    "discover",
  );
  const [query, setQuery] = useState(examples[0]);
  const [budget, setBudget] = useState(350);
  const [category, setCategory] = useState<Comparison["category"]>("Tablets");
  const [snapshotMode, setSnapshotMode] = useState<"demo" | "live">(
    live ? "live" : "demo",
  );
  const [resultBudget, setResultBudget] = useState(budget);
  const [resultQuery, setResultQuery] = useState(query);
  const [resultCategory, setResultCategory] = useState(category);
  const [result, setResult] = useState<Discovery | null>(null);
  const [weights, setWeights] = useState<Weights>({ ...defaults });
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState<Comparison[]>([]);
  const [sort, setSort] = useState("score");
  const [strict, setStrict] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const previousPage = useRef(page);
  useEffect(() => {
    try { setSaved(readHistory(localStorage)); } catch { setError("Browser storage is unavailable. Sign in to save privately."); }
  }, []);
  useEffect(() => {
    requestRef.current?.abort();
    setLoading(false);
    return () => requestRef.current?.abort();
  }, [provider, live]);
  useEffect(() => {
    if (previousPage.current !== page) rootRef.current?.querySelector<HTMLHeadingElement>("h1")?.focus();
    previousPage.current = page;
  }, [page]);
  const history = cloudHistory ?? saved;
  const displayingLive = result ? snapshotMode === "live" : live;
  const ranked = rankProducts(result?.products ?? [], resultBudget, weights);
  const comparison = ranked.filter((r) => selected.includes(r.product.id));
  const visible = ranked
    .filter((r) => !strict || withinBudget(r.product, resultBudget))
    .sort((a, b) =>
      sort === "price"
        ? (a.product.price ?? Infinity) - (b.product.price ?? Infinity)
        : sort === "rating"
          ? (b.product.rating ?? -1) - (a.product.rating ?? -1)
          : b.score - a.score,
    );
  const normalized = normalizeWeights(weights);
  const hasWinner = comparison.length > 0 && comparison[0].score > 0
    && (comparison.length === 1 || comparison[0].score > comparison[1].score + 1e-9);
  const intentIssue = searchIntentConflict({ query, budget, category });
  function editQuery(value: string) {
    setQuery(value);
    const intent = readSearchIntent(value);
    if (intent.budget !== undefined) setBudget(intent.budget);
    if (intent.category) setCategory(intent.category);
  }
  async function search() {
    if (loading) return;
    setError("");
    setNotice("");
    const input = searchSchema.safeParse({ query, budget, category });
    if (!input.success) {
      setError(input.error.issues.map((i) => i.message).join(". "));
      return;
    }
    if (intentIssue) { setError(intentIssue); return; }
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    try {
      const data = discoverySchema.parse(await provider.search(input.data, controller.signal));
      if (controller.signal.aborted) return;
      setResultBudget(input.data.budget);
      setResult(data);
      setSnapshotMode(live ? "live" : "demo");
      setResultQuery(input.data.query);
      setResultCategory(input.data.category);
      setSelected(data.products.slice(0, 3).map((p) => p.id));
      setPage("discover");
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(
        e instanceof Error ? e.message : "Search unavailable. Try the demo.",
      );
    } finally {
      if (requestRef.current === controller) setLoading(false);
      if (live && !controller.signal.aborted) onResearchSettled?.();
    }
  }
  async function save() {
    if (!result || !comparison.length) return;
    setBusy(true);
    setError("");
    try {
      const c: Comparison = {
        id: crypto.randomUUID(),
        query: resultQuery,
        budget: resultBudget,
        category: resultCategory,
        products: comparison.map((r) => r.product),
        weights: { ...weights },
        createdAt: new Date().toISOString(),
        mode: snapshotMode,
        explanation: result.explanation,
      };
      const valid = comparisonSchema.parse(c);
      if (onSave) await onSave(valid);
      else {
        saveHistory(localStorage, c);
        setSaved(readHistory(localStorage));
      }
      setNotice(
        onSave
          ? "Comparison saved to your private account."
          : "Comparison saved in this browser.",
      );
    } catch {
      setError(
        "Could not save. Check your connection or browser storage and retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  function reopen(c: Comparison) {
    setSnapshotMode(c.mode);
    setResultQuery(c.query);
    setResultCategory(c.category);
    setQuery(c.query);
    setBudget(c.budget);
    setResultBudget(c.budget);
    setCategory(c.category);
    setWeights(c.weights);
    setResult({
      products: c.products,
      explanation: c.explanation,
      warnings: [`Saved ${c.mode} snapshot. No API calls made.`],
    });
    setSelected(c.products.map((p) => p.id));
    setPage("compare");
    setNotice("Opened saved snapshot. No credits used.");
  }
  async function remove(id: string) {
    try {
      if (onDelete) await onDelete(id);
      else {
        deleteHistory(localStorage, id);
        setSaved(readHistory(localStorage));
      }
    } catch {
      setError("Could not delete this comparison. Please retry.");
    }
  }
  return (
    <div className="bs" ref={rootRef}>
      <header className="bs-header">
        <a href="/" className="brand">
          <span>
            <ShoppingBag size={21} />
          </span>
          BuySmart<span className="brand-dot">.</span>
        </a>
        <nav data-testid="app-navigation" aria-label="Main navigation">
          <button
            className={page === "discover" ? "active" : ""}
            aria-current={page === "discover" ? "page" : undefined}
            onClick={() => setPage("discover")}
          >
            <SearchIcon size={16} />
            Discover
          </button>
          <button
            className={page === "compare" ? "active" : ""}
            aria-current={page === "compare" ? "page" : undefined}
            onClick={() => setPage("compare")}
          >
            <BarChart3 size={16} />
            Compare {selected.length > 0 && <b>{selected.length}</b>}
          </button>
          <button
            className={page === "history" ? "active" : ""}
            aria-current={page === "history" ? "page" : undefined}
            onClick={() => setPage("history")}
          >
            <History size={16} />
            History
          </button>
        </nav>
        <div className="account">
          {account ?? (
            <>
              <span className="mode">Demo workspace</span>
              <a href="/home">
                Sign in <ArrowUpRight size={14} />
              </a>
            </>
          )}
        </div>
      </header>
      <main className="bs-main">
        {accountStatus}
        <div className="eyebrow">
          <span />{" "}
          {live ? "LIVE RESEARCH WORKSPACE" : "THE THOUGHTFUL WAY TO SHOP"}
        </div>
        {page === "history" ? (
          <>
            <div className="page-heading">
              <div>
                <h1 tabIndex={-1}>Your decision library</h1>
                <p>
                  Pick up where you left off. Your products, priorities, and
                  research stay together.
                </p>
              </div>
              <History size={30} />
            </div>
            <p className="subtle">
              {cloudHistory
                ? "Private account history"
                : "Demo history is saved only in this browser."}{" "}
              · Reopening never calls paid APIs.
            </p>
            <HistoryList items={history} reopen={reopen} remove={remove} />
          </>
        ) : (
          <>
            <div className="page-heading">
              <div>
                <h1 tabIndex={-1}>
                  {page === "compare"
                    ? "A clearer choice starts here."
                    : "Find what fits. Know why."}
                </h1>
                <p>
                  {page === "compare"
                    ? "Your priorities. Transparent scores. A decision you can explain."
                    : "Compare electronics with evidence and a little less guesswork."}
                </p>
              </div>
              <span className="trust">
                <ShieldCheck size={18} />
                Built around your priorities
              </span>
            </div>
            <div className="demo-banner">
              <ShieldCheck size={18} />
              <div>
                <strong>
                  {displayingLive
                    ? result
                      ? "Live research snapshot"
                      : "Live research is access-controlled"
                    : "Explore freely in demo mode"}
                </strong>
                <span>
                  {displayingLive
                    ? result
                      ? "External provider snapshot. Verify current prices and exact product variants."
                      : "Approved accounts only. Requests consume owner credits."
                    : "Illustrative product snapshots, prices and assessments. No live offers. No credits used."}
                </span>
              </div>
              {!displayingLive && <span className="pill">DEMO DATA</span>}
            </div>
            {page === "discover" && (
              <section className="search-panel">
                <div className="section-label">
                  <SearchIcon size={17} />
                  What are you looking for?
                </div>
                <label className="sr-only" htmlFor="query">
                  Product requirements
                </label>
                <textarea
                  id="query"
                  value={query}
                  onChange={(e) => editQuery(e.target.value)}
                  aria-describedby="search-interpretation"
                  aria-invalid={!!intentIssue}
                  placeholder="Tell us what you need, how you’ll use it, and what matters most…"
                  maxLength={500}
                  disabled={loading}
                />
                <div className="search-controls">
                  <label>
                    Maximum budget{" "}
                    <div className="money-input">
                      <span>$</span>
                      <input
                        disabled={loading}
                        aria-label="Maximum budget"
                        type="number"
                        min="25"
                        max="10000"
                        value={budget}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setBudget(value);
                          setQuery(current => rewriteBudget(current, value));
                        }}
                      />
                      <span>USD</span>
                    </div>
                  </label>
                  <label>
                    Category
                    <select
                      aria-label="Category"
                      disabled={loading}
                      value={category}
                      onChange={(e) => {
                        const value = e.target.value as Comparison["category"];
                        setCategory(value);
                        setQuery(current => rewriteCategory(current, value));
                      }}
                    >
                      {["Tablets", "Laptops", "Headphones", "Smartphones"].map(
                        (c) => (
                          <option key={c}>{c}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <button
                    className="primary"
                    onClick={() => void search()}
                    disabled={loading || !!intentIssue}
                  >
                    {loading
                      ? "Researching…"
                      : live
                        ? "Research products"
                        : "Discover demo products"}
                    <ArrowRight size={17} />
                  </button>
                </div>
                <p id="search-interpretation" className="subtle" aria-live="polite">
                  {intentIssue ?? "Clear budgets and categories in your text update the fields automatically. Editing a field updates matching text. Review both before searching."}
                </p>
                <div className="examples">
                  <span>TRY A SEARCH</span>
                  {examples.map((ex, i) => (
                    <button
                      key={ex}
                      disabled={loading}
                      onClick={() => {
                        setQuery(ex);
                        setCategory(
                          (["Tablets", "Headphones", "Laptops"] as const)[i],
                        );
                        setBudget([350, 300, 800][i]);
                      }}
                    >
                      {
                        ["Creative study", "Focus at work", "Everyday coding"][
                          i
                        ]
                      }
                      <ChevronRight size={12} />
                    </button>
                  ))}
                </div>
              </section>
            )}
            {loading && (
              <div
                className="cards"
                aria-label="Loading products"
                aria-busy="true"
              >
                {[1, 2, 3, 4].map((i) => (
                  <div className="skeleton" key={i} />
                ))}
              </div>
            )}
            {!result && !loading && (
              <>
                <div className="how-grid">
                  {[
                    [
                      SearchIcon,
                      "Start with your needs",
                      "Tell us your budget and the things that matter.",
                    ],
                    [
                      SlidersHorizontal,
                      "Make the tradeoffs yours",
                      "Adjust priorities and see the ranking change.",
                    ],
                    [
                      ShieldCheck,
                      "See the reasoning",
                      "Separate product fit from evidence coverage.",
                    ],
                  ].map(([Icon, title, copy]) => (
                    <div key={String(title)}>
                      {typeof Icon !== "string" && <Icon size={22} />}
                      <h3>{String(title)}</h3>
                      <p>{String(copy)}</p>
                    </div>
                  ))}
                </div>
                <div className="section-heading">
                  <h2>Recent comparisons</h2>
                  <button onClick={() => setPage("history")}>
                    View history <ArrowRight size={15} />
                  </button>
                </div>
                <HistoryList
                  items={history.slice(0, 3)}
                  reopen={reopen}
                  remove={remove}
                />
              </>
            )}
            {result && (
              <>
                {result.warnings.map((w) => (
                  <p key={w} className="subtle">
                    {w}
                  </p>
                ))}
                {page === "discover" ? (
                  <>
                    <div className="section-heading">
                      <div>
                        <h2>
                          Your shortlist <span>{visible.length} products</span>
                        </h2>
                        <p>Explore the tradeoffs, then compare up to four.</p>
                      </div>
                      <div className="filters">
                        <label>
                          <input
                            type="checkbox"
                            checked={strict}
                            onChange={(e) => setStrict(e.target.checked)}
                          />
                          Within budget
                        </label>
                        <select
                          aria-label="Sort products"
                          value={sort}
                          onChange={(e) => setSort(e.target.value)}
                        >
                          <option value="score">Highest score</option>
                          <option value="price">Lowest price</option>
                          <option value="rating">Highest rating</option>
                        </select>
                      </div>
                    </div>
                    <div className="cards">
                      {visible.map((r, i) => (
                        <ProductCard
                          key={r.product.id}
                          r={r}
                          isTopMatch={r.product.id === ranked[0]?.product.id && r.score > 0 && (ranked.length === 1 || r.score > ranked[1].score + 1e-9)}
                          category={resultCategory}
                          selected={selected}
                          setSelected={setSelected}
                        />
                      ))}
                    </div>
                    {!visible.length && (
                      <div className="empty">
                        {result.products.length ? "No products match your budget. Remove the filter to inspect alternatives." : "No usable product sources were found. Try a specific model or different requirements."}
                      </div>
                    )}
                    <div className="compare-bar">
                      <div>
                        <BarChart3 size={21} />
                        <span>
                          <strong>{selected.length} products selected</strong>
                          <small>Find the tradeoffs that matter to you.</small>
                        </span>
                      </div>
                      <button
                        className="primary"
                        disabled={!selected.length}
                        onClick={() => setPage("compare")}
                      >
                        Compare shortlist
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="workspace">
                    <WeightsPanel
                      weights={weights}
                      setWeights={setWeights}
                      busy={busy || loading}
                      comparisonCount={comparison.length}
                      persistenceReady={persistenceReady}
                      save={save}
                    />
                    <section className="comparison-main">
                      {comparison.length ? (
                        <>
                          <div className="recommendation">
                            <div className="section-label">
                              <Sparkles size={17} />
                              {hasWinner ? "YOUR CURRENT TOP MATCH" : "MORE EVIDENCE NEEDED"}
                            </div>
                            <h2>{hasWinner ? comparison[0].product.name : comparison[0].score > 0 ? "Your top products are tied" : "No supported winner yet"}</h2>
                            {hasWinner ? <p>
                              Leads your selected products with{" "}
                              {comparison[0].score.toFixed(1)} points. Its
                              largest contribution is{" "}
                              {labels[
                                keys.reduce((a, b) =>
                                  comparison[0].contributions[a] >=
                                  comparison[0].contributions[b]
                                    ? a
                                    : b,
                                )
                              ].toLowerCase()}
                              . Increasing a different priority can change the
                              order.
                            </p> : <p>{comparison[0].score > 0 ? "The highest scores are equal. Compare exact variants and original sources before choosing." : "Available evidence does not support a ranking. Compare the original sources and verify prices, exact models, and compatibility."}</p>}
                            <details>
                              <summary>
                                {snapshotMode === "live"
                                  ? "AI research interpretation"
                                  : "Demo research interpretation"}
                              </summary>
                              <p>{result.explanation}</p>
                            </details>
                          </div>
                          <ComparisonTable
                            comparison={comparison}
                            normalized={normalized}
                            selected={selected}
                            setSelected={setSelected}
                          />
                        </>
                      ) : (
                        <div className="empty">
                          Select products in Discover to build your comparison.
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </>
            )}
          </>
        )}
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        <footer>
          <span>BuySmart · Decisions with perspective.</span>
          <span>
            Powered by DeepSpace ·{" "}
            {displayingLive ? "Live research snapshot" : "Illustrative demo"}
          </span>
        </footer>
      </main>
    </div>
  );
}
