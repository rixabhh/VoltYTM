(function () {
  'use strict';

  const AD_HOST_FRAGMENTS = [
    'doubleclick.net',
    'googleadservices.com',
    'googlesyndication.com',
    'pagead2.googlesyndication.com',
  ];

  const TRACKING_HOST_FRAGMENTS = [
    'google-analytics.com',
    'googletagmanager.com',
    'stats.g.doubleclick.net',
  ];

  const AD_PATH_FRAGMENTS = [
    '/api/stats/ads',
    '/get_midroll_info',
    '/pagead/',
    '/ptracking',
    '/youtubei/v1/log_interaction',
  ];

  const TELEMETRY_PATH_FRAGMENTS = [
    '/api/stats/qoe',
    '/api/stats/watchtime',
    '/generate_204',
    '/youtubei/v1/log_event',
  ];

  const invoke = (channel, payload = {}) => {
    if (!window.__TAURI_INTERNALS__?.invoke) {
      return Promise.reject(new Error('Tauri IPC is not available'));
    }

    return window.__TAURI_INTERNALS__.invoke(channel, payload);
  };

  const legacyInvoke = (channel, ...args) => invoke(channel, { args });

  const resolveUrl = (input) => {
    const raw =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : typeof Request !== 'undefined' && input instanceof Request
            ? input.url
            : input?.url;

    if (!raw) {
      return null;
    }

    try {
      return new URL(raw, window.location.href);
    } catch {
      return null;
    }
  };

  const classifyUrl = (input) => {
    const url = resolveUrl(input);
    if (!url) {
      return { action: 'allow' };
    }

    const host = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();

    if (host.includes('googlevideo.com') && path.includes('/videoplayback')) {
      return { action: 'allow' };
    }

    if (AD_HOST_FRAGMENTS.some((fragment) => host.includes(fragment))) {
      return { action: 'block', reason: 'adServingHost' };
    }

    if (TRACKING_HOST_FRAGMENTS.some((fragment) => host.includes(fragment))) {
      return { action: 'block', reason: 'trackingHost' };
    }

    if (AD_PATH_FRAGMENTS.some((fragment) => path.includes(fragment))) {
      return { action: 'block', reason: 'adPath' };
    }

    if (TELEMETRY_PATH_FRAGMENTS.some((fragment) => path.includes(fragment))) {
      return { action: 'block', reason: 'telemetryPath' };
    }

    return { action: 'allow' };
  };

  const shouldBlock = (input) => classifyUrl(input).action === 'block';

  // Accessibility: global styles
  const A11Y_STYLE_ID = '__VOLTYTM_A11Y__';
  const a11yStyle = document.createElement('style');
  a11yStyle.id = A11Y_STYLE_ID;
  a11yStyle.textContent = `
    /* Focus ring for all VoltYTM buttons */
    #voltytm-pip-btn:focus-visible,
    #voltytm-dl-btn:focus-visible,
    #voltytm-sleep-btn:focus-visible,
    #voltytm-adev-btn:focus-visible,
    #voltytm-speed-btn:focus-visible,
    #voltytm-mini-btn:focus-visible,
    #voltytm-nav button:focus-visible {
      outline: 2px solid #4fd1b3;
      outline-offset: 2px;
    }

    /* Reduced motion: disable animations */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }

    /* High contrast mode */
    @media (prefers-contrast: high) {
      #voltytm-pip-btn,
      #voltytm-dl-btn,
      #voltytm-sleep-btn,
      #voltytm-adev-btn,
      #voltytm-speed-btn,
      #voltytm-mini-btn,
      #voltytm-nav button {
        border-width: 2px !important;
        border-color: white !important;
      }
    }
  `;
  document.head.appendChild(a11yStyle);

  // Escape key: close any open panel
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('#voltytm-speed-panel, #voltytm-sleep-menu, #voltytm-adev-menu, #voltytm-dl-dialog, #voltytm-dl-overlay').forEach((el) => el.remove());
    }
  });

  // Ctrl+K: focus search bar
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.querySelector('input#input, input[placeholder*="Search"], input[aria-label*="Search"]');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  });

  window.__APP__ = {
    name: 'VoltYTM',
    version: '1.0.0',
    platform: navigator.platform,
  };

  window.__VOLTYTM__ = {
    invoke,
    adblock: {
      classify: classifyUrl,
      classifyNative: (url) => invoke('classify_network_url', { url }),
      shouldBlock,
    },
  };

  window.voltYtm = {
    ipc: {
      invoke: legacyInvoke,
      send: (channel, ...args) => {
        void legacyInvoke(channel, ...args);
      },
      on: (channel, callback) => {
        return window.__TAURI__?.event?.listen(channel, (event) => callback(event.payload));
      },
      once: (channel, callback) => {
        return window.__TAURI__?.event?.once(channel, (event) => callback(event.payload));
      },
    },
    platform: {
      dev: () => false,
      linux: () => navigator.userAgent.includes('Linux'),
      macOS: () => navigator.userAgent.includes('Macintosh'),
      windows: () => navigator.userAgent.includes('Windows'),
    },
  };

  window.voltYtmPlatform = {
    dev: () => false,
    linux: () => navigator.userAgent.includes('Linux'),
    macOS: () => navigator.userAgent.includes('Macintosh'),
    windows: () => navigator.userAgent.includes('Windows'),
  };

  if (typeof window.fetch === 'function') {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (shouldBlock(input)) {
        return Promise.resolve(
          new Response('', {
            status: 204,
            statusText: 'Blocked by VoltYTM',
          }),
        );
      }
      return nativeFetch(input, init);
    };
  }

  if (typeof XMLHttpRequest !== 'undefined') {
    const nativeOpen = XMLHttpRequest.prototype.open;
    const nativeSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this.__voltytmBlocked = shouldBlock(url);
      if (this.__voltytmBlocked) {
        return nativeOpen.call(this, method, 'data:text/plain,', ...rest);
      }
      return nativeOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (body) {
      if (this.__voltytmBlocked) {
        return nativeSend.call(this, null);
      }
      return nativeSend.call(this, body);
    };
  }

  if (typeof navigator.sendBeacon === 'function') {
    const nativeSendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      if (shouldBlock(url)) {
        return true;
      }
      return nativeSendBeacon(url, data);
    };
  }

  const clickSkipButtons = () => {
    for (const selector of [
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-modern',
      '.ytp-ad-skip-button-container button',
      'button[aria-label*="Skip"]',
    ]) {
      const button = document.querySelector(selector);
      if (button instanceof HTMLElement) {
        button.click();
      }
    }
  };

  const readText = (selectors) => {
    for (const selector of selectors) {
      const text = document.querySelector(selector)?.textContent?.trim();
      if (text) return text;
    }
    return undefined;
  };

  // Performance: debounce utility
  const debounce = (fn, ms) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  };

  // Performance: cached track snapshot
  let _trackCache = null;
  let _trackCacheTime = 0;
  const readTrackSnapshot = () => {
    const now = Date.now();
    if (_trackCache && now - _trackCacheTime < 1000) return _trackCache;

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
    if (!title || !artist) return null;
    if (!title || !artist) {
      _trackCache = null;
      return null;
    }

    _trackCache = {
      title,
      artist,
      album: readText([
        'ytmusic-player-bar .byline a:nth-of-type(2)',
        '.subtitle a:nth-of-type(2)',
      ]),
    };
    _trackCacheTime = now;
    return _trackCache;
  };

  // Toolbar: single floating bar for all VoltYTM controls
  const TOOLBAR_ID = 'voltytm-toolbar';
  const ensureToolbar = () => {
    let bar = document.getElementById(TOOLBAR_ID);
    if (bar) return bar;

    const style = document.createElement('style');
    style.id = 'voltytm-toolbar-style';
    style.textContent = `
      #${TOOLBAR_ID} {
        position: fixed;
        top: 12px;
        right: 12px;
        display: flex;
        gap: 2px;
        z-index: 99990;
        background: rgba(20,22,25,0.85);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        padding: 3px;
        backdrop-filter: blur(12px);
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        font-family: system-ui, -apple-system, sans-serif;
        transition: opacity 0.3s;
      }
      #${TOOLBAR_ID}:empty { display: none; }
      #${TOOLBAR_ID} button {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        background: transparent;
        border: none;
        color: #ccc;
        font-size: 15px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
        position: relative;
      }
      #${TOOLBAR_ID} button:hover {
        background: rgba(255,255,255,0.1);
        color: #fff;
      }
      #${TOOLBAR_ID} button.active {
        background: rgba(79,209,179,0.2);
        color: #4fd1b3;
      }
      #${TOOLBAR_ID} button:focus-visible {
        outline: 2px solid #4fd1b3;
        outline-offset: 1px;
      }
      #${TOOLBAR_ID} .vt-sep {
        width: 1px;
        height: 20px;
        background: rgba(255,255,255,0.1);
        margin: 7px 2px;
      }
      #${TOOLBAR_ID} .vt-badge {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #4fd1b3;
        display: none;
      }
      #${TOOLBAR_ID} button.active .vt-badge { display: block; }
      .vt-panel {
        position: fixed;
        top: 56px;
        right: 12px;
        background: rgba(20,22,25,0.95);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        padding: 12px;
        z-index: 99991;
        backdrop-filter: blur(16px);
        box-shadow: 0 8px 30px rgba(0,0,0,0.5);
        font-family: system-ui, sans-serif;
        color: #e1e1e1;
        font-size: 13px;
        display: none;
        min-width: 180px;
      }
      .vt-panel.visible { display: block; }
      .vt-panel h4 {
        margin: 0 0 8px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: #888;
      }
      .vt-toast {
        position: fixed;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.88);
        color: #fff;
        padding: 8px 18px;
        border-radius: 8px;
        font-size: 13px;
        font-family: system-ui, sans-serif;
        z-index: 99999;
        border: 1px solid rgba(255,255,255,0.1);
        animation: vtToast 2.5s forwards;
        pointer-events: none;
      }
      @keyframes vtToast {
        0% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
        10% { opacity: 1; transform: translateX(-50%) translateY(0); }
        75% { opacity: 1; }
        100% { opacity: 0; transform: translateX(-50%) translateY(-6px); }
      }
    `;
    document.head.appendChild(style);

    bar = document.createElement('div');
    bar.id = TOOLBAR_ID;
    document.body.appendChild(bar);
    return bar;
  };

  const addToolbarButton = (id, icon, title, onClick) => {
    const bar = ensureToolbar();
    const btn = document.createElement('button');
    btn.id = `vt-tb-${id}`;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.innerHTML = icon;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick(btn);
    });
    bar.appendChild(btn);
    return btn;
  };

  const addToolbarSep = () => {
    const bar = ensureToolbar();
    const sep = document.createElement('div');
    sep.className = 'vt-sep';
    bar.appendChild(sep);
  };

  const showPanel = (panelId) => {
    document.querySelectorAll('.vt-panel').forEach((p) => {
      if (p.id !== panelId) p.classList.remove('visible');
    });
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.toggle('visible');
  };

  const hideAllPanels = () => {
    document.querySelectorAll('.vt-panel').forEach((p) => p.classList.remove('visible'));
  };

  const showToast = (msg) => {
    const t = document.createElement('div');
    t.className = 'vt-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  };

  document.addEventListener('click', (e) => {
    if (!e.target.closest(`#${TOOLBAR_ID}`) && !e.target.closest('.vt-panel')) {
      hideAllPanels();
    }
  });

  const rendererPlugins = {
    lastfm: {
      start(config) {
        if (!config.enabled || !config.sessionKey) return;
        let lastKey = '';
        let scrobbledKey = '';
        const interval = setInterval(async () => {
          const track = readTrackSnapshot();
          if (!track) return;
          const key = `${track.artist}::${track.title}`;
          if (key !== lastKey) {
            lastKey = key;
            scrobbledKey = '';
          }
          if (key === scrobbledKey) return;
          const video = document.querySelector('video');
          if (!video || video.duration <= 0) return;
          const progress = (video.currentTime / video.duration) * 100;
          if (progress < (config.scrobblePercent || 50)) return;
          try {
            await invoke('lastfm_scrobble', {
              payload: {
                apiKey: config.apiKey,
                apiSecret: config.apiSecret,
                sessionKey: config.sessionKey,
                artist: track.artist,
                title: track.title,
                album: track.album,
                timestamp: Math.floor(Date.now() / 1000),
              },
            });
            scrobbledKey = key;
          } catch (e) {
            console.error('[VoltYTM] Last.fm scrobble failed:', e);
          }
        }, 5_000);
        return () => clearInterval(interval);
      },
    },

    discord: {
      start(config) {
        if (!config.enabled || !config.clientId) return;
        let lastKey = '';
        const interval = setInterval(async () => {
          const track = readTrackSnapshot();
          if (!track) return;
          const key = `${track.artist}::${track.title}`;
          if (key === lastKey) return;
          lastKey = key;
          const img = document.querySelector(
            'ytmusic-player-bar img.image, .thumbnail-image-wrapper img',
          );
          const coverUrl = img?.src;
          try {
            await invoke('discord_update_presence', {
              payload: {
                clientId: config.clientId,
                title: track.title,
                artist: track.artist,
                album: track.album,
                coverUrl,
              },
            });
          } catch (e) {
            console.error('[VoltYTM] Discord presence failed:', e);
          }
        }, 15_000);
        return () => {
          clearInterval(interval);
          invoke('discord_clear_presence', { clientId: config.clientId }).catch(() => {});
        };
      },
    },

    sponsorblock: {
      start(config) {
        if (!config.enabled) return;
        let currentVideoId = '';
        let segments = [];
        const fetchSegments = async (videoId, categories) => {
          const params = new URLSearchParams({
            videoID: videoId,
            categories: JSON.stringify(categories),
          });
          try {
            const res = await fetch(
              `https://sponsor.ajay.app/api/skipSegments?${params}`,
            );
            if (res.status === 404) return [];
            if (!res.ok) return [];
            return await res.json();
          } catch {
            return [];
          }
        };
        const interval = setInterval(async () => {
          const video = document.querySelector('video');
          const videoId = new URLSearchParams(window.location.search).get('v') || '';
          if (!video || !videoId) return;
          if (videoId !== currentVideoId) {
            currentVideoId = videoId;
            segments = await fetchSegments(videoId, config.categories || [
              'sponsor', 'selfpromo', 'interaction', 'intro', 'outro',
            ]);
          }
          const match = segments.find(
            (s) => video.currentTime >= s.segment[0] && video.currentTime < s.segment[1],
          );
          if (match) {
            video.currentTime = Math.min(
              match.segment[1] + 0.05,
              video.duration || match.segment[1],
            );
          }
        }, 1_000);
        return () => clearInterval(interval);
      },
    },

    notifications: {
      start(config) {
        if (!config.enabled) return;
        let lastKey = '';
        const interval = setInterval(() => {
          const track = readTrackSnapshot();
          if (!track) return;
          const key = `${track.artist}::${track.title}`;
          if (key !== lastKey) {
            lastKey = key;
            invoke('show_notification', {
              title: 'Now Playing',
              body: `${track.title} \u2014 ${track.artist}`,
            }).catch(() => {});
          }
        }, 3_000);
        return () => clearInterval(interval);
      },
    },

    skipSilence: {
      start(config) {
        if (!config.enabled) return;
        let audioCtx = null;
        let analyser = null;
        let attachedVideo = null;
        let samples = null;

        const interval = setInterval(() => {
          const video = document.querySelector('video');
          if (!video) return;

          if (video !== attachedVideo) {
            try {
              if (!audioCtx) audioCtx = new AudioContext();
              analyser = audioCtx.createAnalyser();
              analyser.fftSize = 512;
              samples = new Uint8Array(analyser.fftSize);
              const source = audioCtx.createMediaElementSource(video);
              source.connect(analyser);
              analyser.connect(audioCtx.destination);
              attachedVideo = video;
            } catch {
              return;
            }
          }

          if (!analyser || !samples) return;
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (let i = 0; i < samples.length; i++) {
            const normalized = (samples[i] - 128) / 128;
            sum += normalized * normalized;
          }
          const rms = Math.sqrt(sum / samples.length);

          if (!video.paused && rms < (config.threshold || 0.01)) {
            video.playbackRate = config.playbackRate || 2;
          } else if (video.playbackRate !== 1) {
            video.playbackRate = 1;
          }
        }, 350);

        return () => {
          clearInterval(interval);
          if (attachedVideo) attachedVideo.playbackRate = 1;
          if (audioCtx) audioCtx.close().catch(() => {});
        };
      },
    },

    syncedLyrics: {
      start(config) {
        if (!config.enabled) return;

        const STYLE_ID = '__VOLTYTM_LYRICS__';
        const PANEL_ID = 'voltytm-lyrics-panel';

        const injectStyles = () => {
          if (document.getElementById(STYLE_ID)) return;
          const style = document.createElement('style');
          style.id = STYLE_ID;
          style.textContent = `
            #${PANEL_ID} {
              position: fixed;
              top: 80px;
              right: 20px;
              width: 320px;
              max-height: 50vh;
              overflow-y: auto;
              background: rgba(0,0,0,0.85);
              border-radius: 12px;
              padding: 16px;
              z-index: 9999;
              font-family: 'YouTube Sans', sans-serif;
              color: #fff;
              font-size: 15px;
              line-height: 1.8;
              backdrop-filter: blur(10px);
              border: 1px solid rgba(255,255,255,0.1);
              transition: opacity 0.3s;
              scrollbar-width: thin;
              scrollbar-color: rgba(255,255,255,0.3) transparent;
            }
            #${PANEL_ID}:empty { display: none; }
            #${PANEL_ID} .lyric-line {
              padding: 2px 8px;
              border-radius: 6px;
              transition: all 0.3s ease;
              cursor: pointer;
              opacity: 0.4;
            }
            #${PANEL_ID} .lyric-line.active {
              opacity: 1;
              font-size: 17px;
              font-weight: 600;
              color: #ff0000;
              background: rgba(255,255,255,0.05);
            }
            #${PANEL_ID} .lyric-line.past {
              opacity: 0.5;
            }
            #${PANEL_ID} .lyrics-header {
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: #999;
              margin-bottom: 12px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            #${PANEL_ID} .lyrics-close {
              background: none;
              border: none;
              color: #999;
              cursor: pointer;
              font-size: 16px;
              padding: 2px 6px;
              border-radius: 4px;
            }
            #${PANEL_ID} .lyrics-close:hover { background: rgba(255,255,255,0.1); }
          `;
          document.head.appendChild(style);
        };

        const createPanel = () => {
          let panel = document.getElementById(PANEL_ID);
          if (!panel) {
            panel = document.createElement('div');
            panel.id = PANEL_ID;
            document.body.appendChild(panel);
          }
          return panel;
        };

        const parseLRC = (lrc) => {
          const lines = [];
          const regex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)$/;
          for (const line of lrc.split('\n')) {
            const match = line.match(regex);
            if (match) {
              const min = parseInt(match[1], 10);
              const sec = parseInt(match[2], 10);
              const ms = parseInt(match[3].padEnd(3, '0'), 10);
              const time = min * 60 + sec + ms / 1000;
              const text = match[4].trim();
              if (text) lines.push({ time, text });
            }
          }
          return lines;
        };

        let currentTrackKey = '';
        let lyricsCache = '';

        const fetchAndDisplay = async (track, artist, video) => {
          const key = `${artist}::${track}`;
          if (key === currentTrackKey && lyricsCache) return;
          currentTrackKey = key;

          const panel = createPanel();
          panel.innerHTML = '<div class="lyrics-header"><span>Loading lyrics...</span></div>';

          try {
            const resp = await invoke('fetch_lyrics', {
              payload: { artist, track, duration: video.duration },
            });
            const lrc = resp.syncedLyrics;
            const plain = resp.plainLyrics;

            if (!lrc && !plain) {
              panel.innerHTML = '<div class="lyrics-header"><span>No lyrics found</span></div>';
              lyricsCache = '';
              return;
            }

            if (lrc) {
              lyricsCache = lrc;
              const parsed = parseLRC(lrc);
              panel.innerHTML = `
                <div class="lyrics-header">
                  <span>Lyrics</span>
                  <button class="lyrics-close" id="voltytm-lyrics-close">&times;</button>
                </div>
                ${parsed.map((l, i) => `<div class="lyric-line" data-time="${l.time}" data-index="${i}">${l.text}</div>`).join('')}
              `;
              document.getElementById('voltytm-lyrics-close')?.addEventListener('click', () => {
                panel.innerHTML = '';
                lyricsCache = '';
                currentTrackKey = '';
              });
            } else {
              lyricsCache = plain;
              panel.innerHTML = `
                <div class="lyrics-header">
                  <span>Lyrics</span>
                  <button class="lyrics-close" id="voltytm-lyrics-close">&times;</button>
                </div>
                ${plain.split('\n').map(l => `<div class="lyric-line">${l}</div>`).join('')}
              `;
              document.getElementById('voltytm-lyrics-close')?.addEventListener('click', () => {
                panel.innerHTML = '';
                lyricsCache = '';
                currentTrackKey = '';
              });
            }
          } catch {
            panel.innerHTML = '<div class="lyrics-header"><span>Lyrics unavailable</span></div>';
          }
        };

        injectStyles();
        createPanel();

        const updateInterval = setInterval(() => {
          const video = document.querySelector('video');
          if (!video || !lyricsCache) return;

          const track = readTrackSnapshot();
          if (!track) return;

          if (!document.getElementById(PANEL_ID)) {
            createPanel();
            currentTrackKey = '';
          }

          if (!currentTrackKey) {
            fetchAndDisplay(track.title, track.artist, video);
            return;
          }

          const panel = document.getElementById(PANEL_ID);
          const lines = panel?.querySelectorAll('.lyric-line[data-time]');
          if (!lines || lines.length === 0) return;

          let activeIndex = -1;
          for (let i = lines.length - 1; i >= 0; i--) {
            if (video.currentTime >= parseFloat(lines[i].dataset.time)) {
              activeIndex = i;
              break;
            }
          }

          lines.forEach((line, i) => {
            line.classList.remove('active', 'past');
            if (i === activeIndex) {
              line.classList.add('active');
              line.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (i < activeIndex) {
              line.classList.add('past');
            }
          });
        }, 250);

        const trackObserver = new MutationObserver(() => {
          const track = readTrackSnapshot();
          if (track) {
            currentTrackKey = '';
            lyricsCache = '';
            const video = document.querySelector('video');
            if (video) fetchAndDisplay(track.title, track.artist, video);
          }
        });
        trackObserver.observe(document.body, { childList: true, subtree: true });

        return () => {
          clearInterval(updateInterval);
          trackObserver.disconnect();
          document.getElementById(PANEL_ID)?.remove();
          document.getElementById(STYLE_ID)?.remove();
        };
      },
    },

    crossfade: {
      start(config) {
        if (!config.enabled) return;
        const duration = config.duration || 3;

        let audioCtx = null;
        let currentSource = null;
        let nextSource = null;

        const interval = setInterval(() => {
          const video = document.querySelector('video');
          if (!video || video.paused) return;

          if (!audioCtx) {
            try {
              audioCtx = new AudioContext();
            } catch {
              return;
            }
          }

          const remaining = video.duration - video.currentTime;
          if (remaining <= duration && remaining > 0 && video.volume > 0.01) {
            const fadeRatio = remaining / duration;
            video.volume = Math.max(0.01, fadeRatio);
          } else if (remaining > duration && video.volume < 1) {
            video.volume = 1;
          }
        }, 200);

        return () => {
          clearInterval(interval);
          const video = document.querySelector('video');
          if (video) video.volume = 1;
          if (audioCtx) audioCtx.close().catch(() => {});
        };
      },
    },

    pip: {
      start(config) {
        if (!config.enabled) return;

        const STYLE_ID = '__VOLTYTM_PIP__';
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
          #voltytm-pip-btn {
            position: fixed;
            bottom: 40px;
            right: 20px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(0,0,0,0.7);
            border: 1px solid rgba(255,255,255,0.2);
            color: #fff;
            font-size: 18px;
            cursor: pointer;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(8px);
            transition: all 0.2s;
          }
          #voltytm-pip-btn:hover {
            background: rgba(255,0,0,0.8);
            transform: scale(1.1);
          }
        `;
        document.head.appendChild(style);

        const btn = document.createElement('button');
        btn.id = 'voltytm-pip-btn';
        btn.title = 'Picture-in-Picture';
        btn.textContent = '\u25A9';
        btn.addEventListener('click', async () => {
          const video = document.querySelector('video');
          if (!video) return;
          try {
            if (document.pictureInPictureElement) {
              await document.exitPictureInPicture();
            } else {
              await video.requestPictureInPicture();
            }
          } catch (e) {
            console.warn('[VoltYTM] PiP failed:', e);
          }
        });
        document.body.appendChild(btn);

        return () => {
          btn.remove();
          style.remove();
        };
      },
    },

    download: {
      start(config) {
        if (!config.enabled) return;

        const STYLE_ID = '__VOLTYTM_DL__';
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
          #voltytm-dl-btn {
            position: fixed;
            bottom: 90px;
            right: 20px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(0,0,0,0.7);
            border: 1px solid rgba(255,255,255,0.2);
            color: #fff;
            font-size: 16px;
            cursor: pointer;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(8px);
            transition: all 0.2s;
          }
          #voltytm-dl-btn:hover {
            background: rgba(0,200,80,0.8);
            transform: scale(1.1);
          }
          #voltytm-dl-btn.downloading {
            animation: voltytm-pulse 1s infinite;
          }
          @keyframes voltytm-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          #voltytm-dl-dialog {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 420px;
            background: #1a1d21;
            border: 1px solid #333;
            border-radius: 14px;
            z-index: 10001;
            font-family: 'YouTube Sans', sans-serif;
            color: #e1e1e1;
            box-shadow: 0 20px 60px rgba(0,0,0,0.6);
          }
          #voltytm-dl-dialog .dl-header {
            padding: 18px 20px 12px;
            border-bottom: 1px solid #2a2a2a;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          #voltytm-dl-dialog .dl-header h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
          }
          #voltytm-dl-dialog .dl-close {
            background: none;
            border: none;
            color: #888;
            font-size: 20px;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
          }
          #voltytm-dl-dialog .dl-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
          #voltytm-dl-dialog .dl-body {
            padding: 16px 20px;
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          #voltytm-dl-dialog .dl-row {
            display: flex;
            flex-direction: column;
            gap: 5px;
          }
          #voltytm-dl-dialog .dl-row label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #888;
            font-weight: 600;
          }
          #voltytm-dl-dialog .dl-row select,
          #voltytm-dl-dialog .dl-row input {
            background: #121416;
            border: 1px solid #333;
            border-radius: 8px;
            color: #e1e1e1;
            padding: 9px 12px;
            font-size: 13px;
            font-family: inherit;
            outline: none;
            transition: border-color 0.2s;
          }
          #voltytm-dl-dialog .dl-row select:focus,
          #voltytm-dl-dialog .dl-row input:focus {
            border-color: #4fd1b3;
          }
          #voltytm-dl-dialog .dl-row select {
            cursor: pointer;
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 10px center;
            padding-right: 30px;
          }
          #voltytm-dl-dialog .dl-row-inline {
            display: flex;
            gap: 10px;
          }
          #voltytm-dl-dialog .dl-row-inline .dl-row { flex: 1; }
          #voltytm-dl-dialog .dl-checkbox {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            cursor: pointer;
          }
          #voltytm-dl-dialog .dl-checkbox input[type="checkbox"] {
            width: 16px;
            height: 16px;
            accent-color: #4fd1b3;
          }
          #voltytm-dl-dialog .dl-track-info {
            background: #121416;
            border-radius: 8px;
            padding: 10px 12px;
            font-size: 12px;
            color: #aaa;
            display: flex;
            flex-direction: column;
            gap: 3px;
          }
          #voltytm-dl-dialog .dl-track-info strong {
            color: #e1e1e1;
            font-size: 13px;
          }
          #voltytm-dl-dialog .dl-footer {
            padding: 14px 20px;
            border-top: 1px solid #2a2a2a;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
          }
          #voltytm-dl-dialog .dl-btn {
            padding: 9px 22px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            font-family: inherit;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
          }
          #voltytm-dl-dialog .dl-btn-cancel {
            background: #2a2a2a;
            color: #aaa;
          }
          #voltytm-dl-dialog .dl-btn-cancel:hover { background: #333; color: #fff; }
          #voltytm-dl-dialog .dl-btn-download {
            background: #4fd1b3;
            color: #000;
          }
          #voltytm-dl-dialog .dl-btn-download:hover { background: #38c9a3; }
          #voltytm-dl-dialog .dl-btn-download:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          #voltytm-dl-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: 10000;
          }
          #voltytm-dl-toast {
            position: fixed;
            bottom: 150px;
            right: 20px;
            background: rgba(0,200,80,0.9);
            color: #fff;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            z-index: 10002;
            animation: voltytm-fadeout 3s forwards;
          }
          @keyframes voltytm-fadeout {
            0% { opacity: 1; }
            70% { opacity: 1; }
            100% { opacity: 0; }
          }
        `;
        document.head.appendChild(style);

        const btn = document.createElement('button');
        btn.id = 'voltytm-dl-btn';
        btn.title = 'Download Track';
        btn.textContent = '\u2B07';

        const getDefaults = () => ({
          format: config.format || 'mp3',
          quality: config.quality || '0',
          outputDir: config.outputDir || '',
          embedArt: config.embedArt !== false,
          filenamePattern: config.filenamePattern || '{artist} - {title}',
        });

        const showDialog = () => {
          const videoId = new URLSearchParams(window.location.search).get('v');
          const track = readTrackSnapshot();
          if (!videoId || !track) return;

          const defaults = getDefaults();

          const overlay = document.createElement('div');
          overlay.id = 'voltytm-dl-overlay';
          overlay.addEventListener('click', closeDialog);

          const dialog = document.createElement('div');
          dialog.id = 'voltytm-dl-dialog';
          dialog.innerHTML = `
            <div class="dl-header">
              <h3>Download Track</h3>
              <button class="dl-close">&times;</button>
            </div>
            <div class="dl-body">
              <div class="dl-track-info">
                <strong>${track.title}</strong>
                <span>${track.artist}${track.album ? ' \u2022 ' + track.album : ''}</span>
              </div>
              <div class="dl-row-inline">
                <div class="dl-row">
                  <label>Format</label>
                  <select id="dl-format">
                    <option value="mp3" ${defaults.format === 'mp3' ? 'selected' : ''}>MP3</option>
                    <option value="flac" ${defaults.format === 'flac' ? 'selected' : ''}>FLAC (Lossless)</option>
                    <option value="aac" ${defaults.format === 'aac' ? 'selected' : ''}>AAC</option>
                    <option value="ogg" ${defaults.format === 'ogg' ? 'selected' : ''}>OGG Vorbis</option>
                    <option value="wav" ${defaults.format === 'wav' ? 'selected' : ''}>WAV</option>
                  </select>
                </div>
                <div class="dl-row">
                  <label>Quality</label>
                  <select id="dl-quality">
                    <option value="0" ${defaults.quality === '0' ? 'selected' : ''}>Best</option>
                    <option value="320K" ${defaults.quality === '320K' ? 'selected' : ''}>320 kbps</option>
                    <option value="192K" ${defaults.quality === '192K' ? 'selected' : ''}>192 kbps</option>
                    <option value="128K" ${defaults.quality === '128K' ? 'selected' : ''}>128 kbps</option>
                  </select>
                </div>
              </div>
              <div class="dl-row">
                <label>Output Directory</label>
                <input type="text" id="dl-output" placeholder="~/Downloads/VoltYTM" value="${defaults.outputDir}" />
              </div>
              <div class="dl-row">
                <label>Filename Pattern</label>
                <input type="text" id="dl-pattern" placeholder="{artist} - {title}" value="${defaults.filenamePattern}" />
              </div>
              <label class="dl-checkbox">
                <input type="checkbox" id="dl-art" ${defaults.embedArt ? 'checked' : ''} />
                Embed album art thumbnail
              </label>
            </div>
            <div class="dl-footer">
              <button class="dl-btn dl-btn-cancel">Cancel</button>
              <button class="dl-btn dl-btn-download">Download</button>
            </div>
          `;

          document.body.appendChild(overlay);
          document.body.appendChild(dialog);

          dialog.querySelector('.dl-close').addEventListener('click', closeDialog);
          dialog.querySelector('.dl-btn-cancel').addEventListener('click', closeDialog);

          dialog.querySelector('.dl-btn-download').addEventListener('click', async () => {
            const dlBtn = dialog.querySelector('.dl-btn-download');
            dlBtn.disabled = true;
            dlBtn.textContent = 'Downloading...';

            const format = dialog.querySelector('#dl-format').value;
            const quality = dialog.querySelector('#dl-quality').value;
            const outputDir = dialog.querySelector('#dl-output').value.trim();
            const filenamePattern = dialog.querySelector('#dl-pattern').value.trim();
            const embedArt = dialog.querySelector('#dl-art').checked;

            try {
              const path = await invoke('download_track', {
                payload: {
                  videoId,
                  title: track.title,
                  artist: track.artist,
                  album: track.album,
                  format,
                  quality,
                  outputDir: outputDir || undefined,
                  embedArt,
                  filenamePattern: filenamePattern || '{artist} - {title}',
                },
              });
              closeDialog();
              const toast = document.createElement('div');
              toast.id = 'voltytm-dl-toast';
              toast.textContent = `Downloaded: ${path}`;
              document.body.appendChild(toast);
              setTimeout(() => toast.remove(), 3500);
            } catch (e) {
              closeDialog();
              const toast = document.createElement('div');
              toast.id = 'voltytm-dl-toast';
              toast.style.background = 'rgba(200,0,0,0.9)';
              toast.textContent = `Failed: ${e}`;
              document.body.appendChild(toast);
              setTimeout(() => toast.remove(), 4000);
            }
          });
        };

        function closeDialog() {
          document.getElementById('voltytm-dl-overlay')?.remove();
          document.getElementById('voltytm-dl-dialog')?.remove();
        }

        btn.addEventListener('click', showDialog);
        document.body.appendChild(btn);

        return () => {
          btn.remove();
          closeDialog();
          style.remove();
        };
      },
    },

    keyBpm: {
      start(config) {
        if (!config.enabled) return;

        const STYLE_ID = '__VOLTYTM_KEYBPM__';
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
          #voltytm-keybpm {
            position: fixed;
            bottom: 40px;
            right: 70px;
            background: rgba(0,0,0,0.75);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 10px;
            padding: 6px 14px;
            color: #fff;
            font-family: 'YouTube Sans', monospace;
            font-size: 13px;
            z-index: 9999;
            backdrop-filter: blur(8px);
            display: flex;
            gap: 12px;
            align-items: center;
            letter-spacing: 0.5px;
            user-select: none;
          }
          #voltytm-keybpm:empty { display: none; }
          #voltytm-keybpm .kb-key {
            color: #ff6b6b;
            font-weight: 700;
          }
          #voltytm-keybpm .kb-bpm {
            color: #4fd1b3;
            font-weight: 700;
          }
          #voltytm-keybpm .kb-label {
            color: #888;
            font-size: 10px;
            text-transform: uppercase;
          }
        `;
        document.head.appendChild(style);

        const el = document.createElement('div');
        el.id = 'voltytm-keybpm';
        document.body.appendChild(el);

        const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const FFT_SIZE = 4096;
        const ENERGY_THRESHOLD = 0.015;
        const BPM_WINDOW_MS = 15000;

        let audioCtx = null;
        let analyser = null;
        let sourceNode = null;
        let attachedVideo = null;
        let freqData = null;
        let timeData = null;

        let beatTimes = [];
        let lastBeatTime = 0;
        let lastEnergy = 0;
        let lastKey = '';
        let lastBpm = 0;
        let currentTrackKey = '';
        let analysisInterval = null;

        const connectToVideo = (video) => {
          if (video === attachedVideo) return;
          try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = FFT_SIZE;
            analyser.smoothingTimeConstant = 0.3;
            freqData = new Uint8Array(analyser.frequencyBinCount);
            timeData = new Float32Array(analyser.fftSize);
            sourceNode = audioCtx.createMediaElementSource(video);
            sourceNode.connect(analyser);
            analyser.connect(audioCtx.destination);
            attachedVideo = video;
          } catch (e) {
            console.warn('[VoltYTM] Audio analysis setup failed:', e);
          }
        };

        const computeRMS = () => {
          analyser.getFloatTimeDomainData(timeData);
          let sum = 0;
          for (let i = 0; i < timeData.length; i++) sum += timeData[i] * timeData[i];
          return Math.sqrt(sum / timeData.length);
        };

        const detectKey = () => {
          analyser.getByteFrequencyData(freqData);
          const chroma = new Float32Array(12);
          const binCount = analyser.frequencyBinCount;
          const sampleRate = audioCtx.sampleRate;
          const binHz = sampleRate / FFT_SIZE;

          for (let i = 1; i < binCount; i++) {
            const freq = i * binHz;
            if (freq < 65 || freq > 2100) continue;
            const midi = 69 + 12 * Math.log2(freq / 440);
            const pitchClass = Math.round(midi) % 12;
            if (pitchClass >= 0 && pitchClass < 12) {
              chroma[pitchClass] += freqData[i] / 255;
            }
          }

          const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
          const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

          let bestKey = 0;
          let bestScore = -1;
          let isMinor = false;

          for (let shift = 0; shift < 12; shift++) {
            let majorScore = 0;
            let minorScore = 0;
            for (let j = 0; j < 12; j++) {
              majorScore += chroma[(j + shift) % 12] * majorProfile[j];
              minorScore += chroma[(j + shift) % 12] * minorProfile[j];
            }
            if (majorScore > bestScore) {
              bestScore = majorScore;
              bestKey = shift;
              isMinor = false;
            }
            if (minorScore > bestScore) {
              bestScore = minorScore;
              bestKey = shift;
              isMinor = true;
            }
          }

          return NOTE_NAMES[bestKey] + (isMinor ? 'm' : '');
        };

        const detectBPM = () => {
          const now = performance.now();
          const rms = computeRMS();

          if (rms > ENERGY_THRESHOLD && rms > lastEnergy * 1.3) {
            if (now - lastBeatTime > 200) {
              beatTimes.push(now);
              lastBeatTime = now;
            }
          }
          lastEnergy = rms;

          beatTimes = beatTimes.filter((t) => now - t < BPM_WINDOW_MS);
          if (beatTimes.length < 4) return 0;

          const intervals = [];
          for (let i = 1; i < beatTimes.length; i++) {
            intervals.push(beatTimes[i] - beatTimes[i - 1]);
          }

          intervals.sort((a, b) => a - b);
          const trimmed = intervals.slice(
            Math.floor(intervals.length * 0.2),
            Math.floor(intervals.length * 0.8),
          );
          if (trimmed.length === 0) return 0;

          const avgInterval = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
          const rawBpm = 60000 / avgInterval;

          if (rawBpm < 60) return Math.round(rawBpm * 2);
          if (rawBpm > 180) return Math.round(rawBpm / 2);
          return Math.round(rawBpm);
        };

        const updateDisplay = () => {
          const track = readTrackSnapshot();
          if (!track) {
            el.innerHTML = '';
            currentTrackKey = '';
            return;
          }

          const key = `${track.artist}::${track.title}`;
          if (key !== currentTrackKey) {
            currentTrackKey = key;
            lastKey = '';
            lastBpm = 0;
            beatTimes = [];
          }

          const video = document.querySelector('video');
          if (!video || video.paused || !analyser) return;

          const detectedKey = detectKey();
          const detectedBpm = detectBPM();

          if (detectedKey && detectedKey !== lastKey) lastKey = detectedKey;
          if (detectedBpm > 0 && Math.abs(detectedBpm - lastBpm) > 2) lastBpm = detectedBpm;

          if (lastKey || lastBpm > 0) {
            el.innerHTML = '';
            if (lastKey) {
              const keySpan = document.createElement('span');
              keySpan.className = 'kb-key';
              keySpan.textContent = lastKey;
              el.appendChild(keySpan);
            }
            if (lastBpm > 0) {
              const bpmSpan = document.createElement('span');
              bpmSpan.className = 'kb-bpm';
              bpmSpan.textContent = `${lastBpm}`;
              el.appendChild(bpmSpan);
              const label = document.createElement('span');
              label.className = 'kb-label';
              label.textContent = 'BPM';
              el.appendChild(label);
            }
          }
        };

        analysisInterval = setInterval(() => {
          const video = document.querySelector('video');
          if (!video) return;
          connectToVideo(video);
          updateDisplay();
        }, 500);

        return () => {
          clearInterval(analysisInterval);
          el.remove();
          style.remove();
          if (sourceNode) {
            try { sourceNode.disconnect(); } catch {}
          }
          if (audioCtx) {
            audioCtx.close().catch(() => {});
          }
        };
      },
    },

    doNotTrack: {
      start(config) {
        if (!config.enabled) return;

        if (navigator.doNotTrack !== '1' && window.doNotTrack !== '1') {
          Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' });
        }

        const originalSendBeacon = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = (url, data) => {
          const str = typeof url === 'string' ? url : url?.href || '';
          if (str.includes('google-analytics') || str.includes('googletagmanager') || str.includes('doubleclick')) {
            return true;
          }
          return originalSendBeacon(url, data);
        };

        const originalFetch = window.fetch.bind(window);
        window.fetch = (input, init) => {
          const url = typeof input === 'string' ? input : input?.url || '';
          if (url.includes('google-analytics') || url.includes('googletagmanager') || url.includes('ptracking')) {
            return Promise.resolve(new Response('', { status: 204 }));
          }
          return originalFetch(input, init);
        };
      },
    },

    disableAutoplay: {
      start(config) {
        if (!config.enabled) return;

        let wasPlaying = false;

        const checkAndPause = () => {
          const video = document.querySelector('video');
          if (!video) return;
          if (video.currentTime > 0 && video.currentTime < 2 && !video.paused) {
            video.pause();
          }
        };

        const observer = new MutationObserver(() => {
          const title = readText(['ytmusic-player-bar .title', '.ytmusic-player-bar .title']);
          if (title && title !== lastTitle) {
            lastTitle = title;
            setTimeout(checkAndPause, 500);
          }
        });

        let lastTitle = '';
        observer.observe(document.body, { childList: true, subtree: true });

        return () => observer.disconnect();
      },
    },

    skipDisliked: {
      start(config) {
        if (!config.enabled) return;

        const checkDislike = () => {
          const likeBtn = document.querySelector('#like-button-renderer');
          if (likeBtn && likeBtn.getAttribute('like-status') === 'DISLIKE') {
            const nextBtn = document.querySelector('yt-icon-button.next-button, .next-button');
            if (nextBtn) nextBtn.click();
          }
        };

        const observer = new MutationObserver(checkDislike);
        const waitForLike = setInterval(() => {
          const likeBtn = document.querySelector('#like-button-renderer');
          if (likeBtn) {
            clearInterval(waitForLike);
            observer.observe(likeBtn, { attributes: true, attributeFilter: ['like-status'] });
            checkDislike();
          }
        }, 1000);

        return () => {
          clearInterval(waitForLike);
          observer.disconnect();
        };
      },
    },

    compactSidebar: {
      start(config) {
        if (!config.enabled) return;

        const STYLE_ID = '__VOLTYTM_COMPACT_SIDEBAR__';
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
          ytmusicь browse { --ytmusic-guide-width: 72px !important; }
          ytmusicь[page-subtype="browse"] #guide { width: 72px !important; }
          ytmusicь #guide ytmusicь-guide-entry-renderer { padding: 0 8px !important; }
          ytmusicь #guide ytmusicь-guide-entry-renderer .guide-entry-badge { display: none !important; }
          ytmusicь #guide .yt-simple-endpoint { justify-content: center !important; }
          ytmusicь #guide ytmusicь-guide-entry-renderer .guide-entry-title {
            font-size: 10px !important;
            text-align: center !important;
          }
        `;
        document.head.appendChild(style);
        return () => style.remove();
      },
    },

    navigation: {
      start(config) {
        if (!config.enabled) return;

        const STYLE_ID = '__VOLTYTM_NAV__';
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
          #voltytm-nav {
            position: fixed;
            top: 12px;
            left: 12px;
            display: flex;
            gap: 4px;
            z-index: 9998;
          }
          #voltytm-nav button {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: rgba(0,0,0,0.6);
            border: 1px solid rgba(255,255,255,0.15);
            color: #fff;
            font-size: 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(6px);
            transition: all 0.15s;
          }
          #voltytm-nav button:hover { background: rgba(255,255,255,0.15); }
          #voltytm-nav button:active { transform: scale(0.9); }
        `;
        document.head.appendChild(style);

        const nav = document.createElement('div');
        nav.id = 'voltytm-nav';

        const backBtn = document.createElement('button');
        backBtn.textContent = '\u2190';
        backBtn.title = 'Back';
        backBtn.addEventListener('click', () => window.history.back());

        const fwdBtn = document.createElement('button');
        fwdBtn.textContent = '\u2192';
        fwdBtn.title = 'Forward';
        fwdBtn.addEventListener('click', () => window.history.forward());

        nav.appendChild(backBtn);
        nav.appendChild(fwdBtn);
        document.body.appendChild(nav);

        return () => {
          nav.remove();
          style.remove();
        };
      },
    },

    unobtrusivePlayer: {
      start(config) {
        if (!config.enabled) return;

        const STYLE_ID = '__VOLTYTM_UNOBTRUSIVE__';
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
          ytmusicь-player-bar {
            transition: opacity 0.5s ease, transform 0.5s ease !important;
          }
          ytmusicь-player-bar.voltytm-dimmed {
            opacity: 0.15 !important;
            transform: translateY(4px) !important;
          }
          ytmusicь-player-bar.voltytm-dimmed:hover {
            opacity: 1 !important;
            transform: translateY(0) !important;
          }
        `;
        document.head.appendChild(style);

        let idleTimer = null;
        const DIM_DELAY = 5000;

        const resetTimer = () => {
          clearTimeout(idleTimer);
          const bar = document.querySelector('ytmusic-player-bar');
          if (bar) bar.classList.remove('voltytm-dimmed');
          idleTimer = setTimeout(() => {
            const video = document.querySelector('video');
            if (video && !video.paused) {
              const bar = document.querySelector('ytmusic-player-bar');
              if (bar) bar.classList.add('voltytm-dimmed');
            }
          }, DIM_DELAY);
        };

        document.addEventListener('mousemove', resetTimer);
        document.addEventListener('keydown', resetTimer);
        resetTimer();

        return () => {
          clearTimeout(idleTimer);
          document.removeEventListener('mousemove', resetTimer);
          document.removeEventListener('keydown', resetTimer);
          document.querySelector('ytmusic-player-bar')?.classList.remove('voltytm-dimmed');
          style.remove();
        };
      },
    },

    sleepTimer: {
      start(config) {
        if (!config.enabled) return;

        const STYLE_ID = '__VOLTYTM_SLEEP__';
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
          #voltytm-sleep-btn {
            position: fixed;
            bottom: 140px;
            right: 20px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(0,0,0,0.7);
            border: 1px solid rgba(255,255,255,0.2);
            color: #fff;
            font-size: 16px;
            cursor: pointer;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(8px);
            transition: all 0.2s;
          }
          #voltytm-sleep-btn:hover { background: rgba(255,255,255,0.15); }
          #voltytm-sleep-btn.active { background: rgba(255,150,0,0.7); border-color: rgba(255,150,0,0.5); }
          #voltytm-sleep-menu {
            position: fixed;
            bottom: 190px;
            right: 20px;
            background: #1a1d21;
            border: 1px solid #333;
            border-radius: 10px;
            z-index: 10001;
            padding: 6px;
            display: none;
            min-width: 140px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.5);
          }
          #voltytm-sleep-menu.visible { display: block; }
          #voltytm-sleep-menu button {
            display: block;
            width: 100%;
            padding: 8px 14px;
            background: none;
            border: none;
            color: #e1e1e1;
            font-size: 13px;
            font-family: inherit;
            text-align: left;
            cursor: pointer;
            border-radius: 6px;
            transition: background 0.15s;
          }
          #voltytm-sleep-menu button:hover { background: rgba(255,255,255,0.08); }
          #voltytm-sleep-menu .sleep-active { color: #ff9600; font-weight: 600; }
          #voltytm-sleep-menu .sleep-separator {
            height: 1px;
            background: #2a2a2a;
            margin: 4px 8px;
          }
        `;
        document.head.appendChild(style);

        const btn = document.createElement('button');
        btn.id = 'voltytm-sleep-btn';
        btn.textContent = '\u23F0';
        btn.title = 'Sleep Timer';

        const menu = document.createElement('div');
        menu.id = 'voltytm-sleep-menu';

        let timerInterval = null;
        let remainingSeconds = 0;
        let endOfTrack = false;
        let trackKeyAtStart = '';

        const updateBtn = () => {
          if (remainingSeconds > 0) {
            const min = Math.floor(remainingSeconds / 60);
            const sec = remainingSeconds % 60;
            btn.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
            btn.classList.add('active');
            btn.title = `Sleep timer: ${min}m ${sec}s remaining`;
          } else {
            btn.textContent = '\u23F0';
            btn.classList.remove('active');
            btn.title = 'Sleep Timer';
          }
        };

        const buildMenu = () => {
          const items = [
            { label: '15 minutes', minutes: 15 },
            { label: '30 minutes', minutes: 30 },
            { label: '45 minutes', minutes: 45 },
            { label: '60 minutes', minutes: 60 },
            { label: '90 minutes', minutes: 90 },
            'separator',
            { label: 'End of track', endOfTrack: true },
            'separator',
            { label: 'Cancel timer', cancel: true },
          ];

          menu.innerHTML = '';
          for (const item of items) {
            if (item === 'separator') {
              const sep = document.createElement('div');
              sep.className = 'sleep-separator';
              menu.appendChild(sep);
              continue;
            }
            const b = document.createElement('button');
            if (item.cancel) {
              b.textContent = remainingSeconds > 0 ? 'Cancel timer' : 'No active timer';
              if (remainingSeconds <= 0) b.disabled = true;
              b.addEventListener('click', () => {
                clearInterval(timerInterval);
                remainingSeconds = 0;
                endOfTrack = false;
                updateBtn();
                menu.classList.remove('visible');
              });
            } else if (item.endOfTrack) {
              b.textContent = endOfTrack ? '\u2713 End of track' : 'End of track';
              if (endOfTrack) b.className = 'sleep-active';
              b.addEventListener('click', () => {
                clearInterval(timerInterval);
                remainingSeconds = 0;
                endOfTrack = true;
                const video = document.querySelector('video');
                trackKeyAtStart = readTrackSnapshot()
                  ? `${readTrackSnapshot().artist}::${readTrackSnapshot().title}`
                  : '';
                updateBtn();
                menu.classList.remove('visible');
              });
            } else {
              b.textContent = remainingSeconds > 0 ? `${item.label} (replace)` : item.label;
              b.addEventListener('click', () => {
                clearInterval(timerInterval);
                remainingSeconds = item.minutes * 60;
                endOfTrack = false;
                timerInterval = setInterval(() => {
                  remainingSeconds--;
                  updateBtn();
                  if (remainingSeconds <= 0) {
                    clearInterval(timerInterval);
                    const video = document.querySelector('video');
                    if (video) video.pause();
                    remainingSeconds = 0;
                    updateBtn();
                  }
                }, 1000);
                updateBtn();
                menu.classList.remove('visible');
              });
            }
            menu.appendChild(b);
          }
        };

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          buildMenu();
          menu.classList.toggle('visible');
        });

        document.addEventListener('click', (e) => {
          if (!menu.contains(e.target) && e.target !== btn) {
            menu.classList.remove('visible');
          }
        });

        const endOfTrackCheck = setInterval(() => {
          if (!endOfTrack) return;
          const video = document.querySelector('video');
          if (!video) return;
          if (video.currentTime >= video.duration - 1 && video.duration > 0) {
            const track = readTrackSnapshot();
            const currentKey = track ? `${track.artist}::${track.title}` : '';
            if (currentKey !== trackKeyAtStart) {
              video.pause();
              endOfTrack = false;
              updateBtn();
            }
          }
        }, 1000);

        document.body.appendChild(btn);
        document.body.appendChild(menu);

        return () => {
          clearInterval(timerInterval);
          clearInterval(endOfTrackCheck);
          btn.remove();
          menu.remove();
          style.remove();
        };
      },
    },

    audioDevice: {
      start(config) {
        if (!config.enabled) return;

        if (!navigator.mediaDevices?.enumerateDevices) return;

        const STYLE_ID = '__VOLTYTM_ADEV__';
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
          #voltytm-adev-btn {
            position: fixed;
            bottom: 190px;
            right: 20px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(0,0,0,0.7);
            border: 1px solid rgba(255,255,255,0.2);
            color: #fff;
            font-size: 16px;
            cursor: pointer;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(8px);
            transition: all 0.2s;
          }
          #voltytm-adev-btn:hover { background: rgba(255,255,255,0.15); }
          #voltytm-adev-menu {
            position: fixed;
            bottom: 240px;
            right: 20px;
            background: #1a1d21;
            border: 1px solid #333;
            border-radius: 10px;
            z-index: 10001;
            padding: 6px;
            display: none;
            min-width: 200px;
            max-height: 250px;
            overflow-y: auto;
            box-shadow: 0 8px 30px rgba(0,0,0,0.5);
          }
          #voltytm-adev-menu.visible { display: block; }
          #voltytm-adev-menu .adev-title {
            padding: 8px 12px 4px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #888;
          }
          #voltytm-adev-menu button {
            display: block;
            width: 100%;
            padding: 8px 12px;
            background: none;
            border: none;
            color: #e1e1e1;
            font-size: 13px;
            font-family: inherit;
            text-align: left;
            cursor: pointer;
            border-radius: 6px;
            transition: background 0.15s;
          }
          #voltytm-adev-menu button:hover { background: rgba(255,255,255,0.08); }
          #voltytm-adev-menu button.active { color: #4fd1b3; font-weight: 600; }
        `;
        document.head.appendChild(style);

        const btn = document.createElement('button');
        btn.id = 'voltytm-adev-btn';
        btn.textContent = '\u{1F50A}';
        btn.title = 'Audio Output';

        const menu = document.createElement('div');
        menu.id = 'voltytm-adev-menu';

        const buildMenu = async () => {
          menu.innerHTML = '<div class="adev-title">Audio Output</div>';
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');

            for (const device of audioOutputs) {
              const b = document.createElement('button');
              b.textContent = device.label || `Speaker ${device.deviceId.slice(0, 8)}`;
              b.addEventListener('click', async () => {
                const video = document.querySelector('video');
                if (video && typeof video.setSinkId === 'function') {
                  try {
                    await video.setSinkId(device.deviceId);
                    menu.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
                    b.classList.add('active');
                  } catch (e) {
                    console.warn('[VoltYTM] setSinkId failed:', e);
                  }
                }
                menu.classList.remove('visible');
              });
              menu.appendChild(b);
            }

            if (audioOutputs.length === 0) {
              const b = document.createElement('button');
              b.textContent = 'Default device';
              b.disabled = true;
              menu.appendChild(b);
            }
          } catch {
            const b = document.createElement('button');
            b.textContent = 'Device enumeration unavailable';
            b.disabled = true;
            menu.appendChild(b);
          }
        };

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          buildMenu();
          menu.classList.toggle('visible');
        });

        document.addEventListener('click', (e) => {
          if (!menu.contains(e.target) && e.target !== btn) {
            menu.classList.remove('visible');
          }
        });

        document.body.appendChild(btn);
        document.body.appendChild(menu);

        return () => {
          btn.remove();
          menu.remove();
          style.remove();
        };
      },
    },

    volumeNormalizer: {
      start(config) {
        if (!config.enabled) return;

        const TARGET_LOUDNESS = config.targetLoudness || -14;
        const MAX_GAIN = config.maxGain || 3;

        let audioCtx = null;
        let gainNode = null;
        let analyser = null;
        let sourceNode = null;
        let attachedVideo = null;
        let calibrating = true;
        let loudnessSum = 0;
        let loudnessCount = 0;

        const connectVideo = (video) => {
          if (video === attachedVideo) return;
          try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 2048;
            gainNode = audioCtx.createGain();
            sourceNode = audioCtx.createMediaElementSource(video);
            sourceNode.connect(analyser);
            analyser.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            attachedVideo = video;
            calibrating = true;
            loudnessSum = 0;
            loudnessCount = 0;
          } catch {
            // already connected or blocked
          }
        };

        const interval = setInterval(() => {
          const video = document.querySelector('video');
          if (!video || video.paused || !analyser || !gainNode) return;
          connectVideo(video);

          const data = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(data);

          let sumSq = 0;
          for (let i = 0; i < data.length; i++) sumSq += data[i] * data[i];
          const rms = Math.sqrt(sumSq / data.length);
          const db = 20 * Math.log10(Math.max(rms, 1e-10));

          if (calibrating) {
            loudnessSum += db;
            loudnessCount++;
            if (loudnessCount > 30) {
              calibrating = false;
            }
            return;
          }

          const gainDb = TARGET_LOUDNESS - db;
          const gain = Math.pow(10, gainDb / 20);
          const clampedGain = Math.min(gain, MAX_GAIN);

          gainNode.gain.setTargetAtTime(clampedGain, audioCtx.currentTime, 0.1);
        }, 100);

        return () => {
          clearInterval(interval);
          if (sourceNode) {
            try { sourceNode.disconnect(); } catch {}
          }
          if (audioCtx) audioCtx.close().catch(() => {});
        };
      },
    },

    miniPlayer: {
      start(config) {
        if (!config.enabled) return;

        const STYLE_ID = '__VOLTYTM_MINI__';
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
          #voltytm-mini-btn {
            position: fixed;
            top: 12px;
            right: 60px;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: rgba(0,0,0,0.6);
            border: 1px solid rgba(255,255,255,0.15);
            color: #fff;
            font-size: 14px;
            cursor: pointer;
            z-index: 9998;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(6px);
            transition: all 0.15s;
          }
          #voltytm-mini-btn:hover { background: rgba(255,255,255,0.15); }
          #voltytm-mini-panel {
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 320px;
            background: rgba(20,22,25,0.95);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 14px;
            padding: 14px;
            z-index: 10001;
            display: none;
            backdrop-filter: blur(20px);
            box-shadow: 0 10px 40px rgba(0,0,0,0.6);
            font-family: 'YouTube Sans', sans-serif;
            color: #fff;
          }
          #voltytm-mini-panel.visible { display: flex; gap: 12px; align-items: center; }
          #voltytm-mini-panel .mini-art {
            width: 56px;
            height: 56px;
            border-radius: 8px;
            background: #222;
            object-fit: cover;
            flex-shrink: 0;
          }
          #voltytm-mini-panel .mini-info {
            flex: 1;
            min-width: 0;
          }
          #voltytm-mini-panel .mini-title {
            font-size: 13px;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          #voltytm-mini-panel .mini-artist {
            font-size: 12px;
            color: #aaa;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          #voltytm-mini-panel .mini-controls {
            display: flex;
            gap: 6px;
            margin-top: 6px;
          }
          #voltytm-mini-panel .mini-controls button {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            background: rgba(255,255,255,0.1);
            border: none;
            color: #fff;
            font-size: 14px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s;
          }
          #voltytm-mini-panel .mini-controls button:hover {
            background: rgba(255,255,255,0.2);
          }
        `;
        document.head.appendChild(style);

        const btn = document.createElement('button');
        btn.id = 'voltytm-mini-btn';
        btn.textContent = '\u25A6';
        btn.title = 'Mini Player';

        const panel = document.createElement('div');
        panel.id = 'voltytm-mini-panel';
        panel.innerHTML = `
          <img class="mini-art" src="" alt="" />
          <div class="mini-info">
            <div class="mini-title"></div>
            <div class="mini-artist"></div>
            <div class="mini-controls">
              <button class="mini-prev">\u23EE</button>
              <button class="mini-play">\u25B6</button>
              <button class="mini-next">\u23ED</button>
            </div>
          </div>
        `;

        const click = (sel) => {
          const video = document.querySelector('video');
          if (!video) return;
          const btn = document.querySelector(sel);
          if (btn) btn.click();
        };

        panel.querySelector('.mini-play').addEventListener('click', () => {
          click('tp-yt-paper-icon-button#play-pause-button');
        });
        panel.querySelector('.mini-prev').addEventListener('click', () => {
          click('.previous-button');
        });
        panel.querySelector('.mini-next').addEventListener('click', () => {
          click('.next-button');
        });

        const updateInterval = setInterval(() => {
          if (!panel.classList.contains('visible')) return;
          const track = readTrackSnapshot();
          if (!track) return;

          panel.querySelector('.mini-title').textContent = track.title;
          panel.querySelector('.mini-artist').textContent = track.artist;

          const art = panel.querySelector('.mini-art');
          const img = document.querySelector('ytmusic-player-bar img.image, .thumbnail-image-wrapper img');
          if (img?.src && art.src !== img.src) art.src = img.src;

          const video = document.querySelector('video');
          const playBtn = panel.querySelector('.mini-play');
          if (video && playBtn) {
            playBtn.textContent = video.paused ? '\u25B6' : '\u23F8';
          }
        }, 500);

        btn.addEventListener('click', () => {
          panel.classList.toggle('visible');
        });

        document.body.appendChild(btn);
        document.body.appendChild(panel);

        return () => {
          clearInterval(updateInterval);
          btn.remove();
          panel.remove();
          style.remove();
        };
      },
    },

    playbackSpeed: {
      start(config) {
        if (!config.enabled) return;

        const STYLE_ID = '__VOLTYTM_SPEED__';
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
          #voltytm-speed-panel {
            position: fixed;
            bottom: 290px;
            right: 20px;
            background: rgba(20,22,25,0.92);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 10px 14px;
            z-index: 10001;
            display: none;
            backdrop-filter: blur(16px);
            box-shadow: 0 8px 30px rgba(0,0,0,0.5);
            font-family: 'YouTube Sans', sans-serif;
            color: #fff;
            min-width: 220px;
          }
          #voltytm-speed-panel.visible { display: block; }
          #voltytm-speed-panel .speed-header {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #888;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          #voltytm-speed-panel .speed-current {
            color: #4fd1b3;
            font-weight: 700;
            font-size: 13px;
          }
          #voltytm-speed-panel .speed-slider-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 10px;
          }
          #voltytm-speed-panel .speed-slider-row label {
            font-size: 11px;
            color: #888;
            min-width: 48px;
          }
          #voltytm-speed-panel input[type="range"] {
            flex: 1;
            -webkit-appearance: none;
            height: 4px;
            background: #333;
            border-radius: 2px;
            outline: none;
          }
          #voltytm-speed-panel input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #4fd1b3;
            cursor: pointer;
          }
          #voltytm-speed-panel .speed-presets {
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
          }
          #voltytm-speed-panel .speed-preset {
            padding: 5px 10px;
            border-radius: 6px;
            background: rgba(255,255,255,0.06);
            border: 1px solid transparent;
            color: #ccc;
            font-size: 12px;
            font-family: inherit;
            cursor: pointer;
            transition: all 0.15s;
          }
          #voltytm-speed-panel .speed-preset:hover {
            background: rgba(255,255,255,0.12);
            color: #fff;
          }
          #voltytm-speed-panel .speed-preset.active {
            background: rgba(79,209,179,0.15);
            border-color: rgba(79,209,179,0.4);
            color: #4fd1b3;
            font-weight: 600;
          }
          #voltytm-speed-panel .speed-preset.slowed {
            color: #ff6b6b;
          }
          #voltytm-speed-panel .speed-preset.slowed.active {
            background: rgba(255,107,107,0.15);
            border-color: rgba(255,107,107,0.4);
            color: #ff6b6b;
          }
          #voltytm-speed-panel .speed-preset.fast {
            color: #a78bfa;
          }
          #voltytm-speed-panel .speed-preset.fast.active {
            background: rgba(167,139,250,0.15);
            border-color: rgba(167,139,250,0.4);
            color: #a78bfa;
          }
          #voltytm-speed-panel .speed-toggle {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #2a2a2a;
          }
          #voltytm-speed-panel .speed-toggle label {
            font-size: 12px;
            color: #aaa;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
          }
          #voltytm-speed-panel .speed-toggle input[type="checkbox"] {
            width: 14px;
            height: 14px;
            accent-color: #4fd1b3;
          }
          #voltytm-speed-btn {
            position: fixed;
            bottom: 240px;
            right: 20px;
            height: 32px;
            padding: 0 10px;
            border-radius: 16px;
            background: rgba(0,0,0,0.7);
            border: 1px solid rgba(255,255,255,0.2);
            color: #fff;
            font-size: 12px;
            font-family: inherit;
            font-weight: 600;
            cursor: pointer;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            backdrop-filter: blur(8px);
            transition: all 0.2s;
            min-width: 48px;
          }
          #voltytm-speed-btn:hover { background: rgba(255,255,255,0.12); }
        `;
        document.head.appendChild(style);

        const presets = [
          { label: '0.5x', value: 0.5, type: 'slowed' },
          { label: '0.75x', value: 0.75, type: 'slowed' },
          { label: '0.8x', value: 0.8, type: 'slowed' },
          { label: '0.9x', value: 0.9, type: 'slowed' },
          { label: '1x', value: 1.0, type: 'normal' },
          { label: '1.1x', value: 1.1, type: 'fast' },
          { label: '1.25x', value: 1.25, type: 'fast' },
          { label: '1.5x', value: 1.5, type: 'fast' },
          { label: '2x', value: 2.0, type: 'fast' },
        ];

        let currentSpeed = 1.0;
        let pitchCorrect = config.pitchCorrect !== false;

        const btn = document.createElement('button');
        btn.id = 'voltytm-speed-btn';
        btn.textContent = '1x';

        const panel = document.createElement('div');
        panel.id = 'voltytm-speed-panel';
        panel.innerHTML = `
          <div class="speed-header">
            <span>Playback Speed</span>
            <span class="speed-current">${currentSpeed}x</span>
          </div>
          <div class="speed-slider-row">
            <label>Speed</label>
            <input type="range" min="0.25" max="3" step="0.05" value="${currentSpeed}" />
          </div>
          <div class="speed-presets"></div>
          <div class="speed-toggle">
            <label>
              <input type="checkbox" ${pitchCorrect ? 'checked' : ''} />
              Preserve pitch (no pitch shift)
            </label>
          </div>
        `;

        const slider = panel.querySelector('input[type="range"]');
        const currentLabel = panel.querySelector('.speed-current');
        const presetsContainer = panel.querySelector('.speed-presets');
        const pitchCheckbox = panel.querySelector('.speed-toggle input[type="checkbox"]');

        const applySpeed = (speed) => {
          currentSpeed = Math.round(speed * 100) / 100;
          const video = document.querySelector('video');
          if (!video) return;
          video.playbackRate = currentSpeed;
          video.preservesPitch = pitchCorrect;
          currentLabel.textContent = `${currentSpeed}x`;
          btn.textContent = `${currentSpeed}x`;
          slider.value = currentSpeed;

          presetsContainer.querySelectorAll('.speed-preset').forEach((p) => {
            p.classList.toggle('active', parseFloat(p.dataset.value) === currentSpeed);
          });
        };

        for (const preset of presets) {
          const b = document.createElement('button');
          b.className = `speed-preset ${preset.type}`;
          b.dataset.value = preset.value;
          b.textContent = preset.label;
          b.addEventListener('click', () => applySpeed(preset.value));
          presetsContainer.appendChild(b);
        }

        slider.addEventListener('input', () => applySpeed(parseFloat(slider.value)));

        pitchCheckbox.addEventListener('change', () => {
          pitchCorrect = pitchCheckbox.checked;
          const video = document.querySelector('video');
          if (video) video.preservesPitch = pitchCorrect;
        });

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          panel.classList.toggle('visible');
        });

        document.addEventListener('click', (e) => {
          if (!panel.contains(e.target) && e.target !== btn) {
            panel.classList.remove('visible');
          }
        });

        document.addEventListener('keydown', (e) => {
          if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
          if (e.key === '<' || e.key === ',') {
            applySpeed(Math.max(0.25, currentSpeed - 0.05));
          } else if (e.key === '>' || e.key === '.') {
            applySpeed(Math.min(3, currentSpeed + 0.05));
          } else if (e.key === '0') {
            applySpeed(1.0);
          }
        });

        const videoObserver = new MutationObserver(() => {
          const video = document.querySelector('video');
          if (video && video.playbackRate !== currentSpeed) {
            applySpeed(currentSpeed);
          }
        });

        document.body.appendChild(btn);
        document.body.appendChild(panel);

        return () => {
          const video = document.querySelector('video');
          if (video) {
            video.playbackRate = 1;
            video.preservesPitch = true;
          }
          btn.remove();
          panel.remove();
          style.remove();
        };
      },
    },
  };

  const loadRendererPlugins = async () => {
    try {
      const config = await invoke('get_config', {});
      const pluginConfigs = config?.plugins ?? {};
      const cleanups = [];

      for (const [id, plugin] of Object.entries(rendererPlugins)) {
        const pc = pluginConfigs[id] ?? {};
        if (pc.enabled === false) continue;
        try {
          const cleanup = plugin.start(pc);
          if (typeof cleanup === 'function') cleanups.push(cleanup);
        } catch (e) {
          console.error(`[VoltYTM] Plugin ${id} failed:`, e);
        }
      }

      if (config?.theme) {
        try {
          const css = await invoke('get_theme_css', { name: config.theme });
          if (css) {
            let el = document.getElementById('__VOLTYTM_THEME__');
            if (!el) {
              el = document.createElement('style');
              el.id = '__VOLTYTM_THEME__';
              document.head.appendChild(el);
            }
            el.textContent = css;
          }
        } catch (e) {
          console.warn('[VoltYTM] Theme load failed:', e);
        }
      }

      window.addEventListener('beforeunload', () => {
        for (const cleanup of cleanups) {
          try { cleanup(); } catch {}
        }
      });
    } catch (e) {
      console.error('[VoltYTM] Failed to load plugins:', e);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setInterval(clickSkipButtons, 750);
      loadRendererPlugins();
    });
  } else {
    setInterval(clickSkipButtons, 750);
    loadRendererPlugins();
  }
})();
