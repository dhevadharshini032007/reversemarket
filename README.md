# ReverseMarket

ReverseMarket is a React + Vite campus marketplace demo backed by an Express + SQLite API in `server/`. Users, seller profiles, requirements, offers, and counter-offers are stored in SQLite; the JWT session is stored in sessionStorage so separate tabs can use different accounts. The database seeds the demo records on first run. The Vite development server proxies `/api` to the backend.

## Run locally

1. Install Node.js 20.19+ or 22.12+ and npm.
2. Run `npm install`.
3. Run `npm run dev`. This starts the Express API and Vite together; open the Local URL Vite prints in the terminal.

Vite also prints a Network URL such as `http://192.168.1.23:5173/`. To find the laptop's Wi-Fi IP manually on Windows, run `ipconfig` and look for the IPv4 Address under the connected Wi-Fi adapter. On your phone, join the same Wi-Fi network and open `http://<laptop-ip>:5173/` in its browser. If Windows Firewall prompts you, allow Node.js on Private networks so the phone can connect.

Use these demo accounts on the login page:

- Admin: `admin@demo.com` / `Admin2026`
- Buyers: `ananya@demo.com` and `karthik@demo.com` / `Demo2026`
- Approved sellers: `meera@demo.com`, `arjun@demo.com`, and `priya@demo.com` / `Demo2026`
- Pending seller: `ravi@demo.com` / `Demo2026`

## Run the API

The API listens on `http://127.0.0.1:3001`; its SQLite database is created at `server/data/reversemarket.sqlite` and seeded on first run. The database file lives in `server/data/` and is ignored by Git. Set `JWT_SECRET` before starting if you need a non-demo signing key, or set `DATABASE_PATH` to choose another database file.

With the API running, `npm run test:server` exercises authentication, role and ownership checks, requirements, offers, shortlist, counter-offers, acceptance, contact access, seller approval, and demo reset. The demo reset endpoint is admin-only and restores the seed records.

API routes are under `/api`: `/auth/signup`, `/auth/login`, `/requirements`, `/requirements/:id/offers`, `/offers/mine`, `/offers/:id/shortlist`, `/offers/:id/accept`, `/offers/:id/counter-offers`, `/counter-offers/mine`, `/admin/sellers`, and `/admin/reset-demo-data`. Send the JWT returned by login as `Authorization: Bearer <token>` for protected routes.

The admin dashboard can approve or reject seller applications and reset the SQLite demo data. New seller accounts remain pending until approved. Passwords are hashed with bcrypt on the server.

## Marketplace behavior

- Buyers can create, edit, and cancel requirements, compare scored and ranked offers, adjust priorities, shortlist offers, accept an offer, and view contact details for the resulting deal.
- Buyers can submit counter-offers for shortlisted offers. Approved sellers can accept or decline them, edit offers, or withdraw offers while a requirement is open.
- Requirement, comparison, seller board, and offer views poll the API every three seconds to pick up activity from other tabs.
- The local demo JWT fallback is for development. Configure `JWT_SECRET` appropriately before exposing the API beyond a trusted development machine.
