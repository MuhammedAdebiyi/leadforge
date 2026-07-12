# LeadForge

LeadForge is a distributed lead generation platform that discovers local businesses, evaluates them against configurable qualification rules, enriches available contact information, and delivers qualified leads through multiple channels.

The platform is designed around asynchronous processing and message-driven architecture. Long-running operations such as searching, website analysis, email enrichment, exports, and Telegram delivery are executed by dedicated worker services instead of the API request lifecycle.

The project is intended to be production-oriented and demonstrates patterns commonly used in scalable backend systems.

---

## Architecture

```
                  Client
                     │
                     ▼
              Fastify REST API
                     │
          Creates Lead Search Job
                     │
                     ▼
               RabbitMQ Queue
                     │
    ┌────────────────┼────────────────┐
    ▼                ▼                ▼
Search Worker   Website Worker   Email Worker
    │                │                │
    └──────────────┬──────────────────┘
                   ▼
             PostgreSQL (Supabase)
                   │
                   ▼
                 Redis
          (Caching / Progress)
                   │
                   ▼
          Export / Telegram Workers
```

---

## Tech Stack

### Backend

- Node.js
- TypeScript
- Fastify
- Prisma ORM
- PostgreSQL (Supabase)

### Infrastructure

- RabbitMQ (CloudAMQP)
- Redis (Upstash)
- TurboRepo
- Docker (planned)

### Workers

- Search Worker
- Website Worker
- Email Worker
- Telegram Worker
- Export Worker

---

## Repository Structure

```
leadforge/

├── apps/
│   └── api/
│
├── workers/
│   ├── search-worker/
│   ├── website-worker/
│   ├── email-worker/
│   ├── telegram-worker/
│   └── export-worker/
│
├── packages/
│   └── shared/
│
├── docs/
├── infra/
└── scripts/
```

---

## Design Principles

The system follows a number of engineering principles intended to make it reliable under load.

### Queue First

API requests should return as quickly as possible.

Instead of performing expensive work inside the HTTP request, the API creates a job and publishes it to RabbitMQ.

Workers consume jobs independently.

---

### Background Processing

Searching businesses

Checking websites

Finding email addresses

Generating exports

Sending Telegram messages

are all handled asynchronously.

---

### Worker Isolation

Each worker has a single responsibility.

| Worker | Responsibility |
|---------|----------------|
| Search Worker | Business discovery |
| Website Worker | Website validation |
| Email Worker | Email enrichment |
| Telegram Worker | Message delivery |
| Export Worker | CSV/Excel exports |

Workers can scale independently depending on demand.

---

### Stateless API

The API keeps no application state in memory.

All persistent state lives in PostgreSQL or Redis, allowing multiple API instances to run behind a load balancer.

---

### Message Driven Communication

Services communicate through RabbitMQ rather than direct service calls.

Benefits include:

- retry support
- loose coupling
- horizontal scaling
- fault isolation

---

### Caching

Redis is used for:

- job progress
- API caching
- search caching
- rate limiting
- temporary processing data

This reduces unnecessary database queries and external API calls.

---

### Database

PostgreSQL stores persistent application data.

Current models include:

- Users
- Jobs
- Businesses
- Refresh Tokens
- Worker Logs
- Telegram Logs
- Job Progress

Prisma manages schema generation and migrations.

---

## Job Lifecycle

```
Client

↓

POST /jobs

↓

Job Created

↓

RabbitMQ

↓

Search Worker

↓

Businesses Saved

↓

Website Worker

↓

Email Worker

↓

Qualified Lead

↓

Telegram / Export Worker

↓

Completed
```

---

## Request Flow

```
HTTP Request

↓

Validation

↓

Authentication

↓

Business Logic

↓

Database

↓

Publish Queue Message

↓

HTTP Response
```

The API never waits for scraping or enrichment to finish before responding.

---

## Environment Variables

```
DATABASE_URL=

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

CLOUDAMQP_URL=

JWT_SECRET=
JWT_REFRESH_SECRET=

TELEGRAM_BOT_TOKEN=

PORT=3000
NODE_ENV=development
```

---

## Local Development

Install dependencies.

```bash
npm install
```

Generate the Prisma client.

```bash
cd apps/api

npx prisma generate
```

Synchronize the database schema.

```bash
npx prisma db push
```

Run the API.

```bash
npm run dev
```

Run the entire workspace.

```bash
npm run dev
```

---

## Database Commands

Generate Prisma Client.

```bash
npx prisma generate
```

Push schema.

```bash
npx prisma db push
```

Create migration.

```bash
npx prisma migrate dev
```

Open Prisma Studio.

```bash
npx prisma studio
```

---

## Reliability Features

The system is designed with production behaviour in mind.

### Retry Support

Failed jobs can be retried by workers.

---

### Dead Letter Queue

Messages that repeatedly fail processing are moved into a dead-letter queue instead of being discarded.

---

### Structured Logging

All services use structured logs for easier debugging and monitoring.

---

### Graceful Shutdown

Workers and the API close database and RabbitMQ connections before terminating.

---

### Type Safety

TypeScript is used across the entire monorepo.

Shared types and queue contracts live inside the shared package.

---

## Future Improvements

- Distributed worker autoscaling
- WebSocket progress updates
- Email provider abstraction
- Proxy rotation
- Browser pool management
- Metrics collection
- OpenTelemetry tracing
- Prometheus integration
- Kubernetes deployment
- Distributed rate limiting
- Multi-tenant support

---

## Current Status

The core infrastructure is operational.

- Fastify API
- Prisma
- PostgreSQL
- Redis
- RabbitMQ
- TurboRepo workspace
- Shared package
- Worker architecture

Application features are being implemented incrementally on top of the infrastructure.

---

## License

MIT
