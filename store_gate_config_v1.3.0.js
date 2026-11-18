// Pocket Play — Store Gate / SG18 configuration · v1.3.0 · © SCOUT SYSTEM
(function () {
  'use strict';

  const STORE_GATE_CONFIG = Object.freeze({
    version: 'v1.3.0',
    appKey: 'minigame',
    mode: 'entry-gate',
    portalIds: ['appstore'],
    silentPortalIds: ['library'],
    allowStandalone: true,
    autoRedirectSeconds: 0,
  });

  if (typeof window.initStoreGate !== 'function') return;

  window.initStoreGate({
    appKey: STORE_GATE_CONFIG.appKey,
    mode: STORE_GATE_CONFIG.mode,
    portalIds: STORE_GATE_CONFIG.portalIds,
    silentPortalIds: STORE_GATE_CONFIG.silentPortalIds,
    allowStandalone: STORE_GATE_CONFIG.allowStandalone,
    autoRedirectSeconds: STORE_GATE_CONFIG.autoRedirectSeconds,
  });

  // Keep the SG18 link hidden unless the official helper is available and returns a URL.
  document.addEventListener('DOMContentLoaded', function exposeStoreSupportLink() {
    const link = document.getElementById('storeSupportTop');
    const storeGate = window.ScoutStoreGate;
    if (!link || !storeGate || typeof storeGate.getAppStoreUrl !== 'function') return;

    try {
      const url = window.ScoutStoreGate.getAppStoreUrl('minigame');
      if (typeof url !== 'string' || !url) return;
      link.href = url;
      link.hidden = false;
    } catch (error) {
      // Keep the link hidden if the helper cannot build a valid destination.
    }
  }, { once: true });
})();
