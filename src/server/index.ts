import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDevices, getStats, queryEvents, getEventById } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function startServer(port: number, outputDir: string): Promise<void> {
  const app = Fastify({ logger: false });

  await app.register(fastifyCors, { origin: true });

  // Serve built frontend from web/dist
  const webDist = path.resolve(__dirname, '../../web/dist');
  if (fs.existsSync(webDist)) {
    await app.register(fastifyStatic, {
      root: webDist,
      prefix: '/',
      decorateReply: false,
    });
  }

  // Serve video files
  const videoRoot = outputDir.replace(/^~/, process.env.HOME ?? '~');
  if (fs.existsSync(videoRoot)) {
    await app.register(fastifyStatic, {
      root: videoRoot,
      prefix: '/videos/',
      decorateReply: false,
    });
  }

  // ── API routes ───────────────────────────────────────────────────────────

  app.get('/api/status', async () => {
    return getStats();
  });

  app.get('/api/devices', async () => {
    return getDevices();
  });

  app.get('/api/events', async (req) => {
    const q = req.query as Record<string, string>;
    return queryEvents({
      device_id: q.device_id || undefined,
      kind:      q.kind || undefined,
      downloaded: q.downloaded !== undefined ? Number(q.downloaded) : undefined,
      dateFrom:  q.date_from ? Number(q.date_from) : undefined,
      dateTo:    q.date_to   ? Number(q.date_to)   : undefined,
      limit:     q.limit     ? Number(q.limit)     : 50,
      offset:    q.offset    ? Number(q.offset)    : 0,
    });
  });

  app.get('/api/events/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const event = getEventById(id);
    if (!event) return reply.status(404).send({ error: 'Not found' });
    return event;
  });

  // Video stream by event ID — looks up the file_path from the DB
  app.get('/api/video/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const event = getEventById(id);
    if (!event || !event.file_path) {
      return reply.status(404).send({ error: 'Video not downloaded' });
    }
    const filePath = event.file_path.replace(/^~/, process.env.HOME ?? '~');
    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ error: 'File not found on disk' });
    }
    return reply.sendFile(path.basename(filePath), path.dirname(filePath));
  });

  // SPA fallback — serve index.html for any unmatched route
  app.setNotFoundHandler(async (_req, reply) => {
    const indexPath = path.join(webDist, 'index.html');
    if (fs.existsSync(indexPath)) {
      return reply.sendFile('index.html', webDist);
    }
    return reply.status(404).send({ error: 'Not found' });
  });

  await app.listen({ port, host: '127.0.0.1' });
  console.log(`\n  ringdown web  →  http://localhost:${port}\n`);
}
