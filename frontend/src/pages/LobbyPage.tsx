import { useState, type FormEvent } from "react";
import { api, ApiError, newIdempotencyKey } from "../api/client";
import { navigate } from "../lib/router";
import { Empty, ErrorBox, Loading } from "../components/Status";
import { usePolling } from "../lib/usePolling";
import { formatDateTime } from "../lib/format";

export function LobbyPage() {
  const rooms = usePolling(() => api.listRooms(), []);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [createKey, setCreateKey] = useState(newIdempotencyKey);
  const [error, setError] = useState<ApiError>();
  const [busy, setBusy] = useState(false);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      // The same key is reused if the user retries after a network error,
      // so a double submit never creates two rooms.
      const d = await api.createRoom(name, createKey);
      setCreateKey(newIdempotencyKey());
      navigate(`/rooms/${d.room.id}`);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const d = await api.joinRoom(code);
      navigate(`/rooms/${d.room.id}`);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid-2">
      <section className="card">
        <h2>Your Dojo rooms</h2>
        {rooms.loading ? (
          <Loading />
        ) : rooms.error ? (
          <ErrorBox error={rooms.error} onRetry={rooms.reload} />
        ) : rooms.data!.rooms.length === 0 ? (
          <Empty>No rooms yet. Create one or join with an invite code.</Empty>
        ) : (
          <ul className="list">
            {rooms.data!.rooms.map((r) => (
              <li key={r.id}>
                <a href={`#/rooms/${r.id}`}>{r.name}</a>
                <span className="muted"> · created {formatDateTime(r.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Create a room</h2>
        <form onSubmit={create} className="form-inline">
          <input placeholder="Room name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
          <button className="btn btn-primary" disabled={busy}>Create</button>
        </form>
        <h2>Join with invite code</h2>
        <form onSubmit={join} className="form-inline">
          <input placeholder="e.g. 7KQ2MXRP4A" value={code} onChange={(e) => setCode(e.target.value)} required
            minLength={10} maxLength={10} className="mono" />
          <button className="btn" disabled={busy}>Join</button>
        </form>
        <ErrorBox error={error} />
      </section>
    </div>
  );
}
