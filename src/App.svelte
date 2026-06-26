<script lang="ts">
  import { onMount } from 'svelte';

  import { bridge, type AppConfig, type ProxyStatus } from '@/lib/bridge';
  import { pluginRegistry } from '@/plugins/registry';

  let config: AppConfig | null = null;
  let proxyStatus: ProxyStatus | null = null;
  let appVersion = '';
  let loading = true;
  let error = '';

  onMount(() => {
    void refresh();
    const interval = window.setInterval(() => {
      void refreshProxyStatus();
    }, 5_000);

    return () => window.clearInterval(interval);
  });

  async function refresh() {
    try {
      loading = true;
      error = '';
      const [nextConfig, nextProxyStatus, version] = await Promise.all([
        bridge.getConfig(),
        bridge.getAdblockProxyStatus(),
        bridge.getAppVersion(),
      ]);
      config = nextConfig;
      proxyStatus = nextProxyStatus;
      appVersion = version;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    } finally {
      loading = false;
    }
  }

  async function refreshProxyStatus() {
    try {
      proxyStatus = await bridge.getAdblockProxyStatus();
    } catch {
      proxyStatus = null;
    }
  }

  async function setPluginEnabled(pluginId: string, enabled: boolean) {
    config = await bridge.setConfig(`plugins.${pluginId}.enabled`, enabled);
  }

  async function setAdblockFlag(flag: keyof AppConfig['adblock'], enabled: boolean) {
    config = await bridge.setConfig(`adblock.${flag}`, enabled);
  }

  function isPluginEnabled(pluginId: string) {
    return Boolean(config?.plugins[pluginId]?.enabled);
  }
</script>

<main class="shell">
  <header class="topbar">
    <div>
      <p class="kicker">VoltYTM</p>
      <h1>Native Runtime</h1>
    </div>
    <button type="button" onclick={refresh} disabled={loading}>Refresh</button>
  </header>

  {#if error}
    <section class="notice" role="alert">{error}</section>
  {/if}

  <section class="status-band" aria-label="Runtime status">
    <div>
      <span>Version</span>
      <strong>{appVersion || '...'}</strong>
    </div>
    <div>
      <span>Proxy</span>
      <strong>{proxyStatus?.enabled ? 'Active' : 'Unavailable'}</strong>
    </div>
    <div>
      <span>Blocked</span>
      <strong>{proxyStatus?.blockedRequests ?? 0}</strong>
    </div>
    <div>
      <span>Allowed</span>
      <strong>{proxyStatus?.allowedRequests ?? 0}</strong>
    </div>
  </section>

  <section class="panel">
    <div class="section-heading">
      <h2>Ad Blocking</h2>
      <p>{proxyStatus?.url ?? 'Proxy starts with the native shell.'}</p>
    </div>

    <div class="rows">
      <label>
        <span>
          <strong>Enable ad blocking</strong>
          <small>Use native proxy plus renderer request interception.</small>
        </span>
        <input
          type="checkbox"
          checked={Boolean(config?.adblock.enabled)}
          onchange={(event) =>
            setAdblockFlag('enabled', (event.currentTarget as HTMLInputElement).checked)}
        />
      </label>
      <label>
        <span>
          <strong>Block telemetry</strong>
          <small>Drop stats, tracking, and event log endpoints.</small>
        </span>
        <input
          type="checkbox"
          checked={Boolean(config?.adblock.blockTelemetry)}
          onchange={(event) =>
            setAdblockFlag('blockTelemetry', (event.currentTarget as HTMLInputElement).checked)}
        />
      </label>
      <label>
        <span>
          <strong>Preserve audio streams</strong>
          <small>Never block YouTube Music media segment URLs.</small>
        </span>
        <input
          type="checkbox"
          checked={Boolean(config?.adblock.preserveAudioStreams)}
          onchange={(event) =>
            setAdblockFlag(
              'preserveAudioStreams',
              (event.currentTarget as HTMLInputElement).checked,
            )}
        />
      </label>
    </div>
  </section>

  <section class="panel">
    <div class="section-heading">
      <h2>Plugins</h2>
      <p>Renderer plugins use the Tauri bridge and Rust commands.</p>
    </div>

    <div class="plugin-list">
      {#each pluginRegistry as plugin}
        <article>
          <div>
            <h3>{plugin.name}</h3>
            <p>{plugin.description}</p>
          </div>
          <input
            aria-label={`Enable ${plugin.name}`}
            type="checkbox"
            checked={isPluginEnabled(plugin.id)}
            onchange={(event) =>
              setPluginEnabled(plugin.id, (event.currentTarget as HTMLInputElement).checked)}
          />
        </article>
      {/each}
    </div>
  </section>
</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #edf1f5;
    background: #111315;
  }

  .shell {
    min-height: 100vh;
    padding: 28px;
    display: grid;
    align-content: start;
    gap: 20px;
  }

  .topbar,
  .status-band,
  .panel {
    width: min(1060px, 100%);
    margin: 0 auto;
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .kicker {
    margin: 0 0 4px;
    color: #4fd1b3;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  h1,
  h2,
  h3,
  p {
    margin: 0;
  }

  h1 {
    font-size: 1.8rem;
    line-height: 1.15;
  }

  button {
    min-height: 36px;
    padding: 0 14px;
    border: 1px solid #3b444d;
    border-radius: 6px;
    color: #edf1f5;
    background: #1d2329;
    font: inherit;
    cursor: pointer;
  }

  button:disabled {
    color: #77818b;
    cursor: progress;
  }

  .notice {
    width: min(1060px, 100%);
    margin: 0 auto;
    padding: 12px 14px;
    border: 1px solid #7d3838;
    border-radius: 6px;
    color: #ffd9d9;
    background: #2b1717;
  }

  .status-band {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border: 1px solid #293038;
    border-radius: 8px;
    overflow: hidden;
    background: #171b1f;
  }

  .status-band div {
    min-width: 0;
    padding: 16px;
    display: grid;
    gap: 6px;
    border-right: 1px solid #293038;
  }

  .status-band div:last-child {
    border-right: 0;
  }

  .status-band span,
  .section-heading p,
  small,
  .plugin-list p {
    color: #9aa6b2;
  }

  .status-band strong {
    overflow-wrap: anywhere;
    font-size: 1.2rem;
  }

  .panel {
    padding: 20px;
    border: 1px solid #293038;
    border-radius: 8px;
    background: #171b1f;
  }

  .section-heading {
    display: grid;
    gap: 6px;
    margin-bottom: 18px;
  }

  h2 {
    font-size: 1.05rem;
  }

  .rows,
  .plugin-list {
    display: grid;
    gap: 1px;
    overflow: hidden;
    border: 1px solid #293038;
    border-radius: 6px;
  }

  label,
  .plugin-list article {
    min-height: 66px;
    padding: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    background: #12161a;
  }

  label span,
  .plugin-list article div {
    min-width: 0;
    display: grid;
    gap: 4px;
  }

  input[type='checkbox'] {
    width: 42px;
    height: 22px;
    flex: 0 0 auto;
    accent-color: #4fd1b3;
  }

  @media (max-width: 720px) {
    .shell {
      padding: 18px;
    }

    .topbar {
      align-items: flex-start;
      flex-direction: column;
    }

    .status-band {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .status-band div:nth-child(2) {
      border-right: 0;
    }

    .status-band div:nth-child(-n + 2) {
      border-bottom: 1px solid #293038;
    }
  }
</style>
