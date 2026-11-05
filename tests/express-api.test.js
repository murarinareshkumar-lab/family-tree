import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import app from '../server/app.js';

function simulateExpressRequest(app, method, url, body = null, headers = {}) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.originalUrl = url;
    req.headers = {
      'content-type': 'application/json',
      ...headers
    };
    req.body = body;

    const res = new EventEmitter();
    res.statusCode = 200;
    res._headers = {};
    res.setHeader = (k, v) => { res._headers[k.toLowerCase()] = v; };
    res.getHeader = (k) => res._headers[k.toLowerCase()];
    res.status = (code) => { res.statusCode = code; return res; };

    let sentData = null;
    res.send = (data) => {
      sentData = data;
      resolve({ status: res.statusCode, data });
    };
    res.json = (json) => {
      sentData = json;
      resolve({ status: res.statusCode, json });
    };
    res.end = (data) => {
      resolve({ status: res.statusCode, data: data || sentData });
    };

    app.handle(req, res);
  });
}

test('Single Express App - Handles routes with /api and without /api identically', async () => {
  // 1. Health check with /api
  const resWithApi = await simulateExpressRequest(app, 'GET', '/api/health');
  assert.strictEqual(resWithApi.status, 200);
  assert.strictEqual(resWithApi.json.status, 'healthy');

  // 2. Health check without /api (when rewritten by vercel.json)
  const resWithoutApi = await simulateExpressRequest(app, 'GET', '/health');
  assert.strictEqual(resWithoutApi.status, 200);
  assert.strictEqual(resWithoutApi.json.status, 'healthy');

  // 3. Surnames listing
  const resSurnames = await simulateExpressRequest(app, 'GET', '/api/surnames');
  assert.strictEqual(resSurnames.status, 200);
  assert.strictEqual(Array.isArray(resSurnames.json.surnames), true);

  // 4. Surname Search route
  const resSearch = await simulateExpressRequest(app, 'GET', '/api/surnames/search?q=Murari');
  assert.strictEqual(resSearch.status, 200);
  assert.strictEqual(resSearch.json.ok, true);

  // 5. Friendly 404 handler - never returns raw technical NOT_FOUND
  const res404 = await simulateExpressRequest(app, 'GET', '/api/unknown-endpoint-xyz');
  assert.strictEqual(res404.status, 404);
  assert.strictEqual(res404.json.ok, false);
  assert.strictEqual(typeof res404.json.error, 'string');
  assert.match(res404.json.error, /unavailable|not found/i);

  // 6. Friendly validation error on invalid requests body
  const resBadReq = await simulateExpressRequest(app, 'POST', '/api/requests', {});
  assert.strictEqual(resBadReq.status, 400);
  assert.strictEqual(typeof resBadReq.json.error, 'string');
});
