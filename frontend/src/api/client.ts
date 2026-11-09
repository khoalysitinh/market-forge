// Thin fetch wrapper. Responsibilities:
//  - send the session cookie (same origin, HttpOnly — JS never sees it)
//  - attach the CSRF token to every state-changing request
//  - turn the API's { error: { code, message } } into an ApiError
import type {
  AuditEvent, CandlesView, Decision, Direction, Me, Review, Room, RoomDetail, RoundView, Trial, TrialView,
} from "./types";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

let csrfToken = "";
export function setCsrfToken(token: string) {
  csrfToken = token;
}

/** New random key for one user action; reuse it when retrying that same action. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

async function request<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET" && csrfToken) headers["X-CSRF-Token"] = csrfToken;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      headers,
      credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Cannot reach the API server");
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(res.status, err?.code ?? "HTTP_" + res.status, err?.message ?? res.statusText);
  }
  return data as T;
}

export interface DecisionInput {
  direction: Direction;
  thesis: string;
  invalidation: string;
  confidence: number;
  risk_note: string;
}

export interface ReviewInput {
  decision_id: number;
  thesis_clear: boolean;
  invalidation_defined: boolean;
  risk_defined: boolean;
  evidence_based: boolean;
  feedback: string;
}

export const api = {
  register: (username: string, password: string, display_name: string) =>
    request<{ user: unknown }>("POST", "/auth/register", { username, password, display_name }),
  login: (username: string, password: string) => request<Me>("POST", "/auth/login", { username, password }),
  logout: () => request<void>("POST", "/auth/logout"),
  me: () => request<Me>("GET", "/auth/me"),

  listRooms: () => request<{ rooms: Room[] }>("GET", "/rooms"),
  createRoom: (name: string, key: string) => request<RoomDetail>("POST", "/rooms", { name }, key),
  joinRoom: (invite_code: string) => request<RoomDetail>("POST", "/rooms/join", { invite_code }),
  getRoom: (id: number) => request<RoomDetail>("GET", `/rooms/${id}`),
  roomEvents: (id: number) => request<{ events: AuditEvent[] }>("GET", `/rooms/${id}/events`),
  roomTrials: (id: number) => request<{ trials: Trial[] }>("GET", `/rooms/${id}/trials`),
  createTrial: (roomId: number, key: string) => request<TrialView>("POST", `/rooms/${roomId}/trials`, undefined, key),

  getTrial: (id: number) => request<TrialView>("GET", `/trials/${id}`),
  startTrial: (id: number) => request<TrialView>("POST", `/trials/${id}/start`),
  candles: (id: number) => request<CandlesView>("GET", `/trials/${id}/candles`),

  getRound: (id: number) => request<RoundView>("GET", `/rounds/${id}`),
  commitDecision: (roundId: number, input: DecisionInput, key: string) =>
    request<{ decision: Decision }>("POST", `/rounds/${roundId}/decisions`, input, key),
  submitReview: (roundId: number, input: ReviewInput, key: string) =>
    request<{ review: Review }>("POST", `/rounds/${roundId}/reviews`, input, key),
  roundAction: (roundId: number, action: "lock" | "reveal" | "complete") =>
    request<RoundView>("POST", `/rounds/${roundId}/${action}`),
};
