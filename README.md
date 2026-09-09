# EventHub — Event & Ticket Booking (MERN)

A full-stack event discovery and ticket booking application. Organizers can create, edit, delete and track events (including attendee lists); customers can browse/search events, view details, book tickets and cancel bookings. Built with the MERN stack.

---

## Features

**Organizers**
- Create, edit and delete events (category, date/time, location, price, capacity, description)
- Live preview + validation on the create/edit form (custom date parsing to avoid timezone bugs)
- See per-event ticket progress, revenue, and sold-out status
- **Attendee list** per event (populated customer name/email, ticket count, amount paid)

**Customers**
- Browse upcoming events with search and category filters
- Event detail modal with live availability (fetches fresh from the API)
- Book multiple tickets with a quantity stepper + price summary
- My Bookings view with stats, cancel confirmation, and ticket release

**General / Platform**
- JWT auth with role-based access (`ORGANIZER` vs `CUSTOMER`)
- Atomic ticket booking — **overbooking is impossible** (see below)
- Cancellation-safe ticket restore (no double-refunds)
- Helmet security headers, CORS allowlist, brute-force rate limiting on auth
- Session auto-expiry: a `401` clears the stored token and redirects to login

## Tech Stack

| Layer     | Technology                                                        |
| --------- | ----------------------------------------------------------------- |
| Frontend  | React 19, Vite, Tailwind CSS 4, React Router 7, Axios             |
| Backend   | Node.js, Express 5, Mongoose 9                                    |
| Database  | MongoDB (Atlas or local). Transactions require a replica set.     |
| Auth      | bcryptjs (password hashing), jsonwebtoken (JWT)                   |
| Security  | helmet, express-rate-limit, cors allowlist                        |

## Folder Structure

```
event-ticket-booking/
├── backend/
│   ├── src/
│   │   ├── config/db.js                  # MongoDB connection
│   │   ├── controllers/                  # auth, event, booking controllers
│   │   ├── middleware/                   # auth (protect/authorize), rate limiting
│   │   ├── models/                       # User, Event, Booking (Mongoose)
│   │   └── routes/                       # auth, event, booking routes
│   ├── .env.example                      # copy to .env and fill values
│   ├── package.json
└── frontend/
    ├── src/
    │   ├── context/AuthContext.jsx       # session management
    │   ├── pages/                        # Login, Register, OrganizerDashboard, CustomerDashboard
    │   ├── services/api.js               # Axios instance (VITE_API_URL + 401 handling)
    │   └── App.jsx / main.jsx
    ├── .env.example                      # copy to .env (VITE_API_URL)
    └── package.json
```

## Local Setup

### Prerequisites
- Node.js 18+
- MongoDB (local `mongod` or a MongoDB Atlas cluster)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env            # then edit .env with real values
npm run dev                     # nodemon, http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env            # VITE_API_URL=http://localhost:5000/api
npm run dev                     # Vite dev server, http://localhost:5173
```

## Environment Variables

### `backend/.env`
| Variable       | Required | Description                                                        |
| -------------- | -------- | ------------------------------------------------------------------ |
| `MONGO_URI`    | Yes      | MongoDB connection string.                                      |
| `PORT`         | No       | API port (default `5000`).                                      |
| `JWT_SECRET`   | Yes      | Long random string (min 32 chars) used to sign tokens.         |
| `JWT_EXPIRES_IN`| No      | Token lifetime, e.g. `7d` (default `7d`).                       |
| `CORS_ORIGIN`  | No       | Comma-separated allowed frontend origins (default: allow all). |

Generate a strong secret with:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### `frontend/.env`
| Variable        | Description                                                        |
| --------------- | ------------------------------------------------------------------ |
| `VITE_API_URL`  | Backend API base URL, e.g. `http://localhost:5000/api`.          |

## Run Commands

```bash
# Backend (production mode)
cd backend && npm start

# Backend (development, auto-reload)
cd backend && npm run dev

# Frontend (dev server)
cd frontend && npm run dev

# Frontend (production build)
cd frontend && npm run build

# Frontend (lint)
cd frontend && npm run lint
```

