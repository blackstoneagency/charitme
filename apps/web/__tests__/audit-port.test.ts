import { createServer } from 'node:net';
import { describe, expect, it } from 'vitest';
import { assertPortAvailable } from '../scripts/lib/audit-port.mjs';

function listenOnRandomPort(): Promise<{ port: number; close: () => Promise<void> }> {
  const server = createServer();

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not resolve the test server port.'));
        return;
      }

      resolve({
        port: address.port,
        close: () => new Promise<void>((closeResolve, closeReject) => {
          server.close((error) => {
            if (error) closeReject(error);
            else closeResolve();
          });
        }),
      });
    });
  });
}

describe('audit port preflight', () => {
  it('rejects invalid port values before trying to listen', () => {
    expect(() => assertPortAvailable(0, 'Audit app')).toThrow(
      'Audit app port must be an integer between 1 and 65535.',
    );
  });

  it('rejects an occupied port and accepts it after the listener closes', async () => {
    const listener = await listenOnRandomPort();

    try {
      await expect(assertPortAvailable(listener.port, 'Audit app')).rejects.toThrow(
        `Audit app port ${listener.port} is unavailable`,
      );
    } finally {
      await listener.close();
    }
    await expect(assertPortAvailable(listener.port, 'Audit app')).resolves.toBeUndefined();
  });
});
