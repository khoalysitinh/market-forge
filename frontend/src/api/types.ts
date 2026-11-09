// Types mirror the JSON returned by the Go API (see docs/api/API.md).
// The server is the source of truth: the UI only displays these values.

export interface User {
  id: number;
  username: string;
  display_name: string;
  created_at: string;
}

export interface Me {
  user: User;
  csrf_token: string;
  expires_at: string;
}

export type Role = "OWNER" | "MEMBER";

export interface Room {
  id: number;
  name: string;
  owner_id: number;
  invite_code: string;
  status: string;
  created_at: string;
}

export interface Member {
  user_id: number;
  username: string;
  display_name: string;
  role: Role;
  joined_at: string;
}

export interface RoomDetail {
  room: Room;
  my_role: Role;
  members: Member[];
}

export type TrialStatus = "CREATED" | "RUNNING" | "FINISHED";
export type RoundStatus = "DECISION_OPEN" | "REVIEW_BLIND" | "REVEALED" | "COMPLETED";
export type Direction = "LONG" | "SHORT" | "WAIT";

export interface Trial {
  id: number;
  room_id: number;
  dataset_fingerprint: string;
  engine_version: string;
  status: TrialStatus;
  clock_index: number;
  round_bars: number;
  created_at: string;
}

export interface Dataset {
  label: string;
  symbol: string;
  timeframe: string;
  generator_version: string;
  candle_count: number;
  price_scale: number;
  fingerprint: string;
}

export interface Round {
  id: number;
  trial_id: number;
  round_no: number;
  status: RoundStatus;
  decision_clock_index: number;
  reveal_clock_index: number | null;
  opened_at: string;
  locked_at: string | null;
  revealed_at: string | null;
  completed_at: string | null;
}

export interface TrialView {
  trial: Trial;
  dataset: Dataset;
  clock_time: string;
  my_role: Role;
  rounds: Round[];
  current_round_id: number | null;
}

export interface Candle {
  seq: number;
  open_time: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface CandlesView {
  trial_id: number;
  clock_index: number;
  label: string;
  symbol: string;
  timeframe: string;
  price_scale: number;
  candles: Candle[];
}

export interface Decision {
  id: number;
  round_id: number;
  user_id: number;
  author_name: string;
  direction: Direction;
  thesis: string;
  invalidation: string;
  confidence: number;
  risk_note: string;
  dataset_fingerprint: string;
  known_at_clock_index: number;
  known_at_candle_time: string;
  committed_at: string;
}

export interface Review {
  id: number;
  decision_id: number;
  reviewer_id: number;
  reviewer_name: string;
  thesis_clear: boolean;
  invalidation_defined: boolean;
  risk_defined: boolean;
  evidence_based: boolean;
  feedback: string;
  created_at: string;
}

export interface Participant {
  user_id: number;
  display_name: string;
  role: Role;
  committed: boolean;
}

export interface Outcome {
  from_clock_index: number;
  to_clock_index: number;
  decision_close: number;
  reveal_close: number;
  window_high: number;
  window_low: number;
  move_ticks: number;
  price_scale: number;
  note: string;
}

export interface RoundView {
  round: Round;
  room_id: number;
  my_role: Role;
  participants: Participant[];
  my_decision: Decision | null;
  decisions_sealed: boolean;
  decisions: Decision[];
  reviews: Review[];
  outcome: Outcome | null;
}

export interface AuditEvent {
  id: number;
  sequence: number;
  type: string;
  actor_id: number;
  subject_type: string;
  subject_id: number;
  payload: Record<string, unknown>;
  created_at: string;
}
