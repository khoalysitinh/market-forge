import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Decision, Review, RoundView, TrialView, User } from "../api/types";
import { CandleChart } from "../components/CandleChart";
import { DecisionForm } from "../components/DecisionForm";
import { ReviewForm } from "../components/ReviewForm";
import { Empty, ErrorBox, Loading, StatusPill, SyntheticBadge } from "../components/Status";
import { formatDateTime, formatSignedTicks, formatTicks, formatUtcTime } from "../lib/format";
import { usePolling } from "../lib/usePolling";

const POLL_MS = 3000;

export function TrialPage({ trialId, me }: { trialId: number; me: User }) {
  const trial = usePolling(() => api.getTrial(trialId), [trialId], POLL_MS);
  const clock = trial.data?.trial.clock_index;
  // Candles are refetched only when the SERVER clock changes.
  const candles = usePolling(() => api.candles(trialId), [trialId, clock]);
  const [selectedRound, setSelectedRound] = useState<number>();

  const rounds = trial.data?.rounds ?? [];
  const roundId = selectedRound ?? trial.data?.current_round_id ?? rounds[rounds.length - 1]?.id;

  if (trial.loading) return <Loading what="Loading trial" />;
  if (trial.error) return <ErrorBox error={trial.error} onRetry={trial.reload} />;
  const tv = trial.data!;

  return (
    <div className="workspace">
      <section className="card chart-card">
        <div className="chart-head">
          <div>
            <strong>{tv.dataset.symbol}</strong> <span className="muted">{tv.dataset.timeframe}</span>{" "}
            <StatusPill status={tv.trial.status} />
          </div>
          <SyntheticBadge label={tv.dataset.label} />
        </div>
        <div className="clock">
          Server clock: <strong>{formatUtcTime(tv.clock_time)}</strong>{" "}
          <span className="muted">
            (candle #{tv.trial.clock_index} of {tv.dataset.candle_count} · future candles stay on the server)
          </span>
        </div>
        {candles.error ? (
          <ErrorBox error={candles.error} onRetry={candles.reload} />
        ) : !candles.data ? (
          <Loading what="Loading candles" />
        ) : (
          <CandleChart candles={candles.data.candles} priceScale={candles.data.price_scale} label={candles.data.label}
            decisionIndex={revealShadeIndex(tv, roundId)} />
        )}
        <div className="muted small mono">dataset {tv.dataset.fingerprint.slice(0, 16)}… · {tv.trial.engine_version}</div>
        <Timeline roomId={tv.trial.room_id} />
      </section>

      <section className="card round-card">
        <div className="round-tabs">
          <a href={`#/rooms/${tv.trial.room_id}`} className="muted">← room</a>
          {rounds.map((r) => (
            <button key={r.id} className={`tab ${r.id === roundId ? "active" : ""}`} onClick={() => setSelectedRound(r.id)}>
              R{r.round_no}
            </button>
          ))}
        </div>
        <TrialControls tv={tv} onChange={trial.reload} />
        {roundId === undefined ? (
          <Empty>{tv.trial.status === "CREATED" ? "Warm-up only. The owner starts the trial to open round 1." : "No rounds."}</Empty>
        ) : (
          <RoundPanel key={roundId} roundId={roundId} me={me} onChange={trial.reload} />
        )}
      </section>
    </div>
  );
}

function revealShadeIndex(tv: TrialView, roundId: number | undefined): number | undefined {
  const r = tv.rounds.find((x) => x.id === roundId);
  return r && r.reveal_clock_index !== null ? r.decision_clock_index : undefined;
}

function TrialControls({ tv, onChange }: { tv: TrialView; onChange: () => void }) {
  const [error, setError] = useState<ApiError>();
  if (tv.my_role !== "OWNER" || tv.trial.status !== "CREATED") return null;
  async function start() {
    setError(undefined);
    try {
      await api.startTrial(tv.trial.id);
      onChange();
    } catch (e) {
      setError(e as ApiError);
    }
  }
  return (
    <div className="owner-controls">
      <button className="btn btn-primary" onClick={start}>Start trial (open round 1)</button>
      <ErrorBox error={error} />
    </div>
  );
}

function RoundPanel({ roundId, me, onChange }: { roundId: number; me: User; onChange: () => void }) {
  const round = usePolling(() => api.getRound(roundId), [roundId], POLL_MS);
  if (round.loading) return <Loading what="Loading round" />;
  if (round.error) return <ErrorBox error={round.error} onRetry={round.reload} />;
  const rv = round.data!;
  const refresh = () => {
    round.reload();
    onChange();
  };

  return (
    <div className="round">
      <div className="round-head">
        <h2>Round {rv.round.round_no}</h2>
        <StatusPill status={rv.round.status} />
      </div>
      <p className="muted small">Decisions are made at candle #{rv.round.decision_clock_index}.</p>

      <h3>Participants</h3>
      <ul className="list participants">
        {rv.participants.map((p) => (
          <li key={p.user_id}>
            <span className={p.committed ? "ok" : "muted"}>{p.committed ? "● committed" : "○ no decision"}</span>{" "}
            {p.display_name} {p.role === "OWNER" && <span className="muted">(owner)</span>}
          </li>
        ))}
      </ul>

      <OwnerControls rv={rv} onChange={refresh} />

      {rv.round.status === "DECISION_OPEN" &&
        (rv.my_decision ? (
          <div className="sealed">
            <h3>Your sealed decision</h3>
            <DecisionCard d={rv.my_decision} />
            <p className="muted small">Other members cannot see it until the owner locks the round.</p>
          </div>
        ) : (
          <>
            <h3>Your decision</h3>
            <DecisionForm roundId={rv.round.id} onCommitted={refresh} />
          </>
        ))}

      {rv.outcome && <OutcomeBox rv={rv} />}

      {!rv.decisions_sealed && (
        <>
          <h3>Decisions ({rv.decisions.length})</h3>
          {rv.decisions.length === 0 && <Empty>No decisions.</Empty>}
          {rv.decisions.map((d) => (
            <DecisionWithReviews key={d.id} d={d} rv={rv} me={me} onChange={refresh} />
          ))}
        </>
      )}
    </div>
  );
}

function OwnerControls({ rv, onChange }: { rv: RoundView; onChange: () => void }) {
  const [error, setError] = useState<ApiError>();
  const [busy, setBusy] = useState(false);
  useEffect(() => setError(undefined), [rv.round.status]);
  if (rv.my_role !== "OWNER") return null;

  const next = {
    DECISION_OPEN: { action: "lock", label: "Lock decisions" },
    REVIEW_BLIND: { action: "reveal", label: "Reveal next candles" },
    REVEALED: { action: "complete", label: "Complete round" },
    COMPLETED: null,
  }[rv.round.status] as { action: "lock" | "reveal" | "complete"; label: string } | null;
  if (!next) return null;

  async function run() {
    setBusy(true);
    setError(undefined);
    try {
      await api.roundAction(rv.round.id, next!.action);
      onChange();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="owner-controls">
      <span className="muted small">Owner control:</span>{" "}
      <button className="btn btn-primary" onClick={run} disabled={busy}>{next.label}</button>
      <ErrorBox error={error} />
    </div>
  );
}

function DecisionCard({ d }: { d: Decision }) {
  return (
    <div className="decision">
      <div>
        <span className={`dir-tag dir-${d.direction.toLowerCase()}`}>{d.direction}</span> <strong>{d.author_name}</strong>{" "}
        <span className="muted small">confidence {d.confidence}/5 · committed {formatDateTime(d.committed_at)}</span>
      </div>
      <p className="thesis">{d.thesis}</p>
      {d.invalidation && <p className="small"><span className="muted">Invalidation:</span> {d.invalidation}</p>}
      {d.risk_note && <p className="small"><span className="muted">Risk:</span> {d.risk_note}</p>}
      <p className="muted small mono">known at candle #{d.known_at_clock_index} ({formatUtcTime(d.known_at_candle_time)})</p>
    </div>
  );
}

function DecisionWithReviews({ d, rv, me, onChange }: { d: Decision; rv: RoundView; me: User; onChange: () => void }) {
  const reviews = rv.reviews.filter((r) => r.decision_id === d.id);
  const canReview = rv.round.status === "REVIEW_BLIND" && d.user_id !== me.id && !reviews.some((r) => r.reviewer_id === me.id);
  return (
    <div className="decision-block">
      <DecisionCard d={d} />
      {reviews.map((r) => (
        <ReviewLine key={r.id} r={r} />
      ))}
      {canReview && <ReviewForm roundId={rv.round.id} decisionId={d.id} onDone={onChange} />}
    </div>
  );
}

function ReviewLine({ r }: { r: Review }) {
  const tick = (b: boolean) => (b ? "✓" : "✗");
  return (
    <div className="review small">
      <strong>{r.reviewer_name}</strong>: thesis {tick(r.thesis_clear)} · invalidation {tick(r.invalidation_defined)} · risk{" "}
      {tick(r.risk_defined)} · evidence {tick(r.evidence_based)}
      {r.feedback && <div className="muted">“{r.feedback}”</div>}
    </div>
  );
}

function OutcomeBox({ rv }: { rv: RoundView }) {
  const o = rv.outcome!;
  const s = o.price_scale;
  return (
    <div className="outcome">
      <h3>Revealed: candles #{o.from_clock_index + 1}–#{o.to_clock_index}</h3>
      <p>
        Close at decision <strong>{formatTicks(o.decision_close, s)}</strong> → close after reveal{" "}
        <strong>{formatTicks(o.reveal_close, s)}</strong> (
        <span className={o.move_ticks >= 0 ? "up" : "down"}>{formatSignedTicks(o.move_ticks, s)}</span>)
      </p>
      <p className="small">Window high {formatTicks(o.window_high, s)} · low {formatTicks(o.window_low, s)}</p>
      <p className="muted small">{o.note}</p>
    </div>
  );
}

function Timeline({ roomId }: { roomId: number }) {
  const events = usePolling(() => api.roomEvents(roomId), [roomId], 5000);
  return (
    <details className="timeline">
      <summary>Event timeline (audit log)</summary>
      {events.error ? (
        <ErrorBox error={events.error} onRetry={events.reload} />
      ) : !events.data ? (
        <Loading />
      ) : events.data.events.length === 0 ? (
        <Empty>No events.</Empty>
      ) : (
        <ol className="events mono small">
          {[...events.data.events].reverse().map((e) => (
            <li key={e.id}>
              #{e.sequence} {formatDateTime(e.created_at)} <strong>{e.type}</strong> {e.subject_type}:{e.subject_id}
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}
