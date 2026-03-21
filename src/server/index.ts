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
    const q = req.query as Record<string, string | string[]>;
    const deviceIds = q.device_id
      ? (Array.isArray(q.device_id) ? q.device_id : [q.device_id]).filter(Boolean)
      : [];
    return queryEvents({
      device_ids: deviceIds.length ? deviceIds : undefined,
      kind:       typeof q.kind === 'string' ? q.kind || undefined : undefined,
      downloaded: typeof q.downloaded === 'string' && q.downloaded !== '' ? Number(q.downloaded) : undefined,
      dateFrom:   typeof q.date_from === 'string' && q.date_from ? Number(q.date_from) : undefined,
      dateTo:     typeof q.date_to   === 'string' && q.date_to   ? Number(q.date_to)   : undefined,
      limit:      typeof q.limit     === 'string' && q.limit     ? Number(q.limit)     : 50,
      offset:     typeof q.offset    === 'string' && q.offset    ? Number(q.offset)    : 0,
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

    const stat = fs.statSync(filePath);
    const total = stat.size;
    const rangeHeader = (req.headers as Record<string, string>)['range'];

    if (rangeHeader) {
      const [startStr, endStr] = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : total - 1;
      const chunkSize = end - start + 1;

      reply
        .status(206)
        .header('Content-Range', `bytes ${start}-${end}/${total}`)
        .header('Accept-Ranges', 'bytes')
        .header('Content-Length', chunkSize)
        .header('Content-Type', 'video/mp4');

      return reply.send(fs.createReadStream(filePath, { start, end }));
    }

    reply
      .header('Content-Length', total)
      .header('Accept-Ranges', 'bytes')
      .header('Content-Type', 'video/mp4');

    return reply.send(fs.createReadStream(filePath));
  });

  // Thumbnail by event ID
  app.get('/api/thumbnail/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const event = getEventById(id);
    if (!event || !event.thumbnail_path) {
      return reply.status(404).send({ error: 'Thumbnail not generated' });
    }
    const filePath = event.thumbnail_path.replace(/^~/, process.env.HOME ?? '~');
    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ error: 'Thumbnail file not found on disk' });
    }
    reply.header('Content-Type', 'image/jpeg');
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    return reply.send(fs.createReadStream(filePath));
  });

  // Screenshot upload — saves PNG to docs/screenshot.png in the project root
  app.post('/api/screenshot', async (req, reply) => {
    const repoRoot = path.resolve(__dirname, '../../');
    const docsDir = path.join(repoRoot, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });
    const dest = path.join(docsDir, 'screenshot.png');
    const body = req.body as Buffer;
    fs.writeFileSync(dest, body);
    return reply.send({ saved: dest });
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
