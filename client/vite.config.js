import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Địa chỉ server lấy từ biến VITE_SERVER_URL (mặc định http://localhost:3001) – xem src/lib/constants.js.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
});
