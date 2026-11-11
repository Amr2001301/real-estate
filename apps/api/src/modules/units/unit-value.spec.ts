import { averagePerMeter, currentRate, isShown, resolveUnitValueSettings, unitValue, valueHistory, type PricedUnit } from './unit-value';

const u = (price: number, area: number, type = '2BR', usage = 'RESIDENTIAL', modelId: string | null = null): PricedUnit => ({
  price,
  area,
  type,
  usage,
  modelId,
});

describe('«قيمة وحدتك»', () => {
  it('is off, and shows only a rise, until the company says otherwise', () => {
    expect(resolveUnitValueSettings([])).toEqual({ enabled: false, showDecrease: false });
    expect(resolveUnitValueSettings([{ key: 'unitValue.enabled', value: true }, { key: 'unitValue.showDecrease', value: 'yes' }])).toEqual({
      enabled: true,
      showDecrease: false,
    });
  });

  it('averages the price per meter of units with an area', () => {
    expect(averagePerMeter([])).toBeNull();
    expect(averagePerMeter([u(3_800_000, 100), u(4_000_000, 100), u(1, 0)])).toBe(39_000);
  });

  describe('today’s price per meter', () => {
    const owned = { type: '2BR', usage: 'RESIDENTIAL', modelId: 'm1' };
    const none = new Map<string | null, number>();

    it('prefers the same model, then the same type', () => {
      const forSale = [u(4_000_000, 100, '2BR', 'RESIDENTIAL', 'm1'), u(3_000_000, 100, '2BR', 'RESIDENTIAL', 'm2')];
      expect(currentRate(owned, forSale, none)).toEqual({ pricePerMeter: 40_000, basis: 'MODEL', source: 'MARKET' });
      expect(currentRate({ ...owned, modelId: null }, forSale, none)).toEqual({ pricePerMeter: 35_000, basis: 'TYPE', source: 'MARKET' });
    });

    it('values a sold-out type by the company’s figure, never by other types (even of the same usage)', () => {
      const forSale = [u(5_000_000, 100, '3BR')];
      expect(currentRate(owned, forSale, new Map([['2br', 38_000]]))).toEqual({ pricePerMeter: 38_000, basis: 'TYPE', source: 'MANUAL' });
      expect(currentRate(owned, forSale, none)).toBeNull();
    });

    it('falls back to the project’s figure, and to nothing — never a guess', () => {
      const shops = [u(9_000_000, 100, 'Shop', 'COMMERCIAL')];
      expect(currentRate(owned, shops, new Map([[null, 36_000]]))).toEqual({ pricePerMeter: 36_000, basis: 'PROJECT', source: 'MANUAL' });
      expect(currentRate(owned, shops, none)).toBeNull();
    });
  });

  it('values the unit against the price paid (the plan’s example: 145 m² at 4,640,000, now 38,000/m²)', () => {
    expect(unitValue(4_640_000, 145, 38_000)).toEqual({ currentValue: 5_510_000, gain: 870_000, gainPct: 18.8 });
    expect(unitValue(4_640_000, 145, 30_000).gain).toBe(-290_000);
  });

  it('shows a rise; a fall only when the company asks', () => {
    expect(isShown(870_000, false)).toBe(true);
    expect(isShown(0, true)).toBe(false);
    expect(isShown(-290_000, false)).toBe(false);
    expect(isShown(-290_000, true)).toBe(true);
  });

  it('draws the price paid, the last rate of each earlier month since, then today', () => {
    const bought = new Date('2026-01-10T00:00:00Z');
    const today = new Date('2026-11-11T00:00:00Z');
    const h = valueHistory(
      bought,
      32_000,
      [
        { recordedAt: new Date('2025-12-01T00:00:00Z'), pricePerMeter: 30_000 },
        { recordedAt: new Date('2026-03-01T00:00:00Z'), pricePerMeter: 33_000 },
        { recordedAt: new Date('2026-03-20T00:00:00Z'), pricePerMeter: 34_000 },
        { recordedAt: new Date('2026-07-05T00:00:00Z'), pricePerMeter: 36_500 },
        { recordedAt: new Date('2026-11-02T00:00:00Z'), pricePerMeter: 37_000 },
      ],
      { at: today, pricePerMeter: 38_000 },
    );
    expect(h.map((p) => p.pricePerMeter)).toEqual([32_000, 34_000, 36_500, 38_000]);
    expect(h[0]!.date).toBe(bought.toISOString());
  });
});
