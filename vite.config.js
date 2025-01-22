import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use '/src/styles/index.scss' as *;`,
      },
    },
  },
  base: '/',
  plugins: [react()],
})
