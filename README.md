# ReverseMarket

ReverseMarket is a React + Vite campus marketplace demo. Users, seller profiles, requirements, offers, and counter-offers are stored in this browser's localStorage; the signed-in session uses sessionStorage so separate tabs can use different accounts. Data is seeded automatically the first time the app opens. No server, API key, or internet connection is needed after dependencies are installed.

## Run locally

1. Install Node.js 20.19+ or 22.12+ and npm.
2. Run `npm install`.
3. Run `npm run dev` and open the local URL printed by Vite.

Use these demo accounts on the login page:

- Admin: `admin@demo.com` / `Admin2026`
- Buyers: `ananya@demo.com` and `karthik@demo.com` / `Demo2026`
- Approved sellers: `meera@demo.com`, `arjun@demo.com`, and `priya@demo.com` / `Demo2026`
- Pending seller: `ravi@demo.com` / `Demo2026`

The admin dashboard can approve or reject seller applications and reset the browser's demo data. New seller accounts remain pending until approved. Passwords are salted and hashed with Web Crypto SHA-256 before they are stored.

## Marketplace behavior

- Buyers can create, edit, and cancel requirements, compare scored and ranked offers, adjust priorities, shortlist offers, accept an offer, and view contact details for the resulting deal.
- Buyers can submit counter-offers for shortlisted offers. Approved sellers can accept or decline them, edit offers, or withdraw offers while a requirement is open.
- Updates in another tab are reflected through the browser `storage` event.
- The demo data is local to one browser profile and is not a secure production authentication or database system.
