import { imageSize } from '../report-brand';
import { compactNumber, renderBarChartPng, renderShareChartPng } from '../xlsx-chart';

/**
 * P15.2 — chart rendering for board reports (chart.js + @napi-rs/canvas).
 * Confirms real PNG output on the happy path AND that the graceful-fallback
 * contract holds: empty input never throws and returns null, so a board export
 * can always fall back to KPI/data tables without producing a broken file.
 */
describe('xlsx-chart renderer', () => {
  it('renders a bar chart to a real PNG buffer', async () => {
    const png = await renderBarChartPng({
      series: [
        { label: 'يناير', value: 4 },
        { label: 'فبراير', value: 9 },
        { label: 'مارس', value: 2 },
      ],
    });
    expect(png).not.toBeNull();
    // PNG magic: 89 50 4E 47 0D 0A 1A 0A
    expect(png!.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(png!.length).toBeGreaterThan(200);
  });

  it('renders a share chart (ranked horizontal bars) to a real PNG buffer', async () => {
    const png = await renderShareChartPng({
      series: [
        { label: 'مباشر', value: 10 },
        { label: 'الويب', value: 4 },
      ],
    });
    expect(png).not.toBeNull();
    expect(png!.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it('renders at 2x the display size so it stays sharp when scaled', async () => {
    const png = await renderBarChartPng({
      width: 400,
      height: 200,
      series: [{ label: 'أ', value: 1 }],
    });
    expect(imageSize(png!)).toEqual({ width: 800, height: 400 });
  });

  it('writes compact values for large amounts', () => {
    expect(compactNumber(950)).toBe('950');
    expect(compactNumber(12_500)).toBe('12,500');
    expect(compactNumber(950_000)).toBe('950K');
    expect(compactNumber(18_500_000)).toBe('18.5M');
  });

  it('returns null (no throw) for empty series — graceful fallback', async () => {
    await expect(renderBarChartPng({ series: [] })).resolves.toBeNull();
    await expect(renderShareChartPng({ series: [] })).resolves.toBeNull();
    // A share chart of nothing but zeros has nothing to show either.
    await expect(renderShareChartPng({ series: [{ label: 'أ', value: 0 }] })).resolves.toBeNull();
  });
});
