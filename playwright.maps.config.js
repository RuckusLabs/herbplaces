import base from './playwright.config.js';

// Exercise the emitted worker and lazy chunks, rather than only Vite's dev server.
export default {
  ...base,
  testMatch: '**/freeMaps.spec.js',
  webServer: {
    ...base.webServer,
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4178 --strictPort',
    env: { ...base.webServer.env, VITE_MAPBOX_TOKEN: 'unused-old-token-must-not-enable-mapbox' },
  },
};
