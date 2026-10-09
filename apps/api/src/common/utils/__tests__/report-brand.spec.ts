import { ConfigService } from '@nestjs/config';
import { Workbook } from 'exceljs';
import { R2Service } from '../../../modules/media/r2.service';
import { argb, fallbackBrand, fitInto, imageExtension, imageSize, monogram, type ReportBrand } from '../report-brand';
import { addBoardBanner, addFooter } from '../xlsx';

/**
 * Report files carry the company's identity (name, logo, colours) instead of
 * the platform's — and the logo is only ever read from our own bucket.
 */
function png(width: number, height: number): Buffer {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

describe('report brand helpers', () => {
  it('recognises PNG / JPEG and reads the PNG size', () => {
    expect(imageExtension(png(400, 100))).toBe('png');
    expect(imageExtension(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('jpeg');
    expect(imageExtension(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(imageSize(png(400, 100))).toEqual({ width: 400, height: 100 });
  });

  it('fits a wide logo without stretching it', () => {
    expect(fitInto({ width: 400, height: 100 }, { width: 160, height: 70 })).toEqual({ width: 160, height: 40 });
    expect(fitInto(null, { width: 160, height: 70 })).toEqual({ width: 160, height: 70 });
  });

  it('monogram, ARGB colours', () => {
    expect(monogram('Real Estate Platform')).toBe('RE');
    expect(monogram('ديفورا')).toBe('دي');
    expect(argb('#1e3a5f')).toBe('FF1E3A5F');
    expect(argb('nope')).toBe('FF0F1E33');
  });
});

describe('R2Service.readPublicImage — never fetches a foreign host', () => {
  const config = (values: Record<string, string>) =>
    ({ get: (k: string) => values[k] }) as unknown as ConfigService;

  it('returns null for a URL outside the configured public base', async () => {
    const r2 = new R2Service(config({ R2_PUBLIC_URL: 'https://cdn.example.com', R2_BUCKET: 'pub' }));
    await expect(r2.readPublicImage('https://169.254.169.254/latest/meta-data')).resolves.toBeNull();
    await expect(r2.readPublicImage('https://evil.example.org/logo.png')).resolves.toBeNull();
  });

  it('returns null when storage is not configured or the value is empty', async () => {
    const r2 = new R2Service(config({}));
    await expect(r2.readPublicImage('branding/logo.png')).resolves.toBeNull();
    await expect(r2.readPublicImage(null)).resolves.toBeNull();
  });
});

describe('XLSX banner / footer use the company identity', () => {
  const brand: ReportBrand = {
    ...fallbackBrand('SAR'),
    name: 'شركة النخبة',
    primary: '#1E3A5F',
    accent: '#C8A24B',
  };

  it('company name, brand colour and currency in the banner; company in the footer', () => {
    const wb = new Workbook();
    const ws = wb.addWorksheet('s');
    addBoardBanner(ws, 'تقرير المبيعات', 6, { wb, brand });
    expect(ws.getCell(1, 1).value).toBe('شركة النخبة');
    expect((ws.getCell(2, 1).fill as { fgColor: { argb: string } }).fgColor.argb).toBe('FF1E3A5F');
    expect(String(ws.getCell(3, 1).value)).toContain('(SAR)');
    addFooter(ws, brand);
    expect(ws.getRow(ws.rowCount).getCell(1).value).toBe('صادر عن شركة النخبة');
  });
});
