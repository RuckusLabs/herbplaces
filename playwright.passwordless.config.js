import base from './playwright.config.js';
export default {
  ...base,
  testIgnore: [],
  testMatch: '**/passwordless.spec.js',
  webServer: { ...base.webServer, command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4178 --strictPort', env: { ...base.webServer.env, VITE_PASSWORDLESS_ENABLED: 'true', VITE_BLOOM_ENABLED: 'false' } },
};
