# Implementation Plan

## Phase 1: Setup

- [x] Initialize the Node.js project skeleton for the Express API and dashboard entry points.
- [x] Add shared environment configuration and validation for the SRS-required variables.
- [x] Add Docker Compose for the app, Redis 7, MongoDB 7, and Bull Board.
- [x] Add the base Express middleware stack: Helmet, production CORS restriction, and request logging.
- [x] Add the `/health` endpoint with Redis and MongoDB connectivity checks plus queue depth.

## Phase 2: Core Models

- [ ] Define the MongoDB `urls` collection schema with unique slug and expiry indexes.
- [ ] Define the MongoDB `clicks` collection schema with analytics and TTL indexes.
- [ ] Add the shared data access layer for URL documents and click documents.

## Phase 3: URL Shortening API

- [ ] Implement Zod validation for shorten requests, including long URL, optional custom slug, and optional expiry.
- [ ] Implement default slug generation with Base62 encoding and collision retry behavior.
- [ ] Implement `POST /api/shorten` to create URL records and return the shortened URL payload.
- [ ] Cache newly created URLs in Redis with the required redirect TTL.

## Phase 4: Redirect Path

- [ ] Implement Redis-first lookup for `GET /:slug` with MongoDB fallback and cache repopulation.
- [ ] Add soft-expiry handling so expired URLs return `404` even if a stale Redis entry exists.
- [ ] Enqueue click events asynchronously on successful redirects without blocking the response.
- [ ] Apply the redirect rate limit and return the required rate-limit headers and `429` response.

## Phase 5: Click Ingestion Pipeline

- [ ] Define the click event payload with slug, timestamp, hashed IP, user-agent, referrer, and country.
- [ ] Implement the BullMQ click-events queue with the required retry and backoff settings.
- [ ] Implement the batch worker that flushes clicks in groups of 50 or every 5 seconds, whichever comes first.
- [ ] Update URL click counters during batch flush using bulk MongoDB writes.
- [ ] Route exhausted click jobs to a DLQ and expose the queue state through Bull Board.

## Phase 6: Analytics API

- [ ] Implement the MongoDB aggregation pipelines for total clicks, clicks per day, top referrers, and top countries.
- [ ] Implement `GET /api/analytics/:slug` using aggregation results and Redis caching with a 60-second TTL.
- [ ] Apply the analytics rate limit defined in the SRS.

## Phase 7: Frontend Dashboard

- [ ] Build the shorten form and result display for the dashboard.
- [ ] Build the analytics summary cards for total clicks, top referrer, and date created.
- [ ] Build the Chart.js clicks-per-day line chart for a slug.

## Phase 8: Testing and Delivery

- [ ] Add unit tests for slug generation, URL validation, and sliding-window rate limiting.
- [ ] Add integration tests for shorten, redirect, analytics, and health endpoint behavior.
- [ ] Add GitHub Actions to run linting, tests, and the production build on pushes to `main`.
- [ ] Add production deployment configuration for Railway backend services and the Vercel dashboard build.
