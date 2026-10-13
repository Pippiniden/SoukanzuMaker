import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base を相対パスにしておくと、GitHub Pages のサブパス（/SoukanzuMaker/）でもそのまま動く
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1500 },
});
