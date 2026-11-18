import type { CauseEffectRule } from '../types/telemetry';
import raw from './dataset.json';

// dataset.json is generated from the backend data by
// scripts/export_demo_dataset.py; a backend test keeps the two in step.

export interface StationDefinition {
  station_id: string;
  name: string;
  sequence: number;
  description: string;
}

export interface NodeDefinition {
  node_id: string;
  description: string;
  kind: string;
  ip_address: string;
  baseline_latency_ms: number;
}

export interface DemoDataset {
  facility: string;
  shift_target: number;
  gateway_node_id: string;
  stations: StationDefinition[];
  rules: CauseEffectRule[];
  nodes: NodeDefinition[];
}

export const DATASET = raw as unknown as DemoDataset;
