/* home pattern: search-first — product discovery and comparison workspace */
import { useEffect, useState } from "react";
import { AuthOverlay, useAuth, useMutations, useQuery, signOut } from "deepspace";
import BuySmart from "../../buysmart/BuySmart";
import { comparisonSchema, type Comparison, type Discovery, type ProductProvider } from "../../buysmart/model";
import { callAction } from "../../buysmart/actions-client";
const liveProvider: ProductProvider = { search: (input, signal) => callAction<Discovery>("discover", input, signal) };
interface ResearchStatus { enabled: boolean; }
export default function Home() {
  const { isSignedIn, userId } = useAuth();
  const [auth, setAuth] = useState(false);
  const [live, setLive] = useState(false);
  const [researchStatus, setResearchStatus] = useState<ResearchStatus | null>(null);
  const [accountError, setAccountError] = useState("");
  const { records } = useQuery<{ snapshot: Comparison }>("comparisons");
  const mutations = useMutations<{ snapshot: Comparison }>("comparisons");
  useEffect(() => {
    setResearchStatus(null);
    if (!isSignedIn) return;
    const controller = new AbortController();
    callAction<ResearchStatus>("researchStatus", {}, controller.signal).then(setResearchStatus).catch(() => {});
    return () => controller.abort();
  }, [isSignedIn, userId]);
  const history = records.flatMap(r => {
    const c = comparisonSchema.safeParse(r.data.snapshot);
    return c.success ? [{ ...c.data, id: r.recordId }] : [];
  });
  const invalid = records.filter(r => !comparisonSchema.safeParse(r.data.snapshot).success);
  const activeLive = isSignedIn && live && researchStatus?.enabled === true;
  return <>
    <BuySmart
      key={String(userId)}
      persistenceReady={!isSignedIn || mutations.ready}
      live={activeLive}
      provider={activeLive ? liveProvider : undefined}
      onResearchSettled={() => {
        if (isSignedIn) void callAction<ResearchStatus>("researchStatus", {}).then(setResearchStatus).catch(() => {});
      }}
      cloudHistory={isSignedIn ? history : undefined}
      onSave={isSignedIn ? async c => {
        await callAction("saveComparison", { snapshot: comparisonSchema.parse(c) });
      } : undefined}
      onDelete={isSignedIn ? async id => {
        if (!mutations.ready) throw new Error("Storage connecting");
        await mutations.removeConfirmed(id);
      } : undefined}
      account={<>{isSignedIn ? <>
        <label><input type="checkbox" checked={activeLive} onChange={e => setLive(e.target.checked)} disabled={!researchStatus?.enabled} />Live research</label>
        <button onClick={() => void signOut()}>Sign out</button>
      </> : <button data-testid="nav-sign-in-button" onClick={() => setAuth(true)}>Sign in to save privately ↗</button>}</>}
      accountStatus={isSignedIn ? <>
        {researchStatus ? <p className="subtle">{researchStatus.enabled ? "Live access approved." : "Live access is disabled for this account."} No daily or app search cap. New research uses integration credits. Cached searches and saved comparisons use no new credits.</p> : <p className="subtle">Research status is unavailable; demo and private history remain available.</p>}
        {!!invalid.length && <div role="alert">{invalid.length} saved comparison(s) could not be read. You can remove invalid snapshots:
          {invalid.map(r => <button key={r.recordId} disabled={!mutations.ready} onClick={() => void mutations.removeConfirmed(r.recordId).catch(() => setAccountError("Could not remove invalid snapshot."))}>Delete invalid snapshot {r.recordId}</button>)}
        </div>}
        {accountError && <p role="alert">{accountError}</p>}
      </> : undefined}
    />
    {auth && <AuthOverlay onClose={() => setAuth(false)} />}
  </>;
}
