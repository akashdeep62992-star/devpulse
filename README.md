# DevPulse - Uptime & API Monitoring

DevPulse checks your websites and APIs on a schedule, records response times, opens incidents when a service goes down, sends alerts, and publishes a public status page.

**Stack:** Node.js · Express 5 · MongoDB/Mongoose · React 19 · TanStack Query · Recharts · Tailwind CSS v4 · Vitest

## Features

- **JWT authentication** with bcrypt hashing and protection against discovering which emails are registered.
- **Monitors**: URL, method, check interval (30s to 1h), timeout and expected status code. You can pause and resume them.
- **Background scheduler** runs the checks with a limit on how many run at once. It claims each monitor with an atomic update, so the API can run on several servers without checking a monitor twice.
- **Incident detection** uses a pure state machine. A service is marked DOWN only after 2 failures in a row, which prevents false alerts. It is marked RECOVERED on the next success.
- **Alerts** go out by email through Nodemailer, or are printed to the console in development.
- **Analytics** use MongoDB aggregation pipelines to compute uptime %, average, minimum, maximum and **p95** response times, grouped into time buckets (24h / 7d / 30d).
- **Public status page** shows the last 30 days of uptime as daily bars. Monitor URLs are never shown publicly.
- **Security**: SSRF protection (blocks localhost, private networks and cloud metadata addresses, and doesn't follow redirects), Helmet, rate limiting, input validation with Zod, 10 KB body limit, and users can't access each other's monitors.
- **Data retention**: a MongoDB TTL index deletes check records after 30 days.

## Architecture

```
React (Vite) ──/api──▶ Express API ──▶ MongoDB
                           │              ▲
                           ▼              │
                     Scheduler (5s tick) ─┘
                           │ claims due monitors atomically
                           ▼
                     Checker (fetch + timeout + SSRF guard)
                           ▼
                     State machine ──▶ Incident + Alert
```

```
server/src
  app.js               Express app (middleware, routes)
  index.js             Entry point: DB + HTTP server + scheduler
  models/              User, Monitor, Check, Incident
  routes/              auth, monitors, status (public)
  services/
    scheduler.js       claims due monitors, runs a limited number at once
    checker.js         performs one HTTP check
    monitorState.js    up/down state machine (pure, unit tested)
    monitorService.js  saves results, incidents, alerts
    urlGuard.js        SSRF protection
client/src
  pages/               Dashboard, MonitorDetail, StatusPage, AuthPage
  components/          Layout, MonitorForm, StatusBadge
```

## Getting started

Requires Node.js 20 or newer.

```bash
# 1. Backend
cd server
cp .env.example .env      # leave MONGO_URI empty to use the built-in local MongoDB
npm install
npm run dev               # http://localhost:4000

# 2. Frontend (new terminal)
cd client
npm install
npm run dev               # http://localhost:5173
```

If `MONGO_URI` is empty, the server starts a built-in MongoDB that keeps its data in `server/.data/db`. To use a real database, create a free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas) and paste its connection string into `MONGO_URI`.

To monitor `localhost` services while developing, set `ALLOW_PRIVATE_TARGETS=true` in `.env`.

## Tests

```bash
cd server && npm test
```

29 tests cover authentication, validation, users being unable to access each other's data, SSRF blocking, the analytics numbers, the public status page, the HTTP checker (timeouts, redirects, expected status) and the state machine.

## API

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create an account and get a JWT |
| POST | `/api/auth/login` | Log in and get a JWT |
| GET | `/api/auth/me` | Get the current user |
| GET | `/api/monitors` | List monitors with 24h uptime and average response time |
| POST | `/api/monitors` | Create a monitor |
| GET / PATCH / DELETE | `/api/monitors/:id` | Read, update (including pause or resume) or delete a monitor |
| POST | `/api/monitors/:id/check` | Run a check now (rate limited) |
| GET | `/api/monitors/:id/stats?range=24h\|7d\|30d` | Summary and time-bucketed series |
| GET | `/api/monitors/:id/checks?limit=50` | Raw check log |
| GET | `/api/monitors/:id/incidents` | Incident history |
| GET | `/api/status/:slug` | Public status page data (no login needed) |

## Deploy (Render, free)

The repo includes a [Render Blueprint](render.yaml) that runs the API and serves the built React app from a single web service.

1. Create a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster, add a database user, allow access from `0.0.0.0/0` and copy the connection string.
2. In Render: **New > Blueprint**, pick this repo, and paste the Atlas URI as `MONGO_URI`. `JWT_SECRET` is generated automatically.

Note: free Render services sleep after ~15 minutes without traffic, which pauses scheduled checks until the next request.

## Roadmap

- [ ] Move the scheduler to a **BullMQ + Redis** job queue running in a separate worker process
- [ ] Telegram, Slack and Discord alerts through webhooks
- [ ] Docker Compose setup and a GitHub Actions workflow that runs the tests
- [ ] Checks for SSL certificate expiry and for keywords in the response
- [ ] Swagger/OpenAPI documentation
