// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Adapter: Cloudflare for production, Node for local dev
const isCloudflare = !!process.env.CF_PAGES;

const adapter = isCloudflare
  ? (await import('@astrojs/cloudflare')).default()
  : (await import('@astrojs/node')).default({ mode: 'standalone' });

export default defineConfig({
  output: 'server',
  adapter,
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
