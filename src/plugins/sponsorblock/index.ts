import { createPlugin } from '@/utils/createPlugin';
import type { PluginConfig } from '@/types/plugin';

type SponsorBlockConfig = PluginConfig & {
  enabled: boolean;
  categories: string[];
};

interface Segment {
  segment: [number, number];
  category: string;
}

export const sponsorBlockPlugin = createPlugin<SponsorBlockConfig>({
  id: 'sponsorblock',
  name: 'SponsorBlock',
  description: 'Skips community-reported sponsor and intro/outro segments during playback.',
  defaultConfig: {
    enabled: true,
    categories: ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro'],
  },
  start(context) {
    if (!context.config.enabled) {
      return;
    }

    let currentVideoId = '';
    let segments: Segment[] = [];

    const interval = window.setInterval(async () => {
      const video = document.querySelector('video');
      const videoId = new URLSearchParams(window.location.search).get('v') ?? '';
      if (!video || !videoId) {
        return;
      }

      if (videoId !== currentVideoId) {
        currentVideoId = videoId;
        segments = await fetchSegments(videoId, context.config.categories);
      }

      const match = segments.find(
        ({ segment }) => video.currentTime >= segment[0] && video.currentTime < segment[1],
      );
      if (match) {
        video.currentTime = Math.min(match.segment[1] + 0.05, video.duration || match.segment[1]);
      }
    }, 1_000);

    return () => window.clearInterval(interval);
  },
});

async function fetchSegments(videoId: string, categories: string[]): Promise<Segment[]> {
  const params = new URLSearchParams({
    videoID: videoId,
    categories: JSON.stringify(categories),
  });

  const response = await fetch(`https://sponsor.ajay.app/api/skipSegments?${params}`);
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`SponsorBlock request failed with ${response.status}`);
  }
  return (await response.json()) as Segment[];
}
