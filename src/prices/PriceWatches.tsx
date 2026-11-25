import { useEffect, useState } from "react";
import { useQuery, useMutations } from "deepspace";
import { Bell, TrendingDown } from "lucide-react";
import { callAction } from "../buysmart/actions-client";
import { money } from "../buysmart/format";
import { PriceHistory } from "./PriceHistory";
import { watchConfigSchema, reportSchema } from "./model";
export interface WatchDraft { asin: string; title: string; target: number; }
interface Status { enabled: boolean; remaining: number; todayRemaining: number; owner: boolean; eligible: boolean; }
export function PriceWatches({ draft }: { draft?: WatchDraft }) {
  const { records, status: queryStatus, error: queryError } = useQuery<{ config: unknown; report?: unknown }>("priceWatches");
  const loading = queryStatus === "loading";
  const mutations = useMutations("priceWatches");
  const [asin, setAsin] = useState(draft?.asin ?? "");
  const [title, setTitle] = useState(draft?.title ?? "");
  const [target, setTarget] = useState(draft?.target ?? 300);
  const [status, setStatus] = useState<Status | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    callAction<Status>("priceMonitorStatus", {}, controller.signal).then(setStatus).catch(() => {});
    return () => controller.abort();
  }, []);
  async function mutate(work: () => Promise<unknown>, message: string) {
    setBusy(true); setError(""); setNotice("");
    try { await work(); setNotice(message); } catch (e) { setError(e instanceof Error ? e.message : "Watch update failed."); } finally { setBusy(false); }
  }
  return <section className="price-watches" aria-label="Price watchlist">
    <div className="evidence-scope"><div><span className="step-label">BUY WHEN IT FITS YOUR BUDGET</span><h2><TrendingDown size={22} /> Your price watchlist</h2>
      <p>Follow an exact Amazon US ASIN. Get an in-app alert when an observed in-stock listing reaches your target. Prices exclude shipping and tax.</p></div>
      <div className="scope-facts"><span>At most one new check per ASIN per 24 hours</span><span>History starts with the first successful check</span><span>Up to 90 observations · daily checks can miss short offers</span></div></div>
    <p className="monitor-status">{status ? `${status.enabled ? "Scheduled monitoring enabled" : "Scheduled monitoring paused"}. ${status.remaining} checks remain in the 20-check allowance (spending requires owner authorization); ${status.todayRemaining} checks available today.` : "Monitoring status unavailable. No paid check runs when saving a watch."}
      {status && !status.eligible && " This account is not approved for paid checks; its watches remain queued."}</p>
    {status?.owner && <details className="research-notes"><summary>Owner: scheduled spending controls</summary>
      <p>Monitoring starts paused. Enabling authorizes up to 20 paid product checks total, no more than five per UTC day. Each extraction has a USD 0.005 provider cap; DeepSpace billing is additional. Watches of the same ASIN share a check. Counters do not reset when toggling monitoring.</p>
      {!status.enabled && <label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I authorize these scheduled paid checks.</label>}
      <button className="secondary" disabled={busy || !status.enabled && !confirmed || !status.enabled && status.remaining === 0} onClick={() => void mutate(async () => {
        await callAction("setPriceMonitoring", { enabled: !status.enabled, confirm: true });
        setStatus(await callAction<Status>("priceMonitorStatus", {})); setConfirmed(false);
      }, "Monitoring setting updated.")}>{status.enabled ? "Pause scheduled checks" : "Enable scheduled checks"}</button>
    </details>}
    <form className="watch-form" onSubmit={e => { e.preventDefault(); void mutate(() => callAction("watchPrice", { asin: asin.trim().toUpperCase(), title, target }), "Price watch saved. No paid call was made."); }}>
      <h2><Bell size={18} /> Follow a product</h2>
      <div className="watch-form-fields"><label>Amazon ASIN<input value={asin} onChange={e => setAsin(e.target.value)} required pattern="[A-Za-z0-9]{10}" maxLength={10} placeholder="B0DZ75TN5F" /></label>
      <label>Product name<input value={title} onChange={e => setTitle(e.target.value)} required maxLength={300} /></label>
      <label>Target price (USD)<input value={target || ""} onChange={e => setTarget(Number(e.target.value))} type="number" min="0.01" max="10000" step="0.01" required /></label>
      <button className="primary" disabled={busy}>{busy ? "Saving…" : "Save price watch"}</button></div>
    </form>
    {error && <p className="alert" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {queryError && <p role="alert">Could not load watches: {queryError}</p>}
    {loading && <p>Loading private watches…</p>}
    {!loading && !records.length && <div className="empty">No products followed yet. Choose “Follow price” on a live result or enter an exact ASIN above.</div>}
    <div className="watch-grid">{records.map(row => {
      const config = watchConfigSchema.safeParse(row.data.config).data;
      const report = reportSchema.safeParse(row.data.report).data;
      if (!config) return <article key={row.recordId}><p>Unreadable watch.</p><button disabled={!mutations.ready || busy} onClick={() => void mutate(() => mutations.removeConfirmed(row.recordId), "Watch deleted.")}>Delete invalid watch</button></article>;
      const alert = report?.targetUsed === config.target ? report.alert : null;
      const latest = report?.history.at(-1);
      return <article className="watch-card" key={row.recordId}>
        <div className="product-meta"><span>{config.paused ? "PAUSED" : "FOLLOWING"}</span><span>{config.asin}</span></div>
        <h3>{config.title}</h3><a href={`https://www.amazon.com/dp/${config.asin}`} target="_blank" rel="noreferrer">Verify exact listing ↗</a>
        <p>Target: <strong>{money(config.target)}</strong> · Last observed: <strong>{money(latest?.price ?? null)}</strong></p>
        {alert && !config.paused && config.acknowledged !== alert.key && <div className="target-alert" role="status"><strong>Target reached: {money(alert.price)}</strong><p>Observed {new Date(alert.at).toLocaleString()}. Verify the current checkout price.</p><button className="secondary" disabled={busy} onClick={() => void mutate(() => callAction("editPriceWatch", { id: row.recordId, acknowledge: true }), "Alert marked as read.")}>Mark alert as read</button></div>}
        {report?.error && <p className="over">{report.error}</p>}
        {latest && <p className="subtle">Seller: {latest.seller} · {latest.variant}</p>}
        <PriceHistory history={report?.history ?? []} />
        <form className="watch-edit" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void mutate(() => callAction("editPriceWatch", { id: row.recordId, target: Number(data.get("target")) }), "Target updated."); }}>
          <label>Update target (USD)<input name="target" aria-label={`Target for ${config.title}`} type="number" min="0.01" max="10000" step="0.01" required defaultValue={config.target} key={config.target} /></label>
          <button className="secondary" disabled={busy}>Update target</button>
        </form>
        <div className="watch-actions"><button className="secondary" disabled={busy} onClick={() => void mutate(() => callAction("editPriceWatch", { id: row.recordId, paused: !config.paused }), config.paused ? "Watch resumed." : "Watch paused.")}>{config.paused ? "Resume watch" : "Pause watch"}</button>
        <button disabled={busy || !mutations.ready} onClick={() => void mutate(() => mutations.removeConfirmed(row.recordId), "Watch deleted.")}>Delete watch</button></div>
      </article>;
    })}</div>
  </section>;
}
