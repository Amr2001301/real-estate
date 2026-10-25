import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';

/**
 * The app's base URL on a real port, for many requests at once.
 *
 * supertest given a server that is not listening starts its own listener per
 * request; with several requests in flight those collide and some fail with
 * ECONNRESET. Listening once (the shared app keeps it until the run ends)
 * lets a test send nine guesses truly in parallel.
 */
export async function listeningUrl(app: INestApplication): Promise<string> {
  const server = app.getHttpServer() as import('node:http').Server;
  if (!server.listening) {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  }
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
