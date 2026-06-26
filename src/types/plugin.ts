export type PluginConfigValue =
  | string
  | number
  | boolean
  | null
  | PluginConfigValue[]
  | { [key: string]: PluginConfigValue };

export type PluginConfig = Record<string, PluginConfigValue>;

export interface PluginContext<TConfig extends PluginConfig = PluginConfig> {
  config: TConfig;
  getConfig: () => Promise<TConfig>;
  setConfig: <K extends keyof TConfig>(key: K, value: TConfig[K]) => Promise<TConfig>;
  invoke: <T>(command: string, payload?: Record<string, unknown>) => Promise<T>;
  notify: (title: string, body: string) => Promise<void>;
}

export interface Plugin<TConfig extends PluginConfig = PluginConfig> {
  id: string;
  name: string;
  description: string;
  defaultConfig: TConfig;
  start: (context: PluginContext<TConfig>) => void | (() => void) | Promise<void | (() => void)>;
}

export interface PluginRuntime<TConfig extends PluginConfig = PluginConfig> {
  plugin: Plugin<TConfig>;
  stop: () => void;
}
