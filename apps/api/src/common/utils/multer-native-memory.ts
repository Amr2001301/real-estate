import type { Readable } from 'stream';
import type { Request } from 'express';

interface MulterFile {
  stream: Readable;
  buffer?: Buffer;
  [key: string]: unknown;
}

interface StorageEngine {
  _handleFile(req: Request, file: MulterFile, cb: (err: Error | null, info?: { buffer: Buffer; size: number }) => void): void;
  _removeFile(req: Request, file: MulterFile, cb: (err: Error | null) => void): void;
}

// Custom multer storage that buffers the file using native Node.js stream events.
//
// WHY THIS EXISTS — multer's default MemoryStorage uses concat-stream → readable-stream@3,
// which has a lazy `require('./_stream_duplex')` inside the Writable constructor. The
// NestJS app is compiled inside the FIRST Jest security-spec file's vm-context. When that
// vm-context is torn down by Jest, the `require` function captured in readable-stream's
// closure points into a dead context. The next file upload (DI-3) triggers the lazy
// require, which returns `undefined` → `this instanceof undefined` → TypeError.
// Using native stream events avoids that entire code path; there are no npm module
// lazy-requires involved.
//
// LIMITS — When FileInterceptor is configured with `limits.fileSize`, multer passes the
// value to busboy. Busboy emits a 'limit' event on the file stream when the limit is
// reached and stops forwarding data (the stream ends with truncated content). This engine
// listens for that event, clears any accumulated chunks, and calls back with an error
// immediately — before the stream emits 'end' — so no oversized data sits in memory.
class NativeMemoryStorage implements StorageEngine {
  _handleFile(
    _req: Request,
    file: MulterFile,
    cb: (err: Error | null, info?: { buffer: Buffer; size: number }) => void,
  ): void {
    const chunks: Buffer[] = [];
    let done = false;

    const finish = (err: Error | null, info?: { buffer: Buffer; size: number }): void => {
      if (done) return;
      done = true;
      cb(err, info);
    };

    file.stream.on('data', (chunk: unknown) => {
      if (!done) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBufferLike));
      }
    });

    file.stream.on('limit', () => {
      chunks.length = 0; // release accumulated bytes before signalling error
      finish(Object.assign(new Error('File too large'), { code: 'LIMIT_FILE_SIZE' }));
    });

    file.stream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      finish(null, { buffer, size: buffer.length });
    });

    file.stream.on('error', (err: Error) => finish(err));
  }

  _removeFile(
    _req: Request,
    file: MulterFile,
    cb: (err: Error | null) => void,
  ): void {
    delete file.buffer;
    cb(null);
  }
}

export function nativeMemoryStorage(): StorageEngine {
  return new NativeMemoryStorage();
}
