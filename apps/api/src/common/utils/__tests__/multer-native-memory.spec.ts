import { Readable } from 'stream';
import { nativeMemoryStorage } from '../multer-native-memory';
import type { Request } from 'express';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeFile(stream: Readable): { stream: Readable; buffer?: Buffer } {
  return { stream };
}

/** Readable that emits the given chunks, then 'end'. */
function readableFrom(...chunks: Buffer[]): Readable {
  return Readable.from(
    (async function* () {
      for (const c of chunks) yield c;
    })(),
  );
}

/**
 * Readable that emits `dataChunks`, then a synthetic 'limit' event, then
 * optionally more data (which the real engine must ignore), then 'end'.
 * Mirrors busboy's behaviour when limits.fileSize is exceeded.
 */
function readableWithLimit(dataChunks: Buffer[], afterLimitChunks: Buffer[] = []): Readable {
  const r = new Readable({ read() {} });
  setImmediate(() => {
    for (const c of dataChunks) r.push(c);
    r.emit('limit');
    for (const c of afterLimitChunks) r.push(c);
    r.push(null);
  });
  return r;
}

/** Readable that emits one chunk then emits an error. */
function readableWithError(chunk: Buffer, err: Error): Readable {
  const r = new Readable({ read() {} });
  setImmediate(() => {
    r.push(chunk);
    r.destroy(err);
  });
  return r;
}

const noop = {} as Request;

// ── tests ─────────────────────────────────────────────────────────────────────

describe('NativeMemoryStorage', () => {
  const storage = nativeMemoryStorage();

  it('buffers a normal file and returns correct buffer + size', (done) => {
    const payload = Buffer.from('hello world');
    storage._handleFile(noop, makeFile(readableFrom(payload)), (err, info) => {
      expect(err).toBeNull();
      expect(info?.buffer).toEqual(payload);
      expect(info?.size).toBe(payload.length);
      done();
    });
  });

  it('handles a zero-byte file', (done) => {
    storage._handleFile(noop, makeFile(readableFrom()), (err, info) => {
      expect(err).toBeNull();
      expect(info?.buffer).toEqual(Buffer.alloc(0));
      expect(info?.size).toBe(0);
      done();
    });
  });

  it('surfaces a stream error without hanging', (done) => {
    const boom = new Error('disk gone');
    storage._handleFile(
      noop,
      makeFile(readableWithError(Buffer.from('partial'), boom)),
      (err) => {
        expect(err).toBe(boom);
        done();
      },
    );
  });

  describe('file size limit (busboy "limit" event)', () => {
    it('calls back with LIMIT_FILE_SIZE error when the limit event fires', (done) => {
      const pre = Buffer.from('abc'); // data before limit
      storage._handleFile(noop, makeFile(readableWithLimit([pre])), (err) => {
        expect(err).not.toBeNull();
        expect((err as Error & { code?: string }).code).toBe('LIMIT_FILE_SIZE');
        done();
      });
    });

    it('calls back before end fires (does not wait for stream to close)', (done) => {
      const events: string[] = [];
      const stream = readableWithLimit([Buffer.from('data')]);

      stream.on('end', () => events.push('end'));

      storage._handleFile(noop, makeFile(stream), (err) => {
        events.push('cb');
        // cb must fire before or at the same tick as 'end', never after
        expect(events.indexOf('cb')).toBeLessThanOrEqual(events.indexOf('end') === -1 ? 0 : events.indexOf('end'));
        expect(err).not.toBeNull();
        done();
      });
    });

    it('does not call back twice when limit fires and end follows', (done) => {
      let callCount = 0;
      storage._handleFile(
        noop,
        makeFile(readableWithLimit([Buffer.from('x')])),
        () => {
          callCount++;
        },
      );
      // wait a tick for the stream to fully drain
      setTimeout(() => {
        expect(callCount).toBe(1);
        done();
      }, 50);
    });
  });

  it('two concurrent uploads do not interleave buffers', (done) => {
    const payloadA = Buffer.alloc(4, 0x41); // 'AAAA'
    const payloadB = Buffer.alloc(4, 0x42); // 'BBBB'

    let resultA: Buffer | undefined;
    let resultB: Buffer | undefined;

    storage._handleFile(noop, makeFile(readableFrom(payloadA)), (err, info) => {
      expect(err).toBeNull();
      resultA = info?.buffer;
      if (resultB !== undefined) {
        expect(resultA).toEqual(payloadA);
        expect(resultB).toEqual(payloadB);
        done();
      }
    });

    storage._handleFile(noop, makeFile(readableFrom(payloadB)), (err, info) => {
      expect(err).toBeNull();
      resultB = info?.buffer;
      if (resultA !== undefined) {
        expect(resultA).toEqual(payloadA);
        expect(resultB).toEqual(payloadB);
        done();
      }
    });
  });
});
