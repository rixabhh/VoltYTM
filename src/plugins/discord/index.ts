import { createPlugin } from '@/utils/createPlugin';
import type { PluginConfig } from '@/types/plugin';

type DiscordConfig = PluginConfig & {
  enabled: boolean;
  clientId: string;
  showAlbum: boolean;
  showTimestamp: boolean;
};

export const discordPlugin = createPlugin<DiscordConfig>({
  id: 'discord',
  name: 'Discord Rich Presence',
  description: 'Publishes current playback to Discord through the native IPC transport.',
  defaultConfig: {
    enabled: false,
    clientId: '',
    showAlbum: true,
    showTimestamp: true,
  },
  start(context) {
    if (!context.config.enabled) {
      return;
    }

    let lastKey = '';

    const interval = window.setInterval(async () => {
      const title = text(['ytmusic-player-bar .title', '.ytmusic-player-bar .title']);
      const artist = text(['ytmusic-player-bar .byline a', 'ytmusic-player-bar .subtitle a']);
      if (!title || !artist) {
        return;
      }

      const album = context.config.showAlbum
        ? text(['ytmusic-player-bar .byline a:nth-of-type(2)', '.subtitle a:nth-of-type(2)'])
        : undefined;
      const coverUrl = image(['ytmusic-player-bar img.image', '.thumbnail-image-wrapper img']);
      const key = `${artist}::${title}::${album ?? ''}`;

      if (key === lastKey) {
        return;
      }

      lastKey = key;
      await context.invoke('discord_update_presence', {
        payload: {
          clientId: context.config.clientId,
          title,
          artist,
          album,
          coverUrl,
          elapsedSeconds: context.config.showTimestamp ? 0 : undefined,
        },
      });
    }, 15_000);

    return () => {
      window.clearInterval(interval);
      void context.invoke('discord_clear_presence', { clientId: context.config.clientId });
    };
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

function image(selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const src = (document.querySelector(selector) as HTMLImageElement | null)?.src;
    if (src) {
      return src;
    }
  }
  return undefined;
}
