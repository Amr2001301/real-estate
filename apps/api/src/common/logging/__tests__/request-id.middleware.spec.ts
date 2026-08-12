import { requestIdMiddleware, RequestWithId } from '../request-id.middleware';

function makeReq(incomingId?: string): RequestWithId {
  return {
    headers: incomingId ? { 'x-request-id': incomingId } : {},
  } as RequestWithId;
}

function makeRes() {
  const headers: Record<string, string> = {};
  return {
    res: {
      setHeader(k: string, v: string) { headers[k] = v; },
    } as never,
    getHeader: (k: string) => headers[k],
  };
}

describe('requestIdMiddleware', () => {
  it('generates a UUID when no x-request-id header is present', () => {
    const req = makeReq();
    const { res, getHeader } = makeRes();
    const next = jest.fn();
    requestIdMiddleware(req, res, next);
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(getHeader('x-request-id')).toBe(req.id);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('preserves a valid incoming x-request-id header', () => {
    const incoming = 'my-trace-abc-123';
    const req = makeReq(incoming);
    const { res, getHeader } = makeRes();
    requestIdMiddleware(req, res, jest.fn());
    expect(req.id).toBe(incoming);
    expect(getHeader('x-request-id')).toBe(incoming);
  });

  it('generates a fresh UUID when the incoming id is too long (> 128 chars)', () => {
    const tooLong = 'a'.repeat(129);
    const req = makeReq(tooLong);
    const { res } = makeRes();
    requestIdMiddleware(req, res, jest.fn());
    expect(req.id).not.toBe(tooLong);
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('generates a fresh UUID when the incoming id contains unsafe characters', () => {
    const withAngle = '<script>xss</script>';
    const req = makeReq(withAngle);
    const { res } = makeRes();
    requestIdMiddleware(req, res, jest.fn());
    expect(req.id).not.toBe(withAngle);
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('accepts array header values and uses the first element', () => {
    const req = {
      headers: { 'x-request-id': ['first-id', 'second-id'] },
    } as unknown as RequestWithId;
    const { res } = makeRes();
    requestIdMiddleware(req, res, jest.fn());
    expect(req.id).toBe('first-id');
  });

  it('sets the x-request-id response header on every request', () => {
    const req = makeReq();
    const { res, getHeader } = makeRes();
    requestIdMiddleware(req, res, jest.fn());
    const header = getHeader('x-request-id');
    expect(header).toBeDefined();
    expect(header!.length).toBeGreaterThan(0);
  });

  it('generates different IDs for concurrent requests (no collision)', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const req = makeReq();
      const { res } = makeRes();
      requestIdMiddleware(req, res, jest.fn());
      ids.add(req.id!);
    }
    expect(ids.size).toBe(100);
  });
});
