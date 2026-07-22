(() => {
  "use strict";

  const runtime = window.PATIENT_APP_ENV || {};
  window.PATIENT_APP_CONFIG = {
    API_BASE_URL: String(runtime.API_BASE_URL || "").trim(),
    STATUS_REFRESH_MS: Number(runtime.STATUS_REFRESH_MS) || 10000,
  };
})();
