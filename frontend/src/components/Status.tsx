import type { ReactNode } from "react";
import type { ApiError } from "../api/client";

export function Loading({ what = "Loading" }: { what?: string }) {
  return <div className="state state-loading">{what}…</div>;
}

export function ErrorBox({ error, onRetry }: { error: ApiError | Error | undefined; onRetry?: () => void }) {
  if (!error) return null;
  const code = "code" in error ? (error as ApiError).code : undefined;
  return (
    <div className="state state-error" role="alert">
      <span>
        {code && <code>{code}</code>} {error.message}
      </span>
      {onRetry && (
        <button className="btn btn-ghost" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="state state-empty">{children}</div>;
}

export function SyntheticBadge({ label }: { label: string }) {
  return <span className="badge badge-synthetic">{label}</span>;
}

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill pill-${status.toLowerCase()}`}>{status.replace("_", " ")}</span>;
}
