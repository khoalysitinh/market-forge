import { useState, type FormEvent } from "react";
import { api, ApiError, newIdempotencyKey } from "../api/client";
import { ErrorBox } from "./Status";

const RUBRIC = [
  ["thesis_clear", "The thesis is clear and specific"],
  ["invalidation_defined", "Invalidation is defined (or WAIT is justified)"],
  ["risk_defined", "Risk is stated"],
  ["evidence_based", "Reasoning uses only what was visible at decision time"],
] as const;

type RubricKey = (typeof RUBRIC)[number][0];

/** Blind checklist review: judged on the plan, not on the (still hidden) outcome. */
export function ReviewForm({ roundId, decisionId, onDone }: { roundId: number; decisionId: number; onDone: () => void }) {
  const [answers, setAnswers] = useState<Record<RubricKey, boolean>>({
    thesis_clear: false, invalidation_defined: false, risk_defined: false, evidence_based: false,
  });
  const [feedback, setFeedback] = useState("");
  const [key] = useState(newIdempotencyKey);
  const [error, setError] = useState<ApiError>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await api.submitReview(roundId, { decision_id: decisionId, ...answers, feedback }, key);
      onDone();
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="form review-form">
      {RUBRIC.map(([k, text]) => (
        <label key={k} className="check">
          <input type="checkbox" checked={answers[k]} onChange={(e) => setAnswers({ ...answers, [k]: e.target.checked })} />
          {text}
        </label>
      ))}
      <textarea placeholder="Feedback (optional)" value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={2000} rows={2} />
      <ErrorBox error={error} />
      <button className="btn" disabled={busy}>{busy ? "Submitting…" : "Submit blind review"}</button>
    </form>
  );
}
