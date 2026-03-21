import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import { RingCamera } from 'ring-client-api';
import { getRingApi } from './auth.js';
import { getPendingEvents, markDownloaded, DbEvent } from './db.js';
import { generateThumbnail } from './thumbnails.js';
import { loadConfig } from './config.js';

interface DownloadOptions {
  concurrency?: number;
}

function eventToFilePath(outputDir: string, event: DbEvent): string {
  const date = new Date(event.created_at * 1000);
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  const safeName = event.device_name.replace(/[^a-z0-9 _-]/gi, '_');
  return path.join(outputDir, safeName, dateStr, `${event.id}.mp4`);
}

async function downloadEvent(
  camera: RingCamera,
  event: DbEvent,
  filePath: string
): Promise<void> {
  const url = await camera.getRecordingUrl(event.id);
  if (!url) throw new Error('No recording URL returned');

  await fs.ensureDir(path.dirname(filePath));

  const { default: fetch } = await import('node-fetch');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  await new Promise<void>((resolve, reject) => {
    const dest = fs.createWriteStream(filePath);
    response.body!.pipe(dest);
    dest.on('finish', resolve);
    dest.on('error', reject);
    response.body!.on('error', reject);
  });
}

export async function runDownload(options: DownloadOptions = {}): Promise<number> {
  const config = loadConfig();
  const concurrency = options.concurrency ?? config.concurrency;
  const outputDir = config.outputDir.replace(/^~/, process.env.HOME ?? '~');

  const pending = getPendingEvents();

  if (pending.length === 0) {
    console.log(chalk.green('Nothing to download — all events are up to date.'));
    return 0;
  }

  const api = await getRingApi();
  const cameras = await api.getCameras();
  const cameraById = new Map(cameras.map((c) => [String(c.id), c]));

  console.log(chalk.bold(`\nDownloading ${pending.length} video(s)...\n`));

  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i += concurrency) {
    const batch = pending.slice(i, i + concurrency);

    await Promise.all(
      batch.map(async (event) => {
        const filePath = eventToFilePath(outputDir, event);
        const label = `${event.device_name} / ${new Date(event.created_at * 1000).toLocaleString()} [${event.kind}]`;
        const spinner = ora(label).start();

        try {
          if (await fs.pathExists(filePath)) {
            markDownloaded(event.id, filePath);
            spinner.succeed(chalk.dim(`${label} — already on disk`));
            downloaded++;
            return;
          }

          const camera = cameraById.get(event.device_id);
          if (!camera) throw new Error(`Camera ${event.device_id} not found`);

          await downloadEvent(camera, event, filePath);
          markDownloaded(event.id, filePath);
          const updatedEvent = { ...event, file_path: filePath };
          await generateThumbnail(updatedEvent).catch((err) => {
            console.error('thumbnail error:', err?.message ?? err);
          });
          spinner.succeed(label);
          downloaded++;
        } catch (err: any) {
          spinner.fail(`${label} — ${err?.message ?? err}`);
          failed++;
        }
      })
    );
  }

  console.log('');
  if (downloaded > 0) console.log(chalk.green(`Downloaded: ${downloaded}`));
  if (failed > 0) console.log(chalk.red(`Failed: ${failed}`));

  return downloaded;
}
