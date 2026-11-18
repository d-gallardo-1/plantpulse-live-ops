import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, MAX_UPLOAD_BYTES } from '../../lib/api';
import { MatrixToolbar } from './MatrixToolbar';

afterEach(cleanup);

const BUILT_IN = 'Built-in sample matrix';
const UPLOADED = 'Uploaded workbook: mine.xlsx';

function renderToolbar(matrixSource = BUILT_IN) {
  const run = (_key: string, action: () => Promise<unknown>) => void action();
  render(<MatrixToolbar matrixSource={matrixSource} pending={new Set()} run={run} />);
}

function choose(file: File) {
  const input = screen.getByLabelText('Choose a Cause and Effect workbook to upload');
  fireEvent.change(input, { target: { files: [file] } });
}

function fileOfSize(name: string, size: number): File {
  const file = new File(['PK'], name);
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

const replaced = { source: UPLOADED, revision: 1, rule_count: 12, alarms_cleared: ['ALM-207'] };

describe('MatrixToolbar', () => {
  it('uploads a valid workbook and reports the result, including cleared alarms', async () => {
    const upload = vi.spyOn(api, 'uploadMatrix').mockResolvedValue(replaced);
    renderToolbar();
    const file = fileOfSize('mine.xlsx', 9000);

    choose(file);

    expect(upload).toHaveBeenCalledWith(file);
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toBe('Loaded 12 rules from mine.xlsx. 1 active alarm(s) were cleared.');
  });

  it('refuses a file that is not .xlsx without contacting the server', () => {
    const upload = vi.spyOn(api, 'uploadMatrix').mockResolvedValue(replaced);
    renderToolbar();

    choose(fileOfSize('matrix.csv', 100));

    expect(upload).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Only .xlsx workbooks are accepted.');
  });

  it('refuses a file over the size limit without contacting the server', () => {
    const upload = vi.spyOn(api, 'uploadMatrix').mockResolvedValue(replaced);
    renderToolbar();

    choose(fileOfSize('big.xlsx', MAX_UPLOAD_BYTES + 1));
    expect(upload).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('The file is larger than the 2 MB limit.');

    choose(fileOfSize('limit.xlsx', MAX_UPLOAD_BYTES)); // exactly at the limit is allowed
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('shows the reason the server gave when it rejects the workbook', async () => {
    vi.spyOn(api, 'uploadMatrix').mockRejectedValue(new Error('Unknown station ID(s): STN-99.'));
    renderToolbar();

    choose(fileOfSize('mine.xlsx', 9000));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Upload rejected: Unknown station ID(s): STN-99.');
  });

  it('offers Restore only while a custom matrix is loaded', () => {
    renderToolbar(BUILT_IN);
    expect(screen.queryByRole('button', { name: 'Restore sample matrix' })).toBeNull();

    cleanup();
    renderToolbar(UPLOADED);
    expect(screen.getByRole('button', { name: 'Restore sample matrix' })).toBeTruthy();
  });

  it('replaces an earlier success notice when a restore fails', async () => {
    vi.spyOn(api, 'uploadMatrix').mockResolvedValue({ ...replaced, alarms_cleared: [] });
    vi.spyOn(api, 'restoreMatrix').mockRejectedValue(new Error('HTTP 502'));
    renderToolbar(UPLOADED);
    choose(fileOfSize('mine.xlsx', 9000));
    await screen.findByRole('status');

    fireEvent.click(screen.getByRole('button', { name: 'Restore sample matrix' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Restore failed: HTTP 502'));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
