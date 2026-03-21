import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export const CONFIG_DIR = path.join(os.homedir(), '.ringdown');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
export const TOKEN_FILE = path.join(CONFIG_DIR, 'token.json');
export const DB_FILE = path.join(CONFIG_DIR, 'ringdown.db');
export const THUMBNAILS_DIR = path.join(CONFIG_DIR, 'thumbnails');

export interface Config {
  outputDir: string;
  lookbackDays: number;
  concurrency: number;
}

const DEFAULTS: Config = {
  outputDir: path.join(os.homedir(), 'Videos', 'Ring'),
  lookbackDays: 30,
  concurrency: 2,
};

export function loadConfig(): Config {
  fs.ensureDirSync(CONFIG_DIR);
  if (!fs.existsSync(CONFIG_FILE)) {
    return { ...DEFAULTS };
  }
  const raw = fs.readJsonSync(CONFIG_FILE);
  return { ...DEFAULTS, ...raw };
}

export function saveConfig(config: Partial<Config>): void {
  fs.ensureDirSync(CONFIG_DIR);
  const existing = loadConfig();
  fs.writeJsonSync(CONFIG_FILE, { ...existing, ...config }, { spaces: 2 });
}

export function loadToken(): string | null {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  const data = fs.readJsonSync(TOKEN_FILE);
  return data.refreshToken ?? null;
}

export function saveToken(refreshToken: string): void {
  fs.ensureDirSync(CONFIG_DIR);
  fs.writeJsonSync(TOKEN_FILE, { refreshToken }, { spaces: 2 });
}
