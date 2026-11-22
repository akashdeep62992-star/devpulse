import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { Check } from '../src/models/Check.js';
import { Monitor } from '../src/models/Monitor.js';

const app = createApp();
const PUBLIC_IP_URL = 'http://93.184.215.14/'; // public IP literal: no DNS needed in tests

async function registerUser(email = 'dev@example.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Dev User', email, password: 'supersecret123' });
  return { token: res.body.token, user: res.body.user };
}
const auth = (token) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  config.allowPrivateTargets = false;
  await connectDb('');
});
afterAll(disconnectDb);
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
});

describe('auth', () => {
  it('registers a user and never returns the password hash', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dev User', email: 'Dev@Example.com', password: 'supersecret123' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user.email).toBe('dev@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.statusSlug).toMatch(/^dev-user-[0-9a-f]{6}$/);
  });

  it('rejects duplicate emails and short passwords', async () => {
    await registerUser();
    const dup = await request(app)
      .post('/api/auth/register')
      .send({ name: 'X', email: 'dev@example.com', password: 'supersecret123' });
    expect(dup.status).toBe(409);
    const short = await request(app)
      .post('/api/auth/register')
      .send({ name: 'X', email: 'new@example.com', password: '123' });
    expect(short.status).toBe(400);
    expect(short.body.details[0].path).toBe('password');
  });

  it('logs in with correct credentials only', async () => {
    await registerUser();
    const good = await request(app).post('/api/auth/login').send({ email: 'dev@example.com', password: 'supersecret123' });
    expect(good.status).toBe(200);
    const me = await request(app).get('/api/auth/me').set(auth(good.body.token));
    expect(me.body.user.email).toBe('dev@example.com');

    const bad = await request(app).post('/api/auth/login').send({ email: 'dev@example.com', password: 'wrongpassword' });
    expect(bad.status).toBe(401);
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'x' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error).toBe(bad.body.error); // same message: no user enumeration
  });
});

describe('monitors', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/monitors')).status).toBe(401);
    expect((await request(app).get('/api/monitors').set(auth('garbage'))).status).toBe(401);
  });

  it('validates input and blocks private network targets (SSRF)', async () => {
    const { token } = await registerUser();
    const ftp = await request(app).post('/api/monitors').set(auth(token)).send({ name: 'x', url: 'ftp://example.com' });
    expect(ftp.status).toBe(400);
    for (const url of ['http://127.0.0.1:3000', 'http://169.254.169.254/latest/meta-data', 'http://[::1]/', 'http://10.1.2.3']) {
      const res = await request(app).post('/api/monitors').set(auth(token)).send({ name: 'x', url });
      expect(res.status, url).toBe(400);
    }
  });

  it('creates, lists, updates and deletes a monitor', async () => {
    const { token } = await registerUser();
    const created = await request(app)
      .post('/api/monitors')
      .set(auth(token))
      .send({ name: 'Example', url: PUBLIC_IP_URL, intervalSec: 120 });
    expect(created.status).toBe(201);
    const { id } = created.body.monitor;
    expect(created.body.monitor).toMatchObject({ name: 'Example', method: 'GET', intervalSec: 120, status: 'pending' });

    await Check.create([
      { monitor: id, ok: true, statusCode: 200, responseTime: 100 },
      { monitor: id, ok: true, statusCode: 200, responseTime: 300 },
      { monitor: id, ok: false, statusCode: 500, responseTime: 50 },
      { monitor: id, ok: true, statusCode: 200, responseTime: 200 },
    ]);
    const list = await request(app).get('/api/monitors').set(auth(token));
    expect(list.body.monitors).toHaveLength(1);
    expect(list.body.monitors[0].uptime24h).toBe(75);
    expect(list.body.monitors[0].avgResponse24h).toBe(200); // failed checks excluded

    const stats = await request(app).get(`/api/monitors/${id}/stats?range=24h`).set(auth(token));
    expect(stats.status).toBe(200);
    expect(stats.body.summary).toMatchObject({ totalChecks: 4, uptime: 75, avgResponse: 200, minResponse: 100, maxResponse: 300 });
    expect(stats.body.series.length).toBeGreaterThan(0);

    const paused = await request(app).patch(`/api/monitors/${id}`).set(auth(token)).send({ isActive: false });
    expect(paused.body.monitor.isActive).toBe(false);
    expect(paused.body.monitor.intervalSec).toBe(120); // partial update keeps other fields

    expect((await request(app).delete(`/api/monitors/${id}`).set(auth(token))).status).toBe(204);
    expect(await Check.countDocuments({ monitor: id })).toBe(0);
  });

  it("does not let users access each other's monitors", async () => {
    const alice = await registerUser('alice@example.com');
    const bob = await registerUser('bob@example.com');
    const created = await request(app).post('/api/monitors').set(auth(alice.token)).send({ name: 'A', url: PUBLIC_IP_URL });
    const { id } = created.body.monitor;
    expect((await request(app).get(`/api/monitors/${id}`).set(auth(bob.token))).status).toBe(404);
    expect((await request(app).delete(`/api/monitors/${id}`).set(auth(bob.token))).status).toBe(404);
    expect((await request(app).get('/api/monitors/not-an-id').set(auth(bob.token))).status).toBe(404);
  });
});

describe('public status page', () => {
  it('shows only public monitors and hides URLs', async () => {
    const { token, user } = await registerUser();
    await request(app).post('/api/monitors').set(auth(token)).send({ name: 'Public API', url: PUBLIC_IP_URL, isPublic: true });
    await request(app).post('/api/monitors').set(auth(token)).send({ name: 'Secret', url: PUBLIC_IP_URL });

    const res = await request(app).get(`/api/status/${user.statusSlug}`);
    expect(res.status).toBe(200);
    expect(res.body.monitors.map((m) => m.name)).toEqual(['Public API']);
    expect(res.body.monitors[0].url).toBeUndefined();
    expect(res.body.monitors[0].days).toHaveLength(30);
    expect((await request(app).get('/api/status/does-not-exist')).status).toBe(404);
    expect(await Monitor.countDocuments()).toBe(2);
  });
});
