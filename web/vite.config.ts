// SPDX-FileCopyrightText: 2026 Junctura Contributors
// SPDX-License-Identifier: Apache-2.0
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The identity provider only accepts redirects to the registered web port (5183), so the
// dev server uses it and forwards the API to the MyHealth server (`PORT=5193 npm run dev:server`).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5183,
    strictPort: true,
    proxy: { "/api": process.env.MYHEALTH_API ?? "http://127.0.0.1:5193" },
  },
  test: { environment: "node" },
});
