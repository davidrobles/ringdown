import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { THUMBNAILS_DIR } from './config.js';
import { getEventsWithoutThumbnails, getEventsWithoutDuration, markThumbnailed, setDuration, type DbEvent } from './db.js';

function ffmpeg(input: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-ss', '1',
      '-i', input,
      '-frames:v', '1',
      '-q:v', '3',
      '-y', output,
    ], { stdio: 'pipe' });

    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(output)) {
        resolve();
      } else {
        // Video shorter than 1s — retry at 0s
        const proc2 = spawn('ffmpeg', [
          '-i', input,
          '-frames:v', '1',
          '-q:v', '3',
          '-y', output,
        ], { stdio: 'pipe' });
        proc2.stderr.on('data', () => {});
        proc2.on('close', (code2) => {
          if (code2 === 0 && fs.existsSync(output)) resolve();
          else reject(new Error(stderr.slice(-200)));
        });
        proc2.on('error', reject);
      }
    });

    proc.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') reject(new Error('ffmpeg not found — install it with: brew install ffmpeg'));
      else reject(err);
    });
  });
}

function ffprobe(input: string): Promise<number | null> {
  return new Promise((resolve) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      input,
    ], { stdio: 'pipe' });

    let out = '';
    proc.stdout.on('data', (d: Buffer) => { out += d.toString(); });
    proc.on('close', () => {
      const val = parseFloat(out.trim());
      resolve(isNaN(val) ? null : Math.round(val));
    });
    proc.on('error', () => resolve(null));
  });
}

export async function generateThumbnail(event: DbEvent): Promise<void> {
  const input = event.file_path!.replace(/^~/, process.env.HOME ?? '~');
  fs.ensureDirSync(THUMBNAILS_DIR);
  const output = path.join(THUMBNAILS_DIR, `${event.id}.jpg`);
  const [, duration] = await Promise.all([ffmpeg(input, output), ffprobe(input)]);
  const storedPath = output.replace(process.env.HOME ?? '', '~');
  markThumbnailed(event.id, storedPath);
  if (duration !== null) setDuration(event.id, duration);
}

export async function runThumbnails(opts: { concurrency?: number } = {}): Promise<void> {
  const concurrency = opts.concurrency ?? 2;
  const withoutThumbnails = getEventsWithoutThumbnails();
  const withoutDuration = getEventsWithoutDuration().filter(e => e.thumbnail_path !== null);

  if (withoutThumbnails.length === 0 && withoutDuration.length === 0) {
    console.log(chalk.green('✔ All thumbnails and durations up to date.'));
    return;
  }

  // Generate missing thumbnails (also extracts duration)
  if (withoutThumbnails.length > 0) {
    const spinner = ora(`Generating thumbnails for ${withoutThumbnails.length} video(s)...`).start();
    let done = 0; let failed = 0;
    for (let i = 0; i < withoutThumbnails.length; i += concurrency) {
      const batch = withoutThumbnails.slice(i, i + concurrency);
      await Promise.all(batch.map(async (event) => {
        try { await generateThumbnail(event); done++; spinner.text = `Generating thumbnails... ${done}/${withoutThumbnails.length}`; }
        catch { failed++; }
      }));
    }
    spinner.succeed(`Thumbnails complete. ${done} generated${failed ? `, ${failed} failed` : ''}.`);
  }

  // Backfill durations for events that already have thumbnails
  if (withoutDuration.length > 0) {
    const spinner = ora(`Backfilling duration for ${withoutDuration.length} video(s)...`).start();
    let done = 0; let failed = 0;
    for (let i = 0; i < withoutDuration.length; i += concurrency) {
      const batch = withoutDuration.slice(i, i + concurrency);
      await Promise.all(batch.map(async (event) => {
        try {
          const input = event.file_path!.replace(/^~/, process.env.HOME ?? '~');
          const duration = await ffprobe(input);
          if (duration !== null) setDuration(event.id, duration);
          done++;
          spinner.text = `Backfilling duration... ${done}/${withoutDuration.length}`;
        } catch { failed++; }
      }));
    }
    spinner.succeed(`Durations complete. ${done} backfilled${failed ? `, ${failed} failed` : ''}.`);
  }
}
