import { createPlugin } from '@/utils/createPlugin';
import type { PluginConfig } from '@/types/plugin';

type SkipSilenceConfig = PluginConfig & {
  enabled: boolean;
  threshold: number;
  playbackRate: number;
};

export const skipSilencePlugin = createPlugin<SkipSilenceConfig>({
  id: 'skipSilence',
  name: 'Skip Silence',
  description: 'Speeds through low-amplitude audio sections using Web Audio analysis.',
  defaultConfig: {
    enabled: false,
    threshold: 0.01,
    playbackRate: 2,
  },
  start(context) {
    if (!context.config.enabled) {
      return;
    }

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    const samples = new Uint8Array(analyser.fftSize);
    let attachedVideo: HTMLVideoElement | null = null;

    const interval = window.setInterval(() => {
      const video = document.querySelector('video');
      if (!video) {
        return;
      }

      if (video !== attachedVideo) {
        attachedVideo = video;
        const source = audioContext.createMediaElementSource(video);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
      }

      analyser.getByteTimeDomainData(samples);
      const rms = Math.sqrt(
        samples.reduce((sum, sample) => {
          const normalized = (sample - 128) / 128;
          return sum + normalized * normalized;
        }, 0) / samples.length,
      );

      video.playbackRate =
        !video.paused && rms < context.config.threshold ? context.config.playbackRate : 1;
    }, 350);

    return () => {
      window.clearInterval(interval);
      if (attachedVideo) {
        attachedVideo.playbackRate = 1;
      }
      void audioContext.close();
    };
  },
});
