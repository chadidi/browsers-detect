# browsers-detect

Local Node.js package for discovering desktop browsers and their local profiles without executing shell commands.

```ts
import { detectBrowsers, detectBrowsersSync } from 'browsers-detect';

const browsers = await detectBrowsers();
const chrome = browsers.find((browser) => browser.id === 'chrome');
console.log(chrome?.profiles);

// Filesystem-only detection when the system default is not needed.
const installedBrowsers = detectBrowsersSync();
```

`detectBrowsers()` and `detectBrowsersSync()` perform filesystem-only discovery. Browser records are returned when an executable or local profile data is found, which is useful for importing local bookmarks.

Supported browser families are Chrome, Chromium, Microsoft Edge, Brave, Vivaldi, Arc, Firefox, Firefox Developer Edition, and Safari (macOS).
