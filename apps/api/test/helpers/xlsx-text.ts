import type request from 'supertest';
import { Workbook } from 'exceljs';

/**
 * Sends an export request and reads the workbook back as plain text (every
 * cell of every sheet, one row per line), so a spec can check what the file
 * says. A non-200 answer comes back with empty text.
 */
export async function xlsxText(req: request.Test): Promise<{ status: number; text: string }> {
  const res = await req.buffer(true).parse((r, cb) => {
    const chunks: Buffer[] = [];
    r.on('data', (d: Buffer) => chunks.push(d));
    r.on('end', () => cb(null, Buffer.concat(chunks)));
  });
  if (res.status !== 200) return { status: res.status, text: '' };
  const wb = new Workbook();
  await wb.xlsx.load(res.body as unknown as ArrayBuffer);
  const lines: string[] = [];
  wb.eachSheet((ws) =>
    ws.eachRow((row) => {
      const cells = (row.values as unknown[]).slice(1).map((v) => (v == null ? '' : String(v)));
      lines.push(cells.join('\t'));
    }),
  );
  return { status: res.status, text: lines.join('\n') };
}
