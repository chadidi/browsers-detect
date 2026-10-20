# browsers-detect

Local Node.js package for discovering desktop browsers, their local profiles, and the browser registered as the operating-system default.

```ts
import { detectBrowsers, detectBrowsersSync } from 'browsers-detect';

const browsers = await detectBrowsers();
const chrome = browsers.find((browser) => browser.id === 'chrome');
console.log(chrome?.profiles);

// Filesystem-only detection when the system default is not needed.
const installedBrowsers = detectBrowsersSync();
```

`detectBrowsers()` uses the host operating system to resolve the default browser. It returns browser records even when no executable can be found, provided a supported browser has local profile data. This is useful for importing local bookmarks.

Supported browser families are Chrome, Chromium, Microsoft Edge, Brave, Vivaldi, Arc, Firefox, Firefox Developer Edition, and Safari (macOS).
