const net = require('net');
const { URL } = require('url');

// Prefer global fetch (Node 18+). Fallback to node-fetch for older setups or when required.
let fetchFn = globalThis.fetch;
if (!fetchFn) {
  const nf = require('node-fetch');
  fetchFn = nf.default || nf;
}

/**
 * Vérifie si une ressource est joignable.
 * - Si on passe (host, port) : effectue un check TCP (comme avant)
 * - Si on passe une URL (string commençant par http:// ou https://) : effectue un fetch HEAD/GET
 * Retourne une Promise<boolean> et respecte un timeout de 5s.
 *
 * Accepté : isServerUp(host, port) OR isServerUp({ url: 'https://...' })
 */
async function isServerUp(a, b) {
  // cas URL passé comme objet ou string
  try {
    if (typeof a === 'object' && a !== null && a.url) {
      return await checkUrl(a.url);
    }

    if (typeof a === 'string' && a.startsWith('http')) {
      return await checkUrl(a);
    }
  } catch (e) {
    return { ok: false, latency: null };
  }

  // sinon on considère a=host, b=port (TCP)
  return await checkTcp(a, b);
}

function checkTcp(host, port, timeout = 5000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const start = Date.now();

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      settled = true;
      const latency = Date.now() - start;
      socket.destroy();
      resolve({ ok: true, latency });
    });

    const onFail = () => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch (e) {}
      resolve({ ok: false, latency: null });
    };

    socket.on('error', onFail);
    socket.on('timeout', onFail);

    try {
      socket.connect(port, host);
    } catch (e) {
      onFail();
    }
  });
}

async function checkUrl(rawUrl, timeout = 5000) {
  // Normalise l'URL
  let url;
  try {
    url = new URL(rawUrl);
  } catch (e) {
    return { ok: false, latency: null };
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    // On utilise HEAD d'abord (moins de bande passante), sinon GET si non supporté
    const start = Date.now();
    const res = await fetchFn(url.toString(), { method: 'HEAD', signal: controller.signal });
    clearTimeout(id);
    const latency = Date.now() - start;
    return { ok: res.ok, latency };
  } catch (err) {
    // si HEAD échoue (ex: 405), essaye GET
    try {
      const controller2 = new AbortController();
      const id2 = setTimeout(() => controller2.abort(), timeout);
      const start2 = Date.now();
      const res2 = await fetchFn(url.toString(), { method: 'GET', signal: controller2.signal });
      clearTimeout(id2);
      const latency2 = Date.now() - start2;
      return { ok: res2.ok, latency: latency2 };
    } catch (e) {
      return { ok: false, latency: null };
    }
  }
}

module.exports = isServerUp;