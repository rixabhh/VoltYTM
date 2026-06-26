import { invoke as tauriInvoke } from '@tauri-apps/api/core';

import type { PluginConfigValue } from '@/types/plugin';

export interface AppConfig {
  plugins: Record<string, Record<string, PluginConfigValue>>;
  adblock: {
    enabled: boolean;
    blockTelemetry: boolean;
    preserveAudioStreams: boolean;
    useNativeProxy: boolean;
    useRendererInterceptors: boolean;
  };
}

export interface CommandStatus {
  ok: boolean;
  message: string;
}

export interface ProxyStatus {
  enabled: boolean;
  url: string;
  allowedRequests: number;
  blockedRequests: number;
  failedRequests: number;
}

export interface LastfmScrobblePayload {
  apiKey: string;
  apiSecret: string;
  sessionKey: string;
  artist: string;
  title: string;
  album?: string;
  durationSeconds?: number;
  timestamp?: number;
}

export interface DiscordPresencePayload {
  clientId: string;
  title: string;
  artist: string;
  album?: string;
  elapsedSeconds?: number;
  durationSeconds?: number;
  coverUrl?: string;
}

export const bridge = {
  invoke: <T>(command: string, payload: Record<string, unknown> = {}) =>
    tauriInvoke<T>(command, payload),

  getConfig: () => tauriInvoke<AppConfig>('get_config'),

  setConfig: (path: string, value: PluginConfigValue) =>
    tauriInvoke<AppConfig>('set_config', { path, value }),

  getAppVersion: () => tauriInvoke<string>('get_app_version'),

  getAdblockProxyStatus: () => tauriInvoke<ProxyStatus>('get_adblock_proxy_status'),

  classifyNetworkUrl: (url: string) => tauriInvoke('classify_network_url', { url }),

  persistCookies: () => tauriInvoke('persist_cookies'),

  showNotification: (title: string, body: string) =>
    tauriInvoke<void>('show_notification', { title, body }),

  lastfmScrobble: (payload: LastfmScrobblePayload) =>
    tauriInvoke<CommandStatus>('lastfm_scrobble', { payload }),

  discordUpdatePresence: (payload: DiscordPresencePayload) =>
    tauriInvoke<CommandStatus>('discord_update_presence', { payload }),

  discordClearPresence: (clientId: string) =>
    tauriInvoke<CommandStatus>('discord_clear_presence', { clientId }),

  applyTheme: (css: string) => tauriInvoke<void>('apply_theme', { css }),

  removeTheme: () => tauriInvoke<void>('remove_theme'),

  listThemes: () => tauriInvoke<string[]>('list_themes'),

  getThemeCss: (name: string) => tauriInvoke<string>('get_theme_css', { name }),

  fetchLyrics: (payload: { artist: string; track: string; album?: string; duration?: number }) =>
    tauriInvoke<{ syncedLyrics: string | null; plainLyrics: string | null }>('fetch_lyrics', { payload }),

  downloadTrack: (payload: {
    videoId: string;
    title: string;
    artist: string;
    album?: string;
    format?: string;
    quality?: string;
    outputDir?: string;
    embedArt?: boolean;
    filenamePattern?: string;
  }) => tauriInvoke<string>('download_track', { payload }),

  getAutostart: () => tauriInvoke<{ enabled: boolean }>('get_autostart_status'),

  setAutostart: (enabled: boolean) =>
    tauriInvoke<{ enabled: boolean }>('set_autostart', { enabled }),
};
