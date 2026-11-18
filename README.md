<<<<<<< HEAD
# FixDesk

FixDesk is an IT support portal for finding troubleshooting guidance and submitting support requests. It has a React/Vite frontend, a Node.js HTTP API, and MongoDB storage.

## Contents

- [Features](#features)
- [Technology](#technology)
- [Requirements](#requirements)
- [Run locally](#run-locally)
- [Production build](#production-build)
- [Configuration](#configuration)
- [How authentication works](#how-authentication-works)
- [API reference](#api-reference)
- [MongoDB data](#mongodb-data)
- [Project layout](#project-layout)
- [Current scope](#current-scope)
- [Troubleshooting](#troubleshooting)

## Features

- Account registration and sign-in through the backend.
- Server-side password hashing and expiring login sessions.
- A Knowledge Base seeded into MongoDB, with category filtering and keyword search over article titles and categories.
- Article details with step-by-step troubleshooting instructions.
- Ticket creation with title, description, category, and priority validation.
- Ticket lists scoped to the signed-in user and saved persistently in MongoDB.
- Responsive Overview, Knowledge Base, ticket updates, Team Dashboard, Reports, and Settings screens.
- A health endpoint for checking API and database connectivity.

## Technology

| Layer | Technologies |
|---|---|
| Frontend | React, JavaScript, Vite, CSS, Lucide React |
| Backend | Node.js built-in HTTP server, official MongoDB Node.js driver |
| Database | MongoDB |
| Authentication | Scrypt password hashes, random server-side sessions, HttpOnly cookies |

## Requirements

- Node.js 22.9 or later and npm.
- MongoDB running locally or a MongoDB connection URI.
- The MongoDB Node.js driver is installed by the root `npm install` command. Frontend dependencies are installed separately.

The default local connection is `mongodb://127.0.0.1:27017`, using the `fixdesk` database. MongoDB must be running before the FixDesk backend starts.

## Run locally

From the repository root, install dependencies:

```sh
npm install
npm run install:frontend
```

Create a local environment file if you need custom MongoDB or port settings. In PowerShell:

```powershell
Copy-Item .env.example .env
```

Start the backend and frontend together:

```sh
npm run dev
```

Vite prints the frontend URL in the terminal, usually `http://127.0.0.1:5173/`. The Vite `/api` proxy forwards requests to the backend, which listens on port `3001` by default.

On first startup, the backend connects to MongoDB, creates indexes, and seeds the Knowledge Base if the `articles` collection is empty. The login page offers account creation. Register an account before signing in. Accounts created in the earlier browser-only version are not migrated; create a new account in the backend-connected version.

To confirm the API and database are reachable, open:

```text
http://127.0.0.1:3001/api/health
```

A healthy response looks like:

```json
{"status":"ok","database":"connected"}
```

## Production build

Build the frontend and start the integrated server:

```sh
npm run build
npm start
```

The backend serves both the built frontend and `/api` routes on the configured API port. Build the frontend before running `npm start`.

## Configuration

Copy `.env.example` to `.env` and set values for your environment. `.env` is ignored by Git.

| Variable | Default | Purpose |
|---|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017` | MongoDB connection string |
| `MONGODB_DATABASE` | `fixdesk` | Database name |
| `API_PORT` | `3001` | Backend and integrated production server port |
| `API_HOST` | `127.0.0.1` | Backend bind address |
| `TRUST_PROXY` | `false` | Trust the first `X-Forwarded-For` and `X-Forwarded-Proto` values from a trusted reverse proxy |

Example local settings:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DATABASE=fixdesk
API_PORT=3001
API_HOST=127.0.0.1
TRUST_PROXY=false
```

For MongoDB Atlas or another authenticated deployment, put the connection URI in `.env` or inject it through the deployment environment. Do not commit credentials or expose an unauthenticated development MongoDB server publicly.

## How authentication works

1. Registration validates the name, email, and password on the server. Passwords must be 8–128 characters.
2. The backend stores a salted scrypt password hash in MongoDB; it does not store the submitted password.
3. Successful registration or login creates a random session token. The raw token is sent in an HttpOnly, SameSite cookie; only its SHA-256 digest is stored in MongoDB.
4. Sessions expire after seven days. The session collection has a MongoDB TTL index, and each request also checks the expiry time.
5. Sign-out deletes the server session and expires the browser cookie.
6. Login and registration attempts are rate-limited per client IP.

The frontend never stores account passwords or session tokens in local storage. The default local configuration is intended for development. For a public deployment, serve the app over HTTPS, use an authenticated MongoDB account with limited database permissions, configure secrets outside source control, and place the app behind an appropriately configured HTTPS reverse proxy. Set `TRUST_PROXY=true` only when the backend is reachable exclusively through a reverse proxy that sets `X-Forwarded-For` and `X-Forwarded-Proto`; this enables secure cookies and client-IP rate limits behind that proxy.

## API reference

All API routes use JSON. Error responses have the form `{"error":"..."}`. Authenticated routes require the session cookie created by registration or sign-in.

| Method | Route | Authentication | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | No | Check API and MongoDB connectivity |
| `POST` | `/api/auth/register` | No | Create an account and sign in |
| `POST` | `/api/auth/login` | No | Verify credentials and create a session |
| `POST` | `/api/auth/logout` | No | Delete the current session and expire the cookie |
| `GET` | `/api/auth/me` | Yes | Return the current account profile |
| `GET` | `/api/articles` | Yes | List Knowledge Base articles |
| `POST` | `/api/articles` | Agent | Publish a Knowledge Base answer for signed-in users |
| `GET` | `/api/tickets` | Yes | List the signed-in user’s tickets |
| `POST` | `/api/tickets` | Yes | Validate and save a ticket for the signed-in user |
| `GET` | `/api/agent/tickets` | Agent | List tickets across employees with requester details |
| `PATCH` | `/api/agent/tickets/:id` | Agent | Change ticket status; resolving requires a user-visible resolution note |

To resolve a ticket, send `{"status":"Resolved","resolutionNote":"Reinstalled the VPN client and verified the connection stays active."}`. The note must contain 10–2000 characters. It is saved on the ticket and included in the requester’s ticket list and details. Reopening a ticket clears the current resolution note until it is resolved again.

To publish a Knowledge Base answer, send `{"title":"How do I reconnect to the company VPN?","category":"Network & access","answer":"Disconnect from the VPN, confirm your internet connection is working, then reconnect using the company VPN client. If it disconnects again, include the time and error message in a support ticket."}`. Only support agents can publish; titles must be 5–160 characters, answers 20–5000 characters, and categories must match the Knowledge Base categories. New articles are stored in MongoDB and are visible to signed-in users. Open Knowledge base as an agent and choose **Add an article** to publish from the app.

### Support agent accounts

Public registration always creates an employee account. To create a support agent, run this command on the server or a trusted development machine with access to the configured MongoDB database:

```sh
npm run create-agent
```

The command prompts for the agent name, email, and password. Password input is hidden and stored as a salted scrypt hash. Only someone with trusted access to run this command and write to MongoDB can grant agent access. Agents sign in through the same login page; the support dashboard appears for agent accounts. From the dashboard, an agent can move an open ticket into progress, mark it resolved, or reopen it. The employee’s own ticket list includes the updated status and refreshes automatically while signed in.

### Registration request

```json
{
  "name": "Charishma",
  "email": "charishma@example.com",
  "password": "choose-a-password"
}
```

Emails are trimmed and stored in lowercase. Duplicate email addresses return `409 Conflict`. Registration and login return a `user` object and set the session cookie.

### Ticket request

```json
{
  "title": "VPN connection keeps dropping",
  "description": "The VPN disconnects every few minutes while I am working.",
  "category": "Network",
  "priority": "High"
}
```

Allowed ticket categories are `Hardware`, `Network`, `Software`, and `Access`. Allowed priorities are `Low`, `Medium`, and `High`. Titles must be 3–160 characters; descriptions must be 10–5000 characters. New tickets receive an ID, an `Open` status, and timestamps from the backend.

Common response statuses include `200` for successful reads/actions, `201` for a created account or ticket, `400` for invalid data, `401` for missing/invalid authentication, `403` for a disallowed request origin, `409` for duplicate registration, `413` for an oversized request, and `429` for rate limiting.

## MongoDB data

FixDesk uses the following collections in the configured database:

- `users` - name, normalized email, password salt/hash, and account creation time. Email has a unique index.
- `sessions` - hashed session token, user ID, creation time, and expiry time. Expiry has a TTL index.
- `tickets` - ticket ID, owner user ID, title, description, category, priority, status, and timestamps. Ticket lists are queried by owner.
- `articles` - title, category, views label, icon, troubleshooting steps, and step details. The server inserts the bundled articles only when this collection has no documents.

Changing bundled seed articles after the database has already been seeded does not automatically overwrite existing MongoDB records. Articles published by support agents are stored directly in the database.

## Project layout

```text
backend/
  create-agent.js   Interactive setup for trusted support-agent accounts
  dev.js            Starts the API and Vite during development
  server.js         HTTP routes, sessions, MongoDB setup, static hosting
frontend/
  src/App.jsx       Application pages and API integration
  src/App.css       Application and login page styles
  vite.config.js    Development API proxy
shared/
  articles.js       Knowledge Base seed records
.env.example        Local configuration template
package.json        Root scripts and MongoDB driver dependency
README.md           Project setup and API documentation
```

## Current scope

Accounts, sessions, Knowledge Base reads and agent publishing, employee ticket create/list, and agent ticket list/status updates use the backend. The Ticket updates page is generated from real ticket status and resolution data; direct user-to-agent messaging, team-wide metrics, reports, password reset, email verification, comments, attachments, and ticket status history are not yet backed by server APIs.

The backend currently binds to loopback by default. Change `API_HOST` and configure network access deliberately when deploying outside a local machine.

## Troubleshooting

### Backend says MongoDB is unavailable

Make sure the MongoDB service or `mongod` process is running. Check `MONGODB_URI` and confirm the database host and port are reachable. The server exits with a connection error if it cannot connect at startup.

### The page opens, but login or account creation cannot connect

Run the app with `npm run dev` from the repository root so both the API and Vite proxy start. Check that the API is listening on `API_PORT` and inspect `/api/health`. If you changed `API_PORT`, restart the dev command so Vite reloads its proxy configuration.

### Port 3001 is already in use

Stop the other process or set `API_PORT` to another port in `.env`. Restart `npm run dev` after changing it.

### Login fails after creating an account

Use the same email and password used during registration. Email is case-insensitive. If the account was created in the earlier browser-only build, register a new account because browser-only accounts are not copied into MongoDB.

### Frontend build or lint

```sh
npm run build
npm run lint
```
=======
.
>>>>>>> 50a02ef35333ad856631930d1e8e136f0edc9f83
