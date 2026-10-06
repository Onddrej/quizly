import { getDatabaseStats } from '../../db/stats';

const UNITS = ['KB', 'MB', 'GB', 'TB'];

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    unit += 1;
  } while (value >= 1024 && unit < UNITS.length - 1);
  return `${value.toFixed(1)} ${UNITS[unit]}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

async function describeStorage(): Promise<string> {
  try {
    const storage = navigator.storage;
    if (!storage?.estimate) return 'unknown';
    const { usage, quota } = await storage.estimate();
    if (usage === undefined || quota === undefined) return 'unknown';
    let text = `${formatBytes(usage)} used of ${formatBytes(quota)}`;
    try {
      text += (await storage.persisted()) ? ', persistent' : ', not persistent';
    } catch {
      // persistence is extra information
    }
    return text;
  } catch {
    return 'unknown';
  }
}

async function describeData(): Promise<string> {
  try {
    const { sets, cards } = await getDatabaseStats();
    return `${plural(sets, 'set')}, ${plural(cards, 'card')}`;
  } catch {
    return 'unavailable';
  }
}

function describeDisplay(): string {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  return standalone ? 'standalone (installed app)' : 'browser tab';
}

/** The facts about this device and install that go at the top of a diagnostics report. Never throws. */
export async function collectEnvironment(): Promise<Array<[string, string]>> {
  const [storage, data] = await Promise.all([describeStorage(), describeData()]);
  return [
    ['Build', `${__APP_VERSION__} (${__BUILD_ID__})`],
    ['Browser', navigator.userAgent],
    ['Display', describeDisplay()],
    ['Online', navigator.onLine ? 'yes' : 'no'],
    ['Storage', storage],
    ['Data', data],
  ];
}
