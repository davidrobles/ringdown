import { RingApi } from 'ring-client-api';
import { RingRestClient } from 'ring-client-api/rest-client';
import readline from 'readline';
import chalk from 'chalk';
import { saveToken, loadToken, saveConfig, loadConfig } from './config.js';

function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (hidden) {
      process.stdout.write(question);
      let input = '';
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', function handler(char) {
        const c = char.toString();
        if (c === '\n' || c === '\r' || c === '\u0003') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', handler);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (c === '\u007f') {
          input = input.slice(0, -1);
        } else {
          input += c;
        }
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

export async function runAuth(): Promise<void> {
  console.log(chalk.bold('\nringdown — Ring account setup\n'));

  const existing = loadToken();
  if (existing) {
    const overwrite = await prompt('A saved token already exists. Re-authenticate? [y/N] ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log(chalk.green('Using existing token. Run `ringdown status` to verify.'));
      return;
    }
  }

  const email = await prompt('Ring email: ');
  const password = await prompt('Ring password: ', true);

  // RingRestClient handles email/password auth (and 2FA).
  // RingApi itself only accepts a refreshToken.
  const restClient = new RingRestClient({ email, password });

  console.log(chalk.dim('\nConnecting to Ring...'));

  try {
    const auth = await restClient.getAuth();
    saveToken(auth.refresh_token);
    console.log(chalk.green('\nAuthenticated successfully. Token saved to ~/.ringdown/token.json'));
  } catch (err: any) {
    // Ring signals 2FA required via promptFor2fa
    if (restClient.promptFor2fa) {
      const twoFactorCode = await prompt(`\n${restClient.promptFor2fa}: `);
      const auth = await restClient.getAuth(twoFactorCode);
      saveToken(auth.refresh_token);
      console.log(chalk.green('\nAuthenticated successfully. Token saved to ~/.ringdown/token.json'));
    } else {
      console.error(chalk.red('\nAuthentication failed:'), err?.message ?? err);
      process.exit(1);
    }
  }

  // Subscribe to token refresh so we always save the latest token
  restClient.onRefreshTokenUpdated.subscribe(({ newRefreshToken }: { newRefreshToken: string }) => {
    saveToken(newRefreshToken);
  });

  // Optionally configure output directory
  const config = loadConfig();
  const outputDir = await prompt(`\nVideo output directory [${config.outputDir}]: `);
  if (outputDir) {
    saveConfig({ outputDir });
    console.log(chalk.dim(`Output directory set to: ${outputDir}`));
  }

  console.log(chalk.bold('\nSetup complete. Run `ringdown pull` to download your videos.\n'));
}

export async function getRingApi(): Promise<RingApi> {
  const refreshToken = loadToken();
  if (!refreshToken) {
    console.error(chalk.red('Not authenticated. Run `ringdown auth` first.'));
    process.exit(1);
  }

  const api = new RingApi({ refreshToken });

  // Keep the saved token fresh on every run
  api.onRefreshTokenUpdated.subscribe(({ newRefreshToken }) => {
    saveToken(newRefreshToken);
  });

  return api;
}
