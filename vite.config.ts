import { defineConfig } from 'vite';

// base './' hält alle Pfade relativ, damit der Build unter jeder Adresse läuft.
export default defineConfig({
  base: './',
  // pinyin-pro bringt ein großes Wörterbuch mit (~250 kB gzip), das ist gewollt.
  build: { chunkSizeWarningLimit: 1200 },
});
