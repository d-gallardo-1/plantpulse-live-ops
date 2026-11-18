import type { MatrixReplacedResponse, MatrixResponse, NodeStatus } from '../types/telemetry';

// Same-origin API: Nginx (Docker) or the Vite dev server proxies /api to the backend.
export const API_BASE = '/api/v1';

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** Uses the server's own explanation when it sends one, so validation errors are readable. */
async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') return body.detail;
  } catch {
    /* not JSON: fall through */
  }
  return fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const fallback = `${init?.method ?? 'GET'} ${path} failed with HTTP ${response.status}`;
    throw new Error(await errorMessage(response, fallback));
  }
  return (await response.json()) as T;
}

const post = <T = unknown>(path: string, body?: unknown) =>
  request<T>(path, {
    method: 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const code = (alarmCode: string) => encodeURIComponent(alarmCode);

export const api = {
  matrix: () => request<MatrixResponse>('/matrix'),
  trigger: (alarmCode: string) => post(`/simulate/trigger/${code(alarmCode)}`),
  acknowledge: (alarmCode: string) => post(`/alarms/${code(alarmCode)}/acknowledge`),
  clear: (alarmCode: string) => post(`/simulate/clear/${code(alarmCode)}`),
  reset: () => post('/simulate/reset'),
  setAutoCycle: (enabled: boolean) => post('/simulate/auto-cycle', { enabled }),
  setNodeStatus: (nodeId: string, status: NodeStatus) =>
    post(`/simulate/network/${encodeURIComponent(nodeId)}`, { status }),
  /** Sends the workbook as the raw request body; the name travels as a label only. */
  uploadMatrix: (file: File) =>
    request<MatrixReplacedResponse>(`/matrix/upload?filename=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    }),
  restoreMatrix: () => post<MatrixReplacedResponse>('/matrix/restore-default'),
  exportSampleUrl: `${API_BASE}/matrix/export-sample`,
};

export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString('en-GB', { hour12: false });
}
