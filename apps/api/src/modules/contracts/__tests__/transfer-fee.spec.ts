import { BadRequestException } from '@nestjs/common';
import {
  TRANSFER_FEE_DEFAULTS,
  TRANSFER_FEE_VALIDATORS,
  resolveTransferFeeSettings,
  transferFeeFor,
} from '../transfer-fee';

describe('transfer fee', () => {
  it('is nothing while switched off (the default)', () => {
    expect(transferFeeFor(1_000_000, TRANSFER_FEE_DEFAULTS)).toBe(0);
  });

  it('a percentage of the contract price, to the cent', () => {
    expect(transferFeeFor(1_000_000, { enabled: true, mode: 'PERCENT', value: 2.5 })).toBe(25_000);
    expect(transferFeeFor(333.33, { enabled: true, mode: 'PERCENT', value: 1 })).toBe(3.33);
  });

  it('or a fixed amount', () => {
    expect(transferFeeFor(1_000_000, { enabled: true, mode: 'FIXED', value: 15_000 })).toBe(15_000);
  });

  it('resolves stored settings, falling back on malformed values', () => {
    expect(
      resolveTransferFeeSettings([
        { key: 'transferFee.enabled', value: true },
        { key: 'transferFee.value', value: -4 },
      ]),
    ).toEqual({ ...TRANSFER_FEE_DEFAULTS, enabled: true });
  });

  it('rejects invalid values', () => {
    expect(() => TRANSFER_FEE_VALIDATORS['transferFee.mode']!('transferFee.mode', 'DAILY')).toThrow(BadRequestException);
    expect(() => TRANSFER_FEE_VALIDATORS['transferFee.value']!('transferFee.value', 1.234)).toThrow(BadRequestException);
    expect(() => TRANSFER_FEE_VALIDATORS['transferFee.enabled']!('transferFee.enabled', true)).not.toThrow();
  });
});
