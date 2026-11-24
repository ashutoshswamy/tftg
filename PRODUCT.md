# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Staff (primary):** dispatchers and admins at one freight company, working at a desk on large desktop monitors for hours, in an office with daylight. They create shipments, assign carriers/drivers, watch status, issue invoices, and manage the team.
- **Customers (secondary, no login):** receive a tracking code or link; want to know where their freight is and when it arrives. Often on a phone, checking once or twice.
- **Drivers (secondary, no login):** open a tokenized link on a phone in a truck cab; tap status buttons, upload a proof-of-delivery photo, share live location. Big touch targets, glanceable, one-handed.
- **Invoice recipients (no login):** open a tokenized link to read and download an invoice.

## Product Purpose

Too Far To Go (TFTG) is an internal Transportation Management System for a single freight company. It replaces spreadsheets: one reusable directory (parties, locations, drivers, vehicles), shipments across every mode (road, rail, air, ocean, courier), live tracking, proof of delivery, and invoicing with dynamic currency and tax. Success: dispatch can see every active shipment and its state at a glance, customers stop phoning to ask where freight is, invoices go out correct.

## Positioning

Built for one company's real workflow, not a generic SaaS. Customers and drivers get a tracking page with no account (tracking code or tokenized link), which most TMS tools gate behind logins.

## Operating Context

- Single-tenant: one company, staff invited by an admin through the app's own membership and invite flow (Clerk handles sign-in only).
- Roles: admin, dispatcher.
- Freight modes: road, rail, air, ocean, courier. Shipment statuses: pending, assigned, in transit, delivered, cancelled.
- Money is integer minor units; currency and tax are set globally or per shipment and snapshot onto invoices.
- Stack already built: Next.js 16 (App Router, Proxy), React 19, Tailwind CSS 4, Supabase (service-role server access), Clerk (auth), pdf-lib (invoice PDF). Invoice PDF is drawn by hand with Helvetica.

## Capabilities and Constraints

- Staff pages: dashboard, shipments (list, create, detail, edit), directory/parties, invoices (list, draft editor, finalize), settings (company, tax rates), organization (members, invites).
- Public pages: `/track`, `/t/[token]`, `/d/[token]`, `/i/[token]`; auth pages: `/login`, `/signup`, `/create-company`, `/accept-invite/[token]`, `/not-invited`.
- Live GPS uses a keyless Google Maps embed iframe; no map library.
- Clerk renders `<SignIn>` / `<SignUp>` widgets on login and signup (their appearance is themeable through Clerk's `appearance` prop).
- Not built yet: dispatch board (nav links to `/dispatch`), locations CRUD, edit/archive parties.
- Undecided: logo and brand colors (none exist), email sending, mobile staff app.

## Brand Commitments

- Product name: **Too Far To Go**, short form **TFTG**. Brand colors come from the logo: navy `#0d1829`, orange `#ff7a00`, white.

## Evidence on Hand

No customer logos, testimonials, photography, or case studies exist. None may be fabricated.

## Product Principles

1. **State over decoration.** Every screen answers "what is the status and what is next" before anything else.
2. **One home for each fact.** Parties, locations, and rates are entered once and reused; the UI should make reuse faster than retyping.
3. **Public pages work on a bad phone in a truck.** Big targets, one thumb, glanceable, no account.
4. **Tokens are the only door for outsiders.** Customer and driver views never show internal data (notes, rates, margins).

## Accessibility & Inclusion

Staff read dense tables for hours: WCAG AA contrast minimum, visible focus, keyboard-operable forms and tables, `prefers-reduced-motion` respected. Driver page must be usable one-handed and in sunlight.
