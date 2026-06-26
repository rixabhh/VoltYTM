import { bridge } from '@/lib/bridge';
import type { Plugin, PluginConfig, PluginContext, PluginRuntime } from '@/types/plugin';

export function createPlugin<TConfig extends PluginConfig>(plugin: Plugin<TConfig>): Plugin<TConfig> {
  return plugin;
}

export async function startPlugin<TConfig extends PluginConfig>(
  plugin: Plugin<TConfig>,
): Promise<PluginRuntime<TConfig>> {
  const appConfig = await bridge.getConfig();
  const pluginConfig = {
    ...plugin.defaultConfig,
    ...(appConfig.plugins[plugin.id] ?? {}),
  } as TConfig;

  const context: PluginContext<TConfig> = {
    config: pluginConfig,
    getConfig: async () => {
      const latest = await bridge.getConfig();
      return {
        ...plugin.defaultConfig,
        ...(latest.plugins[plugin.id] ?? {}),
      } as TConfig;
    },
    setConfig: async (key, value) => {
      const latest = await bridge.setConfig(`plugins.${plugin.id}.${String(key)}`, value);
      return {
        ...plugin.defaultConfig,
        ...(latest.plugins[plugin.id] ?? {}),
      } as TConfig;
    },
    invoke: bridge.invoke,
    notify: bridge.showNotification,
  };

  const cleanup = await plugin.start(context);

  return {
    plugin,
    stop: typeof cleanup === 'function' ? cleanup : () => undefined,
  };
}
