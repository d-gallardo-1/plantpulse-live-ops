// Mirrors backend/app/models.py. Every SSE event carries one full PlantSnapshot.

export type Severity = 'WARNING' | 'HIGH' | 'CRITICAL';
export type StationStatus = 'NOMINAL' | Severity;
export type NodeStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE';
export type AlarmSource = 'MANUAL' | 'AUTO';
export type EventKind =
  | 'RAISED'
  | 'ACKNOWLEDGED'
  | 'CLEARED'
  | 'RESET'
  | 'AUTO_CYCLE'
  | 'NETWORK'
  | 'MATRIX';
export type StreamStatus = 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';

export interface CauseEffectRule {
  alarm_code: string;
  station_id: string;
  station_name: string;
  severity: Severity;
  title: string;
  root_cause: string;
  trip_condition: string;
  device_tag: string;
  device_description: string;
  plc_input: string;
  cabinet: string;
  junction_box: string;
  interlock_effect: string;
  affected_output: string;
  affected_output_description: string;
  recommended_action: string;
}

export interface ActiveAlarm {
  event_id: string;
  raised_at: string;
  source: AlarmSource;
  rule: CauseEffectRule;
  /** Set once an operator acknowledges the alarm; it stays active until cleared. */
  acknowledged_at: string | null;
}

/** A cleared alarm with its lifecycle: raised -> acknowledged -> cleared. */
export interface AlarmHistoryEntry {
  event_id: string;
  alarm_code: string;
  title: string;
  station_id: string;
  severity: Severity;
  source: AlarmSource;
  raised_at: string;
  acknowledged_at: string | null;
  cleared_at: string;
}

export interface StationState {
  station_id: string;
  name: string;
  sequence: number;
  description: string;
  status: StationStatus;
  active_alarm_codes: string[];
}

export interface NetworkNodeState {
  node_id: string;
  description: string;
  kind: string;
  ip_address: string;
  status: NodeStatus;
  latency_ms: number | null;
  packet_loss_pct: number;
  forced: boolean;
}

export interface Kpis {
  oee_pct: number;
  cycle_output: number;
  shift_target: number;
  active_interlocks: number;
  gateway_latency_ms: number | null;
}

export interface PlantEvent {
  event_id: string;
  timestamp: string;
  kind: EventKind;
  message: string;
  alarm_code: string | null;
  station_id: string | null;
  severity: Severity | null;
  source: AlarmSource | null;
}

export interface PlantSnapshot {
  facility: string;
  simulated: boolean;
  sequence: number;
  timestamp: string;
  auto_cycle: boolean;
  stations: StationState[];
  active_alarms: ActiveAlarm[];
  network_nodes: NetworkNodeState[];
  kpis: Kpis;
  event_log: PlantEvent[];
  alarm_history: AlarmHistoryEntry[];
  /** Incremented each time the Cause & Effect matrix is replaced. */
  matrix_revision: number;
  matrix_source: string;
}

export interface MatrixReplacedResponse {
  source: string;
  revision: number;
  rule_count: number;
  alarms_cleared: string[];
}

export interface MatrixResponse {
  query: string;
  station_id: string | null;
  count: number;
  rules: CauseEffectRule[];
}

export type ViewId = 'live' | 'matrix' | 'network';
