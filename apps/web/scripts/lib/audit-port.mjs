import { createServer } from 'node:net';

export function assertPortAvailable(port, label) {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new RangeError(`${label} port must be an integer between 1 and 65535.`);
  }

  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once('error', (error) => {
      const code = error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : 'listen failed';
      reject(new Error(
        `${label} port ${port} is unavailable (${code}). ` +
        'Stop the stale process or choose another port before auditing.',
      ));
    });

    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });
}
