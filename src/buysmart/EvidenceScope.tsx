import { Check, Info } from "lucide-react";
export function EvidenceScope({ live }: { live: boolean }) {
  return <section className="evidence-scope" aria-label="Ranking scope">
    <div className="scope-intro"><Info size={20} aria-hidden="true" /><div>
      <span className="step-label">KNOW WHAT THE SCORE MEANS</span>
      <h2>{live ? "A listing comparison. Your final decision." : "Explore the method with illustrative data."}</h2>
      <p>{live ? "Price and customer ratings contribute to this score. It does not establish suitability for design work or software compatibility." : "Demo prices and assessments are synthetic. Use the sliders to explore tradeoffs; switch to approved live research for actual listing snapshots."}</p>
    </div></div>
    <div className="scope-facts">
      <span><Check size={14} aria-hidden="true" />{live ? "Scored: price & rating, when available" : "Five criteria to explore"}</span>
      <span>{live ? "Not scored: performance, fit & features" : "No live offers · no credits used"}</span>
      <span>{live ? "Review exact models, sources & checkout total" : "Missing values stay visible"}</span>
    </div>
  </section>;
}
