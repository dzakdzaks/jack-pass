import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { buildCsp } from "./security/csp";
import { productionSecurityHeaders } from "./security/headers";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const isProduction = mode === "production";
  const csp = buildCsp(isProduction);

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        // Inject CSP meta tag into index.html (dev + build).
        name: "jackpass-csp",
        transformIndexHtml(html) {
          return html.replace(
            "<!--CSP-->",
            `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
          );
        },
      },
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icons/favicon.svg", "robots.txt"],
        manifest: {
          name: "JackPass",
          short_name: "JackPass",
          description:
            "Zero-knowledge password manager. Your vault is encrypted on-device and stored in your Google Drive.",
          theme_color: "#0052ff",
          background_color: "#0a0b0d",
          display: "standalone",
          orientation: "portrait",
          start_url: "/",
          scope: "/",
          icons: [
            {
              src: "icons/icon.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any",
            },
            {
              src: "icons/icon-maskable.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "maskable",
            },
          ],
          shortcuts: [
            { name: "Add credential", url: "/credentials/new" },
            { name: "Generate password", url: "/generator" },
          ],
        },
        workbox: {
          // App-shell precache only. Never cache vault data or Google API responses.
          globPatterns: ["**/*.{js,css,html,svg,woff2}"],
          navigateFallback: "index.html",
          runtimeCaching: [],
          navigateFallbackDenylist: [/^\/api/],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(projectRoot, "src"),
      },
    },
    build: {
      sourcemap: false,
      target: "es2022",
      minify: "esbuild",
      cssMinify: true,
      rollupOptions: {
        output: {
          // Avoid predictable chunk names that aid fingerprinting across deploys.
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
        },
      },
    },
    server: {
      port: 3000,
      strictPort: true,
    },
    preview: {
      port: 3000,
      strictPort: true,
      headers: isProduction ? productionSecurityHeaders() : undefined,
    },
  };
});
