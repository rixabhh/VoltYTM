import { createPlugin } from '@/utils/createPlugin';
import type { PluginConfig } from '@/types/plugin';

type NotificationsConfig = PluginConfig & {
  enabled: boolean;
};

export const notificationsPlugin = createPlugin<NotificationsConfig>({
  id: 'notifications',
  name: 'Native Notifications',
  description: 'Shows a native notification when YouTube Music starts a new track.',
  defaultConfig: {
    enabled: true,
  },
  start(context) {
    if (!context.config.enabled) {
      return;
    }

    let lastKey = '';
    const interval = window.setInterval(() => {
      const title = text(['ytmusic-player-bar .title', '.ytmusic-player-bar .title']);
      const artist = text(['ytmusic-player-bar .byline a', 'ytmusic-player-bar .subtitle a']);
      if (!title || !artist) {
        return;
      }

      const key = `${artist}::${title}`;
      if (key !== lastKey) {
        lastKey = key;
        void context.notify(title, artist);
      }
    }, 3_000);

    return () => window.clearInterval(interval);
  },
});

function text(selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.textContent?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}
