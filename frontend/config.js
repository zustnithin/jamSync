/* =============================================
   JAMSYNC — shared config (loaded first on every page)
   Local dev  → http://localhost:5000
   Deployed   → paste the Render backend URL below once,
                 every deployed page then uses it automatically.
   (window props on purpose: plain const would clash
    across script files.)
============================================= */

window.PROD_BACKEND_URL = 'https://jamsync-41h0.onrender.com'; // TODO: e.g. 'https://jamsync-xxxx.onrender.com'

(function () {
  var host = (typeof location !== 'undefined' && location.hostname) || '';
  var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '';
  window.BACKEND_URL = isLocal ? 'http://localhost:5000' : window.PROD_BACKEND_URL;
  window.API_BASE = window.BACKEND_URL + '/api';
})();
