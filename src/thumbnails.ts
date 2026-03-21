import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { THUMBNAILS_DIR } from './config.js';
import { getEventsWithoutThumbnails, markThumbnailed, type DbEvent } from './db.js';

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

export async function generateThumbnail(event: DbEvent): Promise<void> {
  const input = event.file_path!.replace(/^~/, process.env.HOME ?? '~');
  fs.ensureDirSync(THUMBNAILS_DIR);
  const output = path.join(THUMBNAILS_DIR, `${event.id}.jpg`);
  await ffmpeg(input, output);
  const storedPath = output.replace(process.env.HOME ?? '', '~');
  markThumbnailed(event.id, storedPath);
}

export async function runThumbnails(opts: { concurrency?: number; force?: boolean } = {}): Promise<void> {
  const concurrency = opts.concurrency ?? 2;
  const events = getEventsWithoutThumbnails();

  if (events.length === 0) {
    console.log(chalk.green('✔ All thumbnails up to date.'));
    return;
  }

  const spinner = ora(`Generating thumbnails for ${events.length} video(s)...`).start();
  let done = 0;
  let failed = 0;

  for (let i = 0; i < events.length; i += concurrency) {
    const batch = events.slice(i, i + concurrency);
    await Promise.all(batch.map(async (event) => {
      try {
        await generateThumbnail(event);
        done++;
        spinner.text = `Generating thumbnails... ${done}/${events.length}`;
      } catch {
        failed++;
      }
    }));
  }

  spinner.succeed(`Thumbnails complete. ${done} generated${failed ? `, ${failed} failed` : ''}.`);
}
