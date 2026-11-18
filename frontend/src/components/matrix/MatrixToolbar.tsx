import { Download, RotateCcw, Upload } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { api, MAX_UPLOAD_BYTES } from '../../lib/api';
import { DEMO_MODE } from '../../lib/demoMode';

interface Props {
  matrixSource: string;
  pending: ReadonlySet<string>;
  run: (key: string, action: () => Promise<unknown>) => void;
}

/**
 * Matrix source controls: download the workbook, upload an edited copy, restore.
 * The server enforces the same limits again; the checks here only give faster feedback.
 */
export function MatrixToolbar({ matrixSource, pending, run }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const busy = pending.has('matrix-upload') || pending.has('matrix-restore');
  const custom = matrixSource.startsWith('Uploaded');

  const onFileChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow choosing the same file again
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setNotice({ ok: false, text: 'Only .xlsx workbooks are accepted.' });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setNotice({ ok: false, text: 'The file is larger than the 2 MB limit.' });
      return;
    }
    setNotice(null);
    run('matrix-upload', async () => {
      try {
        const result = await api.uploadMatrix(file);
        const cleared = result.alarms_cleared.length;
        setNotice({
          ok: true,
          text: `Loaded ${result.rule_count} rules from ${file.name}.${
            cleared > 0 ? ` ${cleared} active alarm(s) were cleared.` : ''
          }`,
        });
      } catch (cause) {
        const text = cause instanceof Error ? cause.message : 'unknown error';
        setNotice({ ok: false, text: `Upload rejected: ${text}` });
      }
    });
  };

  const restore = () => {
    setNotice(null);
    run('matrix-restore', async () => {
      try {
        await api.restoreMatrix();
        setNotice({ ok: true, text: 'Built-in sample matrix restored.' });
      } catch (cause) {
        const text = cause instanceof Error ? cause.message : 'unknown error';
        setNotice({ ok: false, text: `Restore failed: ${text}` });
      }
    });
  };

  if (DEMO_MODE) {
    return (
      <p className="text-xs text-slate-400">
        Source: <span className="text-slate-200">{matrixSource}</span>. Downloading the workbook
        and uploading an edited copy need the backend, so they are not part of this browser demo.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <a className="btn px-2 py-1 text-xs" href={api.exportSampleUrl} download>
          <Download aria-hidden="true" className="h-3.5 w-3.5" />
          Download matrix (.xlsx)
        </a>
        <button
          type="button"
          className="btn px-2 py-1 text-xs"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          <Upload aria-hidden="true" className="h-3.5 w-3.5" />
          Upload custom matrix (.xlsx, max 2 MB)
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a Cause and Effect workbook to upload"
          onChange={onFileChosen}
        />
        {custom && (
          <button type="button" className="btn px-2 py-1 text-xs" disabled={busy} onClick={restore}>
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
            Restore sample matrix
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Source: <span className={custom ? 'text-link' : 'text-slate-200'}>{matrixSource}</span>. Download
        the workbook, edit a row in Excel and upload it to see the change live. Uploading clears
        active alarms.
      </p>

      {notice && (
        <p
          role={notice.ok ? 'status' : 'alert'}
          className={`rounded border px-2 py-1.5 text-xs ${
            notice.ok
              ? 'border-nominal/50 bg-nominal/10 text-nominal'
              : 'border-critical/50 bg-critical/10 text-red-400'
          }`}
        >
          {notice.text}
        </p>
      )}
    </div>
  );
}
