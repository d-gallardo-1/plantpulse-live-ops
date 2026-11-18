import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  OctagonAlert,
  Radio,
  RefreshCw,
  Wifi,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import type { NodeStatus, StationStatus, StreamStatus } from '../types/telemetry';

export type Tone = 'nominal' | 'warn' | 'high' | 'critical' | 'link';

// Tailwind only generates classes it can see as complete strings, so every
// tone lists its classes explicitly instead of building them dynamically.
export const TONE_CLASSES: Record<Tone, { text: string; border: string; bg: string; fill: string }> = {
  nominal: { text: 'text-nominal', border: 'border-nominal/50', bg: 'bg-nominal/10', fill: 'fill-nominal' },
  warn: { text: 'text-warn', border: 'border-warn/50', bg: 'bg-warn/10', fill: 'fill-warn' },
  high: { text: 'text-high', border: 'border-high/50', bg: 'bg-high/10', fill: 'fill-high' },
  critical: { text: 'text-red-400', border: 'border-critical/60', bg: 'bg-critical/10', fill: 'fill-critical' },
  link: { text: 'text-link', border: 'border-link/50', bg: 'bg-link/10', fill: 'fill-link' },
};

export type AnyStatus = StationStatus | NodeStatus | StreamStatus;

interface StatusMeta {
  label: string;
  tone: Tone;
  icon: LucideIcon;
}

// Status is never conveyed by colour alone: each one has its own icon and label.
export const STATUS_META: Record<AnyStatus, StatusMeta> = {
  NOMINAL: { label: 'NOMINAL', tone: 'nominal', icon: CheckCircle2 },
  WARNING: { label: 'WARNING', tone: 'warn', icon: AlertTriangle },
  HIGH: { label: 'HIGH', tone: 'high', icon: CircleAlert },
  CRITICAL: { label: 'CRITICAL', tone: 'critical', icon: OctagonAlert },
  ONLINE: { label: 'ONLINE', tone: 'nominal', icon: Wifi },
  DEGRADED: { label: 'DEGRADED', tone: 'warn', icon: AlertTriangle },
  OFFLINE: { label: 'OFFLINE', tone: 'critical', icon: WifiOff },
  CONNECTED: { label: 'CONNECTED', tone: 'link', icon: Radio },
  RECONNECTING: { label: 'RECONNECTING', tone: 'warn', icon: RefreshCw },
  DISCONNECTED: { label: 'DISCONNECTED', tone: 'critical', icon: WifiOff },
};
