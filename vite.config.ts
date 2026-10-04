import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    base: './', // 👈 افزودن مسیر نسبی جهت بارگذاری درست فایل‌های CSS و JS در Netlify
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'), // 👈 جایگزینی import.meta.dirname برای رفع هشدار __dirname
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});