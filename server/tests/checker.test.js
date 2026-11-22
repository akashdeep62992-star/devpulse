import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCheck } from '../src/services/checker.js';
import { evaluate, FAILURE_THRESHOLD } from '../src/services/monitorState.js';
import { isPrivateAddress } from '../src/services/urlGuard.js';

let server;
let base;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/ok') return res.end('fine');
    if (req.url === '/error') return res.writeHead(500).end();
    if (req.url === '/redirect') return res.writeHead(302, { Location: '/ok' }).end();
    // '/hang' never responds
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => server.closeAllConnections() || server.close());

const check = (path, extra = {}) => runCheck({ url: base + path, timeoutMs: 2000, ...extra }, { allowPrivate: true });

describe('runCheck', () => {
  it('reports a healthy endpoint as ok', async () => {
    const r = await check('/ok');
    expect(r).toMatchObject({ ok: true, statusCode: 200, error: null });
    expect(r.responseTime).toBeGreaterThanOrEqual(0);
  });

  it('reports 5xx as failure', async () => {
    expect(await check('/error')).toMatchObject({ ok: false, statusCode: 500 });
  });

  it('treats redirects as up without following them', async () => {
    expect(await check('/redirect')).toMatchObject({ ok: true, statusCode: 302 });
  });

  it('honours expectedStatus', async () => {
    expect((await check('/error', { expectedStatus: 500 })).ok).toBe(true);
    expect((await check('/ok', { expectedStatus: 204 })).ok).toBe(false);
  });

  it('times out slow endpoints', async () => {
    const r = await check('/hang', { timeoutMs: 1000 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Timed out after 1000ms/);
  });

  it('refuses private targets unless allowed', async () => {
    const r = await runCheck({ url: `${base}/ok` }, { allowPrivate: false });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not allowed/);
  });
});

describe('isPrivateAddress', () => {
  it.each([
    ['127.0.0.1', true], ['10.0.0.5', true], ['192.168.1.1', true], ['172.20.0.1', true],
    ['169.254.169.254', true], ['::1', true], ['fd00::1', true], ['::ffff:127.0.0.1', true],
    ['8.8.8.8', false], ['93.184.215.14', false], ['2606:4700::1111', false],
  ])('%s -> %s', (ip, expected) => expect(isPrivateAddress(ip)).toBe(expected));
});

describe('evaluate (state machine)', () => {
  const ok = { ok: true };
  const fail = { ok: false };

  it('goes up on first success', () => {
    expect(evaluate({ status: 'pending', consecutiveFailures: 0 }, ok)).toEqual({ status: 'up', consecutiveFailures: 0, event: null });
  });

  it(`only goes down after ${FAILURE_THRESHOLD} consecutive failures`, () => {
    const first = evaluate({ status: 'up', consecutiveFailures: 0 }, fail);
    expect(first).toEqual({ status: 'up', consecutiveFailures: 1, event: null });
    const second = evaluate({ status: 'up', consecutiveFailures: 1 }, fail);
    expect(second).toEqual({ status: 'down', consecutiveFailures: 2, event: 'down' });
  });

  it('does not re-alert while already down', () => {
    expect(evaluate({ status: 'down', consecutiveFailures: 5 }, fail).event).toBeNull();
  });

  it('emits recovered when coming back up', () => {
    expect(evaluate({ status: 'down', consecutiveFailures: 3 }, ok)).toEqual({ status: 'up', consecutiveFailures: 0, event: 'recovered' });
  });
});
