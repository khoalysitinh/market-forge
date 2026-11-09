import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";

export interface Remote<T> {
  data: T | undefined;
  error: ApiError | undefined;
  loading: boolean; // true only until the first response
  reload: () => void;
}

/**
 * Fetches `load` now and then every `intervalMs` (0 = no polling).
 * v0.1 uses polling instead of WebSockets (see docs/adr/ADR-005).
 * The server stays the source of truth; we only display its answer.
 */
export function usePolling<T>(load: () => Promise<T>, deps: unknown[], intervalMs = 0): Remote<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<ApiError>();
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(() => {
    loadRef
      .current()
      .then((d) => {
        setData(d);
        setError(undefined);
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e : new ApiError(0, "UNKNOWN", String(e))))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    setData(undefined);
    run();
    if (intervalMs <= 0) return;
    const id = window.setInterval(run, intervalMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload: run };
}
