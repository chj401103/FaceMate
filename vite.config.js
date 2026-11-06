import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // localhost 와 127.0.0.1 어느 주소로 열어도 접속되도록 (IPv4·IPv6 모두 허용)
  server: { host: true, port: 5173, strictPort: true },
})
