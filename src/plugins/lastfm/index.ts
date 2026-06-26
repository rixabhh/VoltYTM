import { createPlugin } from '@/utils/createPlugin';
import type { CommandStatus } from '@/lib/bridge';
import type { PluginConfig } from '@/types/plugin';

type LastfmConfig = PluginConfig & {
  enabled: boolean;
  apiKey: string;
  apiSecret: string;
  sessionKey: string;
  scrobblePercent: number;
};

interface TrackSnapshot {
  title: string;
  artist: string;
  album?: string;
  durationSeconds?: number;
  elapsedSeconds?: number;
}

export const lastfmPlugin = createPlugin<LastfmConfig>({
  id: 'lastfm',
  name: 'Last.fm',
  description: 'Scrobbles completed tracks through the native Rust Last.fm client.',
  defaultConfig: {
    enabled: false,
    apiKey: '',
    apiSecret: '',
    sessionKey: '',
    scrobblePercent: 50,
  },
  start(context) {
    if (!context.config.enabled) {
      return;
    }

    let lastKey = '';
    let scrobbledKey = '';

    const interval = window.setInterval(async () => {
      const track = readTrackSnapshot();
      if (!track) {
        return;
      }

      const key = `${track.artist}::${track.title}`;
      if (key !== lastKey) {
        lastKey = key;
        scrobbledKey = '';
      }

      const duration = track.durationSeconds ?? 0;
      const elapsed = track.elapsedSeconds ?? 0;
      const progress = duration > 0 ? (elapsed / duration) * 100 : 0;
      if (key === scrobbledKey || progress < context.config.scrobblePercent) {
        return;
      }

      const response = await context.invoke<CommandStatus>('lastfm_scrobble', {
        payload: {
          apiKey: context.config.apiKey,
          apiSecret: context.config.apiSecret,
          sessionKey: context.config.sessionKey,
          artist: track.artist,
          title: track.title,
          album: track.album,
          durationSeconds: duration || undefined,
          timestamp: Math.floor(Date.now() / 1000),
        },
      });

      if (response.ok) {
        scrobbledKey = key;
      }
    }, 5_000);

    return () => window.clearInterval(interval);
  },
});

function readTrackSnapshot(): TrackSnapshot | null {
  const title = readText([
    'ytmusic-player-bar .title',
    '.ytmusic-player-bar .title',
    '.content-info-wrapper .title',
  ]);
  const artist = readText([
    'ytmusic-player-bar .byline a',
    'ytmusic-player-bar .subtitle a',
    '.content-info-wrapper .byline a',
  ]);

  if (!title || !artist) {
    return null;
  }

  return {
    title,
    artist,
    album: readText(['ytmusic-player-bar .byline a:nth-of-type(2)', '.subtitle a:nth-of-type(2)']),
    durationSeconds: parseClock(readText(['.time-info .duration', 'span.duration'])),
    elapsedSeconds: parseClock(readText(['.time-info .time-info-current', 'span.time-info-current'])),
  };
}

function readText(selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const text = document.querySelector(selector)?.textContent?.trim();
    if (text) {
      return text;
    }
  }
  return undefined;
}

function parseClock(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parts = value
    .split(':')
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return undefined;
}
