import { discordPlugin } from '@/plugins/discord';
import { lastfmPlugin } from '@/plugins/lastfm';
import { notificationsPlugin } from '@/plugins/notifications';
import { skipSilencePlugin } from '@/plugins/skip-silence';
import { sponsorBlockPlugin } from '@/plugins/sponsorblock';
import type { Plugin } from '@/types/plugin';

export const pluginRegistry = [
  lastfmPlugin,
  discordPlugin,
  sponsorBlockPlugin,
  skipSilencePlugin,
  notificationsPlugin,
] satisfies Plugin[];
