import { buildApp } from './app.js';
import { env } from './config/env.js';

const app = buildApp();
const shutdownSignals = ['SIGINT', 'SIGTERM'] as const;

async function shutdown(
  signal: (typeof shutdownSignals)[number],
): Promise<void> {
  app.log.info({ signal }, 'Shutting down application');

  try {
    await app.close();
  } catch (error) {
    app.log.error(error, 'Failed to shut down application gracefully');
    process.exitCode = 1;
  }
}

for (const signal of shutdownSignals) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}

async function start(): Promise<void> {
  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT,
    });
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
}

void start();
