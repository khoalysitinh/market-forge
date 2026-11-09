import { useState, type FormEvent } from "react";
import { api, ApiError, newIdempotencyKey } from "../api/client";
import type { Direction } from "../api/types";
import { ErrorBox } from "./Status";

const CONFIDENCE_HELP: Record<number, string> = {
  1: "1 — guess",
  2: "2 — low",
  3: "3 — moderate",
  4: "4 — high",
  5: "5 — very high conviction",
};

/** Sealed decision form. Once committed it can never be edited. */
export function DecisionForm({ roundId, onCommitted }: { roundId: number; onCommitted: () => void }) {
  const [direction, setDirection] = useState<Direction>("WAIT");
  const [thesis, setThesis] = useState("");
  const [invalidation, setInvalidation] = useState("");
  const [confidence, setConfidence] = useState(3);
  const [riskNote, setRiskNote] = useState("");
  // One key per form: a retry after a timeout returns the original decision.
  const [key] = useState(newIdempotencyKey);
  const [error, setError] = useState<ApiError>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!window.confirm("Commit this decision? It is sealed and cannot be changed afterwards.")) return;
    setBusy(true);
    setError(undefined);
    try {
      await api.commitDecision(roundId, { direction, thesis, invalidation, confidence, risk_note: riskNote }, key);
      onCommitted();
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="form">
      <div className="direction-group" role="radiogroup" aria-label="Direction">
        {(["LONG", "SHORT", "WAIT"] as const).map((d) => (
          <button type="button" key={d} role="radio" aria-checked={direction === d}
            className={`btn dir dir-${d.toLowerCase()} ${direction === d ? "active" : ""}`} onClick={() => setDirection(d)}>
            {d}
          </button>
        ))}
      </div>
      <label>
        Thesis <span className="muted">— why, based only on what you can see now</span>
        <textarea value={thesis} onChange={(e) => setThesis(e.target.value)} required minLength={10} maxLength={2000} rows={3} />
      </label>
      <label>
        Invalidation {direction !== "WAIT" ? <span className="muted">(required)</span> : <span className="muted">(optional)</span>}
        <input value={invalidation} onChange={(e) => setInvalidation(e.target.value)} maxLength={1000}
          required={direction !== "WAIT"} minLength={direction !== "WAIT" ? 5 : undefined} />
      </label>
      <label>
        Confidence: {CONFIDENCE_HELP[confidence]}
        <input type="range" min={1} max={5} step={1} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} />
      </label>
      <label>
        Risk note <span className="muted">(optional — size, max loss; costs are not modelled)</span>
        <input value={riskNote} onChange={(e) => setRiskNote(e.target.value)} maxLength={500} />
      </label>
      <ErrorBox error={error} />
      <button className="btn btn-primary" disabled={busy}>{busy ? "Committing…" : "Commit sealed decision"}</button>
    </form>
  );
}
