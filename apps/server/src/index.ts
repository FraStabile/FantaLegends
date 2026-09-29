import { config } from './config.js';
import { createApp } from './app.js';

const { app, close } = await createApp(config, { logger: true });
await app.listen({ port: config.port, host: config.host });
console.log(`⚽ Asta Legends server on http://localhost:${config.port}  (db: ${config.databasePath})`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await close();
    process.exit(0);
  });
}
