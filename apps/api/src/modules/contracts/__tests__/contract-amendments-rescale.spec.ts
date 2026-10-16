import { rescaleUnpaid } from '../contract-amendments.service';

describe('rescaleUnpaid (unit swap)', () => {
  it('spreads a higher price over the unpaid rows in proportion', () => {
    expect(rescaleUnpaid([400_000, 400_000], 100_000)).toEqual([450_000, 450_000]);
    expect(rescaleUnpaid([100, 300], 40)).toEqual([110, 330]);
  });

  it('spreads a lower price the same way', () => {
    expect(rescaleUnpaid([400_000, 400_000], -200_000)).toEqual([300_000, 300_000]);
  });

  it('keeps the total exact — the last row takes the rounding', () => {
    const out = rescaleUnpaid([100, 100, 100], 100)!;
    expect(out.reduce((a, b) => a + b, 0)).toBeCloseTo(400, 2);
    expect(out).toEqual([133.33, 133.33, 133.34]);
  });

  it('refuses a reduction larger than what is left to pay', () => {
    expect(rescaleUnpaid([400_000, 400_000], -900_000)).toBeNull();
  });

  it('a reduction to exactly zero leaves nothing to pay', () => {
    expect(rescaleUnpaid([50, 50], -100)).toEqual([0, 0]);
  });
});
