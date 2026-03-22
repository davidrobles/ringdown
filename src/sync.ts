import chalk from 'chalk';
import ora from 'ora';
import { getRingApi } from './auth.js';
import { upsertDevice, upsertEvent } from './db.js';
import { loadConfig } from './config.js';

interface SyncOptions {
  days?: number;
}

export async function runSync(options: SyncOptions = {}): Promise<number> {
  const config = loadConfig();
  const lookbackDays = options.days ?? config.lookbackDays;
  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);
  const sinceTs = since.getTime() / 1000;

  const spinner = ora('Connecting to Ring...').start();

  let api: Awaited<ReturnType<typeof getRingApi>>;
  try {
    api = await getRingApi();
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    if (/unauthorized|refresh.?token|401|invalid.?token/i.test(msg)) {
      spinner.fail(
        chalk.red('Authentication failed — your Ring session has expired.\n') +
        chalk.yellow('  Run: ') + chalk.bold('ringdown auth')
      );
    } else {
      spinner.fail(`Failed to connect to Ring: ${msg}`);
    }
    process.exit(1);
  }

  spinner.text = 'Fetching cameras...';
  const cameras = await api.getCameras();

  if (cameras.length === 0) {
    spinner.warn('No Ring cameras found on this account.');
    return 0;
  }

  spinner.text = `Found ${cameras.length} camera(s). Syncing event history...`;

  let newEventCount = 0;

  for (const camera of cameras) {
    upsertDevice({
      id: String(camera.id),
      name: camera.name,
      kind: String(camera.deviceType),
    });

    spinner.text = `Syncing ${chalk.bold(camera.name)}...`;

    try {
      let paginationKey: string | undefined;
      let keepGoing = true;

      while (keepGoing) {
        const response = await camera.getEvents({
          limit: 50,
          ...(paginationKey ? { pagination_key: paginationKey } : {}),
        });

        if (!response || response.events.length === 0) break;

        for (const event of response.events) {
          const createdAt = new Date(event.created_at).getTime() / 1000;

          if (createdAt < sinceTs) {
            keepGoing = false;
            break;
          }

          upsertEvent({
            id: event.ding_id_str,
            device_id: String(camera.id),
            device_name: camera.name,
            kind: event.kind,
            created_at: Math.floor(createdAt),
            duration: null,
          });

          newEventCount++;
        }

        paginationKey = response.meta?.pagination_key;
        if (!paginationKey || response.events.length < 50) break;
      }
    } catch (err: any) {
      spinner.warn(`Failed to sync ${camera.name}: ${err?.message ?? err}`);
    }
  }

  spinner.succeed(
    `Sync complete. ${chalk.bold(newEventCount)} new event(s) recorded across ${cameras.length} camera(s).`
  );

  return newEventCount;
}