## API Endpoint Summary

| Method | Endpoint                          | Access       | Description                             |
| ------ | --------------------------------- | ------------ | --------------------------------------- |
| POST   | `/api/auth/register`              | Public       | Register (role: ORGANIZER/CUSTOMER)     |
| POST   | `/api/auth/login`                 | Public       | Login, returns JWT                      |
| GET    | `/api/auth/me`                    | Authed       | Current user profile                    |
| GET    | `/api/events`                     | Public       | Upcoming events (search + category)     |
| GET    | `/api/events/:id`                 | Public       | Single event details                    |
| GET    | `/api/events/organizer/my-events` | ORGANIZER    | Events created by the organizer         |
| GET    | `/api/events/organizer/attendees/:eventId` | ORGANIZER | Attendee list for own event   |
| POST   | `/api/events`                     | ORGANIZER    | Create event                            |
| PUT    | `/api/events/:id`                 | ORGANIZER    | Update own event                        |
| DELETE | `/api/events/:id`                 | ORGANIZER    | Delete own event (no active bookings)   |
| GET    | `/api/bookings/my-bookings`       | CUSTOMER     | Current user's bookings                 |
| POST   | `/api/events/:id/book`            | CUSTOMER     | Book tickets                            |
| PATCH  | `/api/bookings/:id/cancel`        | CUSTOMER     | Cancel own booking, release tickets     |

Search input is regex-escaped server-side; all `500` responses return generic messages (no internal error text).

## Sample Test Accounts

Create accounts via `POST /api/auth/register` or the Register page. Example roles:

| Role      | Email (placeholder)  | Password (placeholder) |
| --------- | -------------------- | ---------------------- |
| Organizer | organizer@example.com | `test1234`             |
| Customer  | customer@example.com  | `test1234`             |

Replace with real test accounts before sharing the project.

## Booking / Concurrency Design

### No overbooking, ever
Each booking uses a single guarded atomic update:

```
Event.findOneAndUpdate(
  { _id, availableTickets: { $gte: requested } },
  { $inc: { availableTickets: -requested } }
)
```

MongoDB executes the update as one atomic operation against the guard, so two concurrent bookings can never both succeed when only one ticket remains, `availableTickets` can never go negative, and it can never exceed `totalTickets`.

### Consistency
On Atlas (replica set), the decrement **and** the `Booking` document creation run inside a **MongoDB transaction** (`session.withTransaction`). If the booking record fails to persist, the decrement rolls back — no tickets are lost.

On a standalone `mongod` (no replica set), transactions are not supported, so the code automatically falls back to the same guarded atomic update plus a compensation update that restores the decrement if creating the booking record fails.

### Cancellation safety
Cancelling uses a conditional atomic update:

```
Booking.findOneAndUpdate(
  { _id, bookingStatus: "CONFIRMED" },
  { bookingStatus: "CANCELLED" }
)
```

Only the request that flips `CONFIRMED → CANCELLED` restores the tickets, so tickets can **never be restored twice** (e.g. double-tapped cancel or concurrent cancels). The status change and ticket restore happen in one transaction when a replica set is available.

## Future Deployment (documentation only — do not deploy yet)

1. **Secrets first**: rotate any credentials that ever existed in repo history; set fresh `MONGO_URI`, `JWT_SECRET`, `CORS_ORIGIN` in the host's environment (never in the repo).
2. **Backend**: run with a process manager (e.g. PM2) or a container; set `NODE_ENV=production`, `PORT`, and the env vars above. Consider `helmet` defaults already on.
3. **Frontend**: `npm run build` → serve `frontend/dist` from any static host (nginx, Vercel, Netlify, S3+CloudFront). Set `VITE_API_URL` to the deployed API origin at build time.
4. **Reverse proxy / TLS**: terminate HTTPS at a proxy; add request logging + monitoring.
5. **Database**: use Atlas (or a replica set) so booking transactions are active.
6. **Rate limiting**: adjust `backend/src/middleware/rateLimiter.js` limits for production traffic if needed.
7. No CI/CD or hosted deployment is configured in this repository.