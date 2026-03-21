#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { runAuth } from './auth.js';
import { runSync } from './sync.js';
import { runDownload } from './downloader.js';
import { getStats, getRecentEvents, getDevices } from './db.js';

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

program.parseAsync(process.argv)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(chalk.red('\nError:'), err?.message ?? err);
    process.exit(1);
  });
