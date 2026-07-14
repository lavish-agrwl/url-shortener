# Implementation Plan

## Phase 1: Setup

- [x] Initialize the Node.js project skeleton for the Express API and dashboard entry points.
- [x] Add shared environment configuration and validation for the SRS-required variables.
- [x] Add Docker Compose for the app, Redis 7, MongoDB 7, and Bull Board.
- [x] Add the base Express middleware stack: Helmet, production CORS restriction, and request logging.
- [x] Add the `/health` endpoint with Redis and MongoDB connectivity checks plus queue depth.

## Phase 2: Core Models

- [x] Define the MongoDB `urls` collection schema with unique slug and expiry indexes.
- [x] Define the MongoDB `clicks` collection schema with analytics and TTL indexes.
- [x] Add the shared data access layer for URL documents and click documents.

## Phase 3: URL Shortening API

- [x] Implement Zod validation for shorten requests, including long URL, optional custom slug, and optional expiry.
- [x] Implement default slug generation with Base62 encoding and collision retry behavior.
- [x] Implement `POST /api/shorten` to create URL records and return the shortened URL payload.
- [x] Cache newly created URLs in Redis with the required redirect TTL.

## Phase 4: Redirect Path

- [x] Implement Redis-first lookup for `GET /:slug` with MongoDB fallback and cache repopulation.
- [x] Add soft-expiry handling so expired URLs return `404` even if a stale Redis entry exists.
- [x] Enqueue click events asynchronously on successful redirects without blocking the response.
- [x] Apply the redirect rate limit and return the required rate-limit headers and `429` response.

## Phase 5: Click Ingestion Pipeline

- [x] Define the click event payload with slug, timestamp, hashed IP, user-agent, referrer, and country.
- [x] Implement the BullMQ click-events queue with the required retry and backoff settings.
- [x] Implement the batch worker that flushes clicks in groups of 50 or every 5 seconds, whichever comes first.
- [x] Update URL click counters during batch flush using bulk MongoDB writes.
- [x] Route exhausted click jobs to a DLQ and expose the queue state through Bull Board.

## Phase 6: Analytics API

- [x] Implement the MongoDB aggregation pipelines for total clicks, clicks per day, top referrers, and top countries.
- [x] Implement `GET /api/analytics/:slug` using aggregation results and Redis caching with a 60-second TTL.
- [x] Apply the analytics rate limit defined in the SRS.

## Phase 7: Frontend Dashboard

- [x] Rebuild the dashboard using plain HTML/CSS/vanilla JS (no frameworks).
- [x] Implement URL shortening form with copy-to-clipboard.
- [x] Implement analytics view with Chart.js and referrer breakdown.
- [x] Implement health status polling badge.
- [x] Handle loading and error states visually.

## Phase 8: Testing and Delivery

- [x] Add unit tests for slug generation, URL validation, and sliding-window rate limiting.
- [x] Add integration tests for shorten, redirect, analytics, and health endpoint behavior.
- [x] Add GitHub Actions to run linting, tests, and the production build on pushes to `main`.
- [ ] Add production deployment configuration for Railway backend services and the Vercel dashboard build.

## Phase 9: Modernized Dashboard

- [x] Restructure project into `/backend` and `/frontend` directories.
- [x] Initialize Vite + React + TypeScript project in `/frontend`.
- [x] Configure Tailwind CSS and ShadCN UI components.
- [x] Implement React Query hooks for URLs, analytics, and shortening with optimistic UI updates.
- [x] Build the main dashboard with ShadCN Table for live link tracking and a shortening form.
- [x] Implement per-link analytics view with Chart.js and ShadCN metric cards.
- [x] Add system health polling badge in the navigation bar.
- [ ] Configure CORS in the backend to allow the frontend dev server.
- [ ] Set up a production build pipeline to serve the React app via Express.