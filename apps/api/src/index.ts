import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { registerAnalisaFotoAiRoutes } from './routes/analisaFotoAi.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerCrudRoutes } from './routes/crud.js';
import { registerDashboardRoutes } from './routes/dashboard.js';
import { registerKlinikRoutes } from './routes/klinik.js';
import { registerTransferRoutes } from './routes/transfer.js';
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Paket produksi: frontend hasil build (apps/web/dist) disalin ke apps/api/web-dist,
// sejajar dengan folder build/ tempat file terkompilasi ini berada.
const webDistDir = join(__dirname, '..', 'web-dist');
const hasWebDist = existsSync(join(webDistDir, 'index.html'));

// Default 1MB is too small for base64-encoded logo/foto rontgen uploads.
const app = Fastify({ logger: true, bodyLimit: 16 * 1024 * 1024 });

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
});

app.get('/api/health', async () => ({ ok: true }));

await registerAuthRoutes(app);
await registerAnalisaFotoAiRoutes(app);
await registerDashboardRoutes(app);
await registerCrudRoutes(app);
await registerKlinikRoutes(app);
await registerTransferRoutes(app);

if (hasWebDist) {
  await app.register(fastifyStatic, { root: webDistDir });

  app.setNotFoundHandler((req, reply) => {
    if (req.raw.url?.startsWith('/api/')) {
      return reply.status(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });
}

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
