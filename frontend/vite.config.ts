import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The dev server proxies /api to the Go API so the browser sees a single
// origin: the session cookie stays first-party and no CORS is needed.
// 127.0.0.1 (not "localhost"): Node may resolve localhost to IPv6 ::1 while
// the API listens on IPv4 only.
const apiTarget = process.env.MF_API_PROXY ?? "http://127.0.0.1:8080";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Localhost only by default. Docker Compose passes --host 0.0.0.0.
    // 5180 instead of Vite's default 5173 so it never collides with other
    // local Vite projects (a collision silently serves the WRONG app).
    port: 5180,
    strictPort: true,
    proxy: { "/api": { target: apiTarget, changeOrigin: false } },
  },
});
