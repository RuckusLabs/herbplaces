import base from './playwright.config.js';
export default {
  ...base,
  testIgnore: [],
  testMatch: '**/passwordless.spec.js',
  webServer: { ...base.webServer, env: { ...base.webServer.env, VITE_PASSWORDLESS_ENABLED: 'true' } },
};
