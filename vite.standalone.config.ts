import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Build bản một-file: định dạng IIFE (không phải ES module) để nhúng thẳng vào HTML,
 *  chạy được cả khi mở bằng file:// hoặc khi máy chủ khai báo sai MIME type. */
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-standalone',
    cssCodeSplit: false,
    rollupOptions: {
      output: { format: 'iife', inlineDynamicImports: true, entryFileNames: 'app.js', assetFileNames: 'app.[ext]' },
    },
  },
});
