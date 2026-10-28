import { defineConfig } from "vite";
const builtAt = new Date().toISOString();
export default defineConfig({
  define: { __BUILD_TIME__: JSON.stringify(builtAt) },
  plugins: [{
    name: 'build-info',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify({ builtAt }) });
    },
  }],
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
});
