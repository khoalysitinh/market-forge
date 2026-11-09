import { useState } from "react";
import { api, ApiError, newIdempotencyKey } from "../api/client";
import { navigate } from "../lib/router";
import { Empty, ErrorBox, Loading, StatusPill } from "../components/Status";
import { usePolling } from "../lib/usePolling";
import { formatDateTime } from "../lib/format";

export function RoomPage({ roomId }: { roomId: number }) {
  const room = usePolling(() => api.getRoom(roomId), [roomId], 5000);
  const trials = usePolling(() => api.roomTrials(roomId), [roomId], 5000);
  const [createKey, setCreateKey] = useState(newIdempotencyKey);
  const [error, setError] = useState<ApiError>();
  const [busy, setBusy] = useState(false);

  if (room.loading) return <Loading what="Loading room" />;
  if (room.error) return <ErrorBox error={room.error} onRetry={room.reload} />;
  const d = room.data!;
  const isOwner = d.my_role === "OWNER";
  const hasActive = trials.data?.trials.some((t) => t.status !== "FINISHED") ?? false;

  async function createTrial() {
    setBusy(true);
    setError(undefined);
    try {
      const v = await api.createTrial(roomId, createKey);
      setCreateKey(newIdempotencyKey());
      navigate(`/trials/${v.trial.id}`);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid-2">
      <section className="card">
        <h2>{d.room.name}</h2>
        <p>
          Invite code: <code className="invite">{d.room.invite_code}</code>{" "}
          <span className="muted">— share it with your training partners</span>
        </p>
        <h3>Members ({d.members.length})</h3>
        <ul className="list">
          {d.members.map((m) => (
            <li key={m.user_id}>
              {m.display_name} <span className="muted">@{m.username}</span> {m.role === "OWNER" && <StatusPill status="OWNER" />}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Trials</h2>
        {isOwner && !hasActive && (
          <button className="btn btn-primary" onClick={createTrial} disabled={busy}>
            {busy ? "Generating synthetic dataset…" : "New trial (synthetic data)"}
          </button>
        )}
        {!isOwner && !hasActive && <p className="muted">Waiting for the owner to create a trial.</p>}
        <ErrorBox error={error} />
        {trials.loading ? (
          <Loading />
        ) : trials.error ? (
          <ErrorBox error={trials.error} onRetry={trials.reload} />
        ) : trials.data!.trials.length === 0 ? (
          <Empty>No trials yet.</Empty>
        ) : (
          <ul className="list">
            {trials.data!.trials.map((t) => (
              <li key={t.id}>
                <a href={`#/trials/${t.id}`}>Trial #{t.id}</a> <StatusPill status={t.status} />
                <span className="muted"> · {formatDateTime(t.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
