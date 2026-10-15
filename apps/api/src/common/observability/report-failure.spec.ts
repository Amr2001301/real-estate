import { captureExceptionSafe } from './sentry';
import { reportFailure, swallowedErrorsTotal } from './report-failure';

jest.mock('./sentry', () => ({ captureExceptionSafe: jest.fn() }));

const capture = captureExceptionSafe as jest.MockedFunction<typeof captureExceptionSafe>;

async function count(area: string): Promise<number> {
  const { values } = await swallowedErrorsTotal.get();
  return values.find((v) => v.labels.area === area)?.value ?? 0;
}

describe('reportFailure', () => {
  const logger = { warn: jest.fn(), error: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('logs, counts by area and sends the error to Sentry tagged with the area', async () => {
    const before = await count('test-area');
    const err = new Error('boom');

    reportFailure(logger, 'test-area', 'linking failed', err);

    expect(logger.warn).toHaveBeenCalledWith('linking failed: boom');
    expect(logger.error).not.toHaveBeenCalled();
    expect(await count('test-area')).toBe(before + 1);
    expect(capture).toHaveBeenCalledTimes(1);
    const [sent, ctx] = capture.mock.calls[0]!;
    expect((sent as Error).message).toBe('boom');
    expect(ctx).toEqual({ area: 'test-area' });
  });

  it('logs at error level when asked', () => {
    reportFailure(logger, 'test-area', 'cron failed', new Error('x'), 'error');
    expect(logger.error).toHaveBeenCalledWith('cron failed: x');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('keeps e-mail addresses out of what goes to Sentry', () => {
    const err = new Error('550 5.1.1 <someone@example.com>: Recipient address rejected');

    reportFailure(logger, 'test-area', 'mail failed', err);

    const sent = capture.mock.calls[0]![0] as Error;
    expect(sent.message).toBe('550 5.1.1 <<email>>: Recipient address rejected');
    expect(sent.stack).not.toContain('someone@example.com');
  });

  it('accepts a non-Error value', () => {
    reportFailure(logger, 'test-area', 'odd', 'plain string');
    expect(logger.warn).toHaveBeenCalledWith('odd: plain string');
    expect((capture.mock.calls[0]![0] as Error).message).toBe('plain string');
  });
});
