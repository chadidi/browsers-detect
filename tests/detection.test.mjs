import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { detectBrowsersSync } from '../dist/index.js';

test('discovers Chromium profiles and their bookmark files', async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'browsers-detect-'));
  const userData = path.join(home, '.config', 'google-chrome');
  await mkdir(path.join(userData, 'Default'), { recursive: true });
  await mkdir(path.join(userData, 'Profile 1'), { recursive: true });
  await writeFile(path.join(userData, 'Default', 'Bookmarks'), '{}');
  await writeFile(path.join(userData, 'Profile 1', 'AccountBookmarks'), '{}');
  await writeFile(path.join(userData, 'Local State'), JSON.stringify({
    profile: { last_used: 'Profile 1', info_cache: { Default: { name: 'Personal' }, 'Profile 1': { name: 'Work' } } },
  }));

  const chrome = detectBrowsersSync({ platform: 'linux', homeDir: home, env: {} }).find((browser) => browser.id === 'chrome');
  assert.ok(chrome);
  assert.equal(chrome.profiles.length, 2);
  assert.deepEqual(chrome.profiles.map((profile) => profile.name), ['Personal', 'Work']);
  assert.equal(chrome.profiles.find((profile) => profile.id === 'Default')?.bookmarkPaths.length, 1);
  assert.equal('isDefault' in chrome, false);
  assert.equal(chrome.profiles.some((profile) => 'isDefault' in profile), false);
});
