import { fallbackBrand, type ReportBrand } from '../../utils/report-brand';
import { dataTable, kpiGrid, moneyText, percentText, reportDocument } from '../report-html';
import { barChartSvg, niceScale, shareChartSvg } from '../svg-charts';

const brand = (over: Partial<ReportBrand> = {}): ReportBrand => ({
  ...fallbackBrand('EGP'),
  name: 'شركة النيل',
  ...over,
});

describe('report HTML — tenant data never becomes markup', () => {
  const evil = '<script>alert(1)</script><img src=x onerror=alert(2)>';

  it('escapes the company name, title, KPI and table cells', () => {
    const html = reportDocument({
      brand: brand({ name: evil, contactEmail: evil }),
      title: evil,
      subtitle: evil,
      body: kpiGrid([{ label: evil, value: evil }]) + dataTable([{ label: evil }], [[evil]]),
    });
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&#60;script&#62;');
  });

  it('accepts brand colours only as #RRGGBB (no CSS injection)', () => {
    const html = reportDocument({
      brand: brand({ primary: 'red;}body{display:none' }),
      title: 't',
      body: '',
    });
    expect(html).not.toContain('display:none');
    expect(html).toContain('--primary:#0F1E33');
  });

  it('escapes chart labels', () => {
    expect(barChartSvg({ series: [{ label: evil, value: 1 }] })).not.toContain('<script>');
    expect(shareChartSvg({ series: [{ label: evil, value: 1 }] })).not.toContain('<script>');
  });

  it('embeds the Arabic font and loads nothing remote', () => {
    const html = reportDocument({ brand: brand(), title: 'تقرير', body: '' });
    expect(html).toContain("font-family:'ReportArabic';src:url(data:font/ttf;base64,");
    expect(html).not.toMatch(/(src|href)=["']?https?:/);
  });

  it('shows the company logo inline when there is one, else a monogram', () => {
    const logo = {
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0]),
      extension: 'png' as const,
    };
    expect(reportDocument({ brand: brand({ logo }), title: 't', body: '' })).toContain(
      'src="data:image/png;base64,',
    );
    expect(
      reportDocument({ brand: brand({ name: 'Nile Towers' }), title: 't', body: '' }),
    ).toContain('>NT<');
  });
});

describe('report HTML — formatting', () => {
  it('formats money with the company currency symbol', () => {
    expect(moneyText(6_100_000, 'EGP')).toBe('6,100,000 ج.م');
    expect(moneyText('1461666.68', 'EGP')).toBe('1,461,666.68 ج.م');
  });

  it('writes a percentage, or a dash when there is no whole', () => {
    expect(percentText(23, 30)).toBe('77%');
    expect(percentText(1, 0)).toBe('—');
  });
});

describe('SVG charts', () => {
  it('rounds the value axis to 1-2-5 steps', () => {
    expect(niceScale(9)).toEqual({ max: 10, step: 5 });
    expect(niceScale(18_500_000)).toEqual({ max: 20_000_000, step: 5_000_000 });
    expect(niceScale(0)).toEqual({ max: 4, step: 1 });
  });

  it('draws the first category on the right (RTL)', () => {
    const svg = barChartSvg({
      width: 400,
      series: [
        { label: 'مايو', value: 1 },
        { label: 'يونيو', value: 2 },
      ],
    });
    const x = (label: string) => Number(new RegExp(`x="([\\d.]+)"[^>]*>${label}<`).exec(svg)![1]);
    expect(x('مايو')).toBeGreaterThan(x('يونيو'));
  });

  it('ranks shares largest first, labels them "value · percent" and folds the tail into «أخرى»', () => {
    const svg = shareChartSvg({
      limit: 3,
      series: [
        { label: 'أ', value: 1 },
        { label: 'ب', value: 6 },
        { label: 'ج', value: 2 },
        { label: 'د', value: 1 },
        { label: 'صفر', value: 0 },
      ],
    });
    expect(svg.indexOf('>ب<')).toBeLessThan(svg.indexOf('>ج<'));
    expect(svg).toContain('6 · 60%');
    expect(svg).toContain('>أخرى<');
    expect(svg).not.toContain('>صفر<');
  });

  it('returns nothing to draw for empty data', () => {
    expect(barChartSvg({ series: [] })).toBe('');
    expect(shareChartSvg({ series: [{ label: 'أ', value: 0 }] })).toBe('');
  });
});
