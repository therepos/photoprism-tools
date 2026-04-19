import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/praxis/',
  plugins: [react()],
  build: { outDir: 'dist' },
});
