import type { MatrixReplacedResponse, MatrixResponse, NodeStatus } from '../types/telemetry';
import { DATASET } from './dataset';
import { DemoEngine } from './engine';

let shared: DemoEngine | null = null;

/** The one engine of the page, created and started on first use. */
export function demoEngine(): DemoEngine {
  if (!shared) {
    shared = new DemoEngine(DATASET);
    shared.start();
  }
  return shared;
}

export const UPLOAD_UNAVAILABLE =
  'Uploading a workbook needs the backend, so it is not part of the browser demo.';

/** Runs a command on the engine and publishes the result, as a backend route does. */
function command<T>(action: (engine: DemoEngine) => T): Promise<T> {
  try {
    const engine = demoEngine();
    const result = action(engine);
    engine.publish();
    return Promise.resolve(result);
  } catch (cause) {
    return Promise.reject(cause);
  }
}

/** The same surface as the HTTP client in lib/api.ts, served by the in-page engine. */
export const demoApi = {
  matrix: (): Promise<MatrixResponse> => {
    const rules = demoEngine().rules;
    return Promise.resolve({ query: '', station_id: null, count: rules.length, rules });
  },
  trigger: (alarmCode: string): Promise<unknown> => command((engine) => engine.trigger(alarmCode)),
  acknowledge: (alarmCode: string): Promise<unknown> =>
    command((engine) => engine.acknowledge(alarmCode)),
  clear: (alarmCode: string): Promise<unknown> => command((engine) => engine.clear(alarmCode)),
  reset: (): Promise<unknown> => command((engine) => engine.reset()),
  setAutoCycle: (enabled: boolean): Promise<unknown> =>
    command((engine) => engine.setAutoCycle(enabled)),
  setNodeStatus: (nodeId: string, status: NodeStatus): Promise<unknown> =>
    command((engine) => engine.setNodeStatus(nodeId, status)),
  uploadMatrix: (_file: File): Promise<MatrixReplacedResponse> =>
    Promise.reject(new Error(UPLOAD_UNAVAILABLE)),
  restoreMatrix: (): Promise<MatrixReplacedResponse> =>
    command((engine) => {
      const cleared = engine.restoreDefaultRules();
      const snapshot = engine.snapshot();
      return {
        source: snapshot.matrix_source,
        revision: snapshot.matrix_revision,
        rule_count: engine.rules.length,
        alarms_cleared: cleared,
      };
    }),
  exportSampleUrl: '#',
};
