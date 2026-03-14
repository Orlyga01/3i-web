(function initAppConfigShared(root) {
  'use strict';

  function normalizeUseLocalStorage(value) {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'yes' || normalized === 'true' || normalized === 'on' || normalized === '1') {
        return true;
      }
      if (normalized === 'no' || normalized === 'false' || normalized === 'off' || normalized === '0') {
        return false;
      }
    }

    return Boolean(value);
  }

  function readAppConfig(source) {
    const config = source && typeof source === 'object' ? source : {};
    return {
      useLocalStorage: normalizeUseLocalStorage(config.useLocalStorage),
    };
  }

  const api = {
    normalizeUseLocalStorage,
    readAppConfig,
  };

  root.AppConfigShared = api;

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
