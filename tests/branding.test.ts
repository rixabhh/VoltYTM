import { describe, expect, it } from 'vitest';

import packageJson from '../package.json';
import tauriConfig from '../src-tauri/tauri.conf.json';

describe('VoltYTM branding', () => {
  it('uses the VoltYTM product identity in package metadata and Tauri config', () => {
    expect(packageJson.name).toBe('voltytm');
    expect(packageJson.repository.url).toBe('https://github.com/rixabhh/VoltYTM');
    expect(tauriConfig.productName).toBe('VoltYTM');
    expect(tauriConfig.identifier).toBe('com.rixabhh.voltytm');
  });
});
