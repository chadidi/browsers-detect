import { existsSync, readdirSync, readFileSync } from 'fs';
import os from 'os';
import path from 'path';

export type BrowserId =
  | 'arc'
  | 'brave'
  | 'chrome'
  | 'chromium'
  | 'edge'
  | 'firefox'
  | 'firefox-developer-edition'
  | 'safari'
  | 'vivaldi';

export const CHROMIUM_BROWSER_IDS = ['arc', 'brave', 'chrome', 'chromium', 'edge', 'vivaldi'] as const;
export const FIREFOX_BROWSER_IDS = ['firefox', 'firefox-developer-edition'] as const;

export function isChromiumBrowser(browser: BrowserId): boolean {
  return (CHROMIUM_BROWSER_IDS as readonly BrowserId[]).includes(browser);
}

export function isFirefoxBrowser(browser: BrowserId): boolean {
  return (FIREFOX_BROWSER_IDS as readonly BrowserId[]).includes(browser);
}

export interface BrowserProfile {
  /** Stable folder name used by the browser, for example `Default` or `Profile 1`. */
  id: string;
  /** User-facing profile name when the browser stores one. */
  name: string;
  /** Absolute path to the local profile directory. */
  path: string;
  /** Local bookmark files associated with this profile, when known. */
  bookmarkPaths: string[];
}

export interface DetectedBrowser {
  id: BrowserId;
  name: string;
  /** Whether an application executable or local browser data was found. */
  installed: boolean;
  /** Absolute path to the application executable or macOS app bundle, if found. */
  executablePath?: string;
  /** Absolute path to the browser's user-data directory, if known. */
  userDataPath?: string;
  /** Every discovered local browser profile. */
  profiles: BrowserProfile[];
}

export interface DetectOptions {
  /** Override the platform, useful for testing platform-specific discovery. */
  platform?: NodeJS.Platform;
  /** Override the home directory, useful for sandboxed or test discovery. */
  homeDir?: string;
  /** Environment values used for platform-specific profile locations. */
  env?: NodeJS.ProcessEnv;
}

interface BrowserDefinition {
  id: BrowserId;
  name: string;
  kind: 'chromium' | 'firefox' | 'safari';
  dataPath: (platform: NodeJS.Platform, home: string, env: NodeJS.ProcessEnv) => string | undefined;
  executablePaths: (platform: NodeJS.Platform, env: NodeJS.ProcessEnv) => string[];
}

const join = (...segments: string[]) => path.join(...segments);

function chromiumDataPath(
  macSegments: string[],
  windowsSegments: string[],
  linuxDir: string,
): BrowserDefinition['dataPath'] {
  return (platform, home, env) => {
    if (platform === 'darwin') return join(home, 'Library', 'Application Support', ...macSegments);
    if (platform === 'win32') return join(env.LOCALAPPDATA ?? join(home, 'AppData', 'Local'), ...windowsSegments);
    return join(home, '.config', linuxDir);
  };
}

const BROWSERS: BrowserDefinition[] = [
  {
    id: 'chrome', name: 'Google Chrome', kind: 'chromium',
    dataPath: chromiumDataPath(['Google', 'Chrome'], ['Google', 'Chrome', 'User Data'], 'google-chrome'),
    executablePaths: (platform, env) => appPaths(platform, env, 'Google Chrome', 'google-chrome', 'chrome.exe'),
  },
  {
    id: 'chromium', name: 'Chromium', kind: 'chromium',
    dataPath: chromiumDataPath(['Chromium'], ['Chromium', 'User Data'], 'chromium'),
    executablePaths: (platform, env) => appPaths(platform, env, 'Chromium', 'chromium', 'chrome.exe'),
  },
  {
    id: 'edge', name: 'Microsoft Edge', kind: 'chromium',
    dataPath: chromiumDataPath(['Microsoft Edge'], ['Microsoft', 'Edge', 'User Data'], 'microsoft-edge'),
    executablePaths: (platform, env) => appPaths(platform, env, 'Microsoft Edge', 'microsoft-edge', 'msedge.exe'),
  },
  {
    id: 'brave', name: 'Brave', kind: 'chromium',
    dataPath: chromiumDataPath(['BraveSoftware', 'Brave-Browser'], ['BraveSoftware', 'Brave-Browser', 'User Data'], 'BraveSoftware/Brave-Browser'),
    executablePaths: (platform, env) => appPaths(platform, env, 'Brave Browser', 'brave-browser', 'brave.exe'),
  },
  {
    id: 'vivaldi', name: 'Vivaldi', kind: 'chromium',
    dataPath: chromiumDataPath(['Vivaldi'], ['Vivaldi', 'User Data'], 'vivaldi'),
    executablePaths: (platform, env) => appPaths(platform, env, 'Vivaldi', 'vivaldi', 'vivaldi.exe'),
  },
  {
    id: 'arc', name: 'Arc', kind: 'chromium',
    dataPath: chromiumDataPath(['Arc', 'User Data'], ['The Browser Company', 'Arc', 'User Data'], 'arc'),
    executablePaths: (platform, env) => appPaths(platform, env, 'Arc', 'arc', 'Arc.exe'),
  },
  {
    id: 'firefox', name: 'Firefox', kind: 'firefox',
    dataPath: (platform, home, env) => firefoxRoot(platform, home, env, 'Firefox'),
    executablePaths: (platform, env) => appPaths(platform, env, 'Firefox', 'firefox', 'firefox.exe'),
  },
  {
    id: 'firefox-developer-edition', name: 'Firefox Developer Edition', kind: 'firefox',
    dataPath: (platform, home, env) => firefoxRoot(platform, home, env, 'Firefox Developer Edition'),
    executablePaths: (platform, env) => appPaths(platform, env, 'Firefox Developer Edition', 'firefox-developer-edition', 'firefox.exe'),
  },
  {
    id: 'safari', name: 'Safari', kind: 'safari',
    dataPath: (platform, home) => platform === 'darwin' ? join(home, 'Library', 'Safari') : undefined,
    executablePaths: (platform) => platform === 'darwin' ? ['/Applications/Safari.app'] : [],
  },
];

