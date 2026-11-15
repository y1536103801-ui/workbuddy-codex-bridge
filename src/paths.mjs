import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
export const APP_NAME = 'WorkBuddy Codex Bridge';
export const VERSION = '0.1.0';
export function bridgeHome() { return resolve(process.env.WBCB_HOME || join(homedir(), 'Library', 'Application Support', APP_NAME)); }
export function codexHome() { return resolve(process.env.WBCB_CODEX_HOME || process.env.CODEX_HOME || join(homedir(), '.codex')); }
