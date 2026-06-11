/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    target: ['es2015', 'safari13', 'ios13', 'chrome79', 'edge79'],
  },
})
