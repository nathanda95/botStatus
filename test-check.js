const isServerUp = require('./checkServer');

// fetch fallback
let fetchFn = globalThis.fetch;
if (!fetchFn) {
  const nf = require('node-fetch');
  fetchFn = nf.default || nf;
}

async function verboseCheckUrl(url) {
  console.log(`Checking URL (HEAD then GET): ${url}`);
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    const res = await fetchFn(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(id);
    console.log(`HEAD status: ${res.status} ${res.statusText}`);
    console.log('OK (HEAD)?', res.ok);
    return res.ok;
  } catch (e) {
    console.log('HEAD failed:', e.message || e);
    try {
      const controller2 = new AbortController();
      const id2 = setTimeout(() => controller2.abort(), 5000);
      const res2 = await fetchFn(url, { method: 'GET', signal: controller2.signal });
      clearTimeout(id2);
      console.log(`GET status: ${res2.status} ${res2.statusText}`);
      console.log('OK (GET)?', res2.ok);
      return res2.ok;
    } catch (err) {
      console.log('GET failed:', err.message || err);
      return false;
    }
  }
}

(async () => {
  console.log('Test HTTP https://example.com');
  const ok1 = await verboseCheckUrl('https://example.com');
  console.log('example.com OK?', ok1);

  console.log('\nTest HTTP https://nodejs.org');
  const okNode = await verboseCheckUrl('https://nodejs.org');
  console.log('nodejs.org OK?', okNode);

  console.log('\nTest TCP google.com:80');
  const resTcp = await isServerUp('google.com', 80);
  console.log('google.com:80 result:', resTcp);

  console.log('\nTest invalid URL');
  const ok3 = await verboseCheckUrl('http://nonexistent.invalid.example');
  console.log('invalid OK?', ok3);
})();