/** Human-readable browser names keyed by stable browser ID. */
export const BROWSER_NAMES: Record<BrowserId, string> = Object.fromEntries(
  BROWSERS.map((browser) => [browser.id, browser.name]),
) as Record<BrowserId, string>;

/** Detects browser installations and local profiles without running external commands. */
export function detectBrowsersSync(options: DetectOptions = {}): DetectedBrowser[] {
  const platform = options.platform ?? process.platform;
  const home = options.homeDir ?? os.homedir();
  const env = options.env ?? process.env;
  return BROWSERS.map((definition) => detectBrowser(definition, platform, home, env)).filter((browser) => browser.installed);
}

/** Detects browser installations and local profiles. */
export async function detectBrowsers(options: DetectOptions = {}): Promise<DetectedBrowser[]> {
  return detectBrowsersSync(options);
}

function detectBrowser(definition: BrowserDefinition, platform: NodeJS.Platform, home: string, env: NodeJS.ProcessEnv): DetectedBrowser {
  const userDataPath = definition.dataPath(platform, home, env);
  const profiles = userDataPath && existsSync(userDataPath)
    ? profilesFor(definition.kind, userDataPath)
    : [];
  const executablePath = definition.executablePaths(platform, env).find(existsSync);
  return {
    id: definition.id,
    name: definition.name,
    installed: Boolean(executablePath || userDataPath && existsSync(userDataPath)),
    ...(executablePath ? { executablePath } : {}),
    ...(userDataPath ? { userDataPath } : {}),
    profiles,
  };
}

function profilesFor(kind: BrowserDefinition['kind'], userDataPath: string): BrowserProfile[] {
  switch (kind) {
    case 'chromium': return chromiumProfiles(userDataPath);
    case 'firefox': return firefoxProfiles(userDataPath);
    case 'safari': return safariProfiles(userDataPath);
  }
}

function chromiumProfiles(userDataPath: string): BrowserProfile[] {
  const localState = readJson(join(userDataPath, 'Local State')) as { profile?: { info_cache?: Record<string, { name?: string }> } } | undefined;
  const info = localState?.profile?.info_cache ?? {};
  const folders = new Set(Object.keys(info));
  for (const entry of safeDirectoryEntries(userDataPath)) {
    if (entry.isDirectory() && (entry.name === 'Default' || /^Profile \d+$/.test(entry.name))) folders.add(entry.name);
  }
  return [...folders].sort().map((id) => {
    const profilePath = join(userDataPath, id);
    const bookmarkPaths = ['Bookmarks', 'AccountBookmarks'].map((file) => join(profilePath, file)).filter(existsSync);
    return { id, name: info[id]?.name ?? (id === 'Default' ? 'Default' : id), path: profilePath, bookmarkPaths };
  });
}

function firefoxProfiles(root: string): BrowserProfile[] {
  const profilesDir = existsSync(join(root, 'Profiles')) ? join(root, 'Profiles') : root;
  const entries = safeDirectoryEntries(profilesDir).filter((entry) => entry.isDirectory());
  return entries.map((entry) => {
    const profilePath = join(profilesDir, entry.name);
    const places = join(profilePath, 'places.sqlite');
    return { id: entry.name, name: entry.name.replace(/^[^.]+\./, ''), path: profilePath, bookmarkPaths: existsSync(places) ? [places] : [] };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function safariProfiles(safariPath: string): BrowserProfile[] {
  const bookmarks = join(safariPath, 'Bookmarks.plist');
  return [{ id: 'default', name: 'Default', path: safariPath, bookmarkPaths: existsSync(bookmarks) ? [bookmarks] : [] }];
}

function readJson(file: string): unknown {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return undefined; }
}

function safeDirectoryEntries(directory: string) {
  try { return readdirSync(directory, { withFileTypes: true }); } catch { return []; }
}

function firefoxRoot(platform: NodeJS.Platform, home: string, env: NodeJS.ProcessEnv, product: string): string {
  if (platform === 'darwin') return join(home, 'Library', 'Application Support', product);
  if (platform === 'win32') return join(env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'Mozilla', product);
  return join(home, '.mozilla', product.toLowerCase().replaceAll(' ', '-'));
}

function appPaths(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, macName: string, linuxName: string, windowsName: string): string[] {
  if (platform === 'darwin') return [`/Applications/${macName}.app`];
  if (platform === 'win32') return [
    join(env.LOCALAPPDATA ?? '', 'Programs', macName, windowsName),
    join(env.PROGRAMFILES ?? 'C:\\Program Files', macName, windowsName),
    join(env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)', macName, windowsName),
  ];
  return [`/usr/bin/${linuxName}`, `/usr/bin/${linuxName}-stable`, `/snap/bin/${linuxName}`];
}
