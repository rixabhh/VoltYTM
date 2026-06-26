import sharp from 'sharp';
import { readdir } from 'fs/promises';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = join(ROOT, 'assets', 'icon.svg');
const TRAY_SRC = join(ROOT, 'assets', 'tray-icon.svg');
const OUT = join(ROOT, 'src-tauri', 'icons');

const MAIN_SIZES = [
  { name: '32x32.png', size: 32 },
  { name: '64x64.png', size: 64 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: 'icon.png', size: 1024 },
];

const WINDOWS_SIZES = [
  { name: 'Square30x30Logo.png', size: 30 },
  { name: 'Square44x44Logo.png', size: 44 },
  { name: 'Square71x71Logo.png', size: 71 },
  { name: 'Square89x89Logo.png', size: 89 },
  { name: 'Square107x107Logo.png', size: 107 },
  { name: 'Square142x142Logo.png', size: 142 },
  { name: 'Square150x150Logo.png', size: 150 },
  { name: 'Square284x284Logo.png', size: 284 },
  { name: 'Square310x310Logo.png', size: 310 },
  { name: 'StoreLogo.png', size: 50 },
];

const TRAY_SIZES = [
  { name: 'tray-icon.png', size: 32 },
];

async function generateIcons() {
  console.log('Generating main icons...');
  for (const { name, size } of MAIN_SIZES) {
    await sharp(SRC).resize(size, size).png().toFile(join(OUT, name));
    console.log(`  ${name} (${size}x${size})`);
  }

  console.log('Generating Windows icons...');
  for (const { name, size } of WINDOWS_SIZES) {
    await sharp(SRC).resize(size, size).png().toFile(join(OUT, name));
    console.log(`  ${name} (${size}x${size})`);
  }

  console.log('Generating tray icons...');
  for (const { name, size } of TRAY_SIZES) {
    await sharp(TRAY_SRC).resize(size, size).png().toFile(join(OUT, name));
    console.log(`  ${name} (${size}x${size})`);
  }

  console.log('Done! All icons generated.');
}

generateIcons().catch(console.error);
