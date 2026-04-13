import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/offer': 'http://localhost:8010',
      '/human': 'http://localhost:8010',
      '/humanaudio': 'http://localhost:8010',
      '/record': 'http://localhost:8010',
      '/interrupt_talk': 'http://localhost:8010',
      '/is_speaking': 'http://localhost:8010',
      '/set_audiotype': 'http://localhost:8010',
      '/avatar': 'http://localhost:8010',
      '/system': 'http://localhost:8010',
      '/video': 'http://localhost:8010',
      '/celebrity': 'http://localhost:8010',
      '/llm': 'http://localhost:8010',
    },
  },
})
