#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { runAuth } from './auth.js';
import { runSync } from './sync.js';
import { runDownload } from './downloader.js';
import { getStats, getRecentEvents, getDevices, getDownloadedFilePaths } from './db.js';
import fs from 'fs-extra';
import { loadConfig } from './config.js';

const program = new Command();

program
  .name('ringdown')
  .description('Download Ring camera videos to your local machine')
  .version('0.1.0');

// ─── auth ────────────────────────────────────────────────────────────────────

program
  .command('auth')
  .description('Authenticate with your Ring account')
  .action(async () => {
    await runAuth();
  });

// ─── sync ────────────────────────────────────────────────────────────────────

program
  .command('sync')
  .description('Fetch new events from Ring into the local database')
  .option('-d, --days <number>', 'Number of days of history to sync', parseInt)
  .action(async (opts) => {
    await runSync({ days: opts.days });
  });

// ─── download ────────────────────────────────────────────────────────────────

program
  .command('download')
  .description('Download all events not yet saved to disk')
  .option('-c, --concurrency <number>', 'Number of parallel downloads', parseInt)
  .action(async (opts) => {
    await runDownload({ concurrency: opts.concurrency });
  });

// ─── pull ────────────────────────────────────────────────────────────────────

program
  .command('pull')
  .description('Sync events from Ring then download anything new (main command)')
  .option('-d, --days <number>', 'Number of days of history to sync', parseInt)
  .option('-c, --concurrency <number>', 'Number of parallel downloads', parseInt)
  .action(async (opts) => {
    console.log(chalk.bold('\nringdown pull\n'));
    await runSync({ days: opts.days });
    await runDownload({ concurrency: opts.concurrency });
  });

// ─── status ──────────────────────────────────────────────────────────────────

program
  .command('status')
  .description('Show event counts: synced, downloaded, pending')
  .action(() => {
    const { total, downloaded, pending } = getStats();
    console.log('');
    console.log(`  Total events:  ${chalk.bold(total)}`);
    console.log(`  Downloaded:    ${chalk.green(downloaded)}`);
    console.log(`  Pending:       ${pending > 0 ? chalk.yellow(pending) : chalk.dim(pending)}`);
    console.log('');
  });

// ─── list ────────────────────────────────────────────────────────────────────

program
  .command('list')
  .description('List recent events with download status')
  .option('-n, --limit <number>', 'Number of events to show', parseInt)
  .action((opts) => {
    const limit = opts.limit ?? 20;
    const events = getRecentEvents(limit);

    if (events.length === 0) {
      console.log(chalk.dim('\nNo events found. Run `ringdown sync` first.\n'));
      return;
    }

    console.log('');
    for (const e of events) {
      const date = new Date(e.created_at * 1000).toLocaleString();
      const status = e.downloaded
        ? chalk.green('✓')
        : chalk.yellow('○');
      const kind = chalk.dim(`[${e.kind}]`);
      console.log(`  ${status}  ${date}  ${chalk.bold(e.device_name)}  ${kind}`);
    }
    console.log('');
  });

// ─── ls-devices ──────────────────────────────────────────────────────────────

program
  .command('ls-devices')
  .description('List all Ring devices seen in the local database')
  .action(() => {
    const devices = getDevices();

    if (devices.length === 0) {
      console.log(chalk.dim('\nNo devices found. Run `ringdown sync` first.\n'));
      return;
    }

    console.log('');
    for (const d of devices) {
      console.log(`  ${chalk.bold(d.name)}  ${chalk.dim(d.kind)}  ${chalk.dim(`(${d.id})`)}`);
    }
    console.log('');
  });

// ─── storage ─────────────────────────────────────────────────────────────────

program
  .command('storage')
  .description('Show disk usage breakdown by camera')
  .action(() => {
    const rows = getDownloadedFilePaths();

    const byCamera = new Map<string, { count: number; bytes: number }>();

    for (const { device_name, file_path } of rows) {
      const resolved = file_path.replace(/^~/, process.env.HOME ?? '~');
      let size = 0;
      try { size = fs.statSync(resolved).size; } catch { /* file missing */ }

      const entry = byCamera.get(device_name) ?? { count: 0, bytes: 0 };
      entry.count++;
      entry.bytes += size;
      byCamera.set(device_name, entry);
    }

    const fmt = (bytes: number) => {
      if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
      if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
      return `${(bytes / 1e3).toFixed(1)} KB`;
    };

    const sorted = [...byCamera.entries()].sort((a, b) => b[1].bytes - a[1].bytes);
    const totalBytes = sorted.reduce((sum, [, v]) => sum + v.bytes, 0);
    const totalCount = sorted.reduce((sum, [, v]) => sum + v.count, 0);
    const nameWidth = Math.max(...sorted.map(([k]) => k.length), 6);

    console.log('');
    console.log(`  ${'Camera'.padEnd(nameWidth)}   ${'Videos'.padStart(7)}   ${'Size'.padStart(8)}`);
    console.log(`  ${'─'.repeat(nameWidth + 22)}`);
    for (const [name, { count, bytes }] of sorted) {
      console.log(`  ${chalk.bold(name.padEnd(nameWidth))}   ${String(count).padStart(7)}   ${chalk.cyan(fmt(bytes).padStart(8))}`);
    }
    console.log(`  ${'─'.repeat(nameWidth + 22)}`);
    console.log(`  ${'Total'.padEnd(nameWidth)}   ${String(totalCount).padStart(7)}   ${chalk.green(fmt(totalBytes).padStart(8))}`);
    console.log('');
  });

// ─── thumbnails ──────────────────────────────────────────────────────────────

program
  .command('thumbnails')
  .description('Generate JPEG thumbnails for downloaded videos using ffmpeg')
  .option('-c, --concurrency <number>', 'Parallel ffmpeg processes', parseInt)
  .action(async (opts) => {
    const { runThumbnails } = await import('./thumbnails.js');
    await runThumbnails({ concurrency: opts.concurrency });
  });

// ─── serve ───────────────────────────────────────────────────────────────────

program
  .command('serve')
  .description('Start the web UI to browse and watch videos')
  .option('-p, --port <number>', 'Port to listen on', '3000')
  .action(async (opts) => {
    const { startServer } = await import('./server/index.js');
    const config = loadConfig();
    const port = parseInt(opts.port, 10);
    await startServer(port, config.outputDir);
    // Don't exit — keep the server running
  });

program.parseAsync(process.argv)
  .then(() => {
    if (process.argv[2] !== 'serve') process.exit(0);
  })
  .catch((err) => {
    console.error(chalk.red('\nError:'), err?.message ?? err);
    process.exit(1);
  });
