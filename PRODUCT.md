# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Four audiences, confirmed by the owner:
- **Admin klinik**: records daily recaps (pasien, sesi, pembayaran, paket), mostly on a phone at the front desk.
- **Fisioterapis**: logs therapy sessions and medical records for their patients.
- **Owner**: monitors finances, reports, and clinic performance.
- **Pasien / publik**: visits the clinic landing pages for services and information.

## Product Purpose

Kaffah Physiotherapy is the all-in-one operating app for a physiotherapy clinic: daily recap and payments, therapy packages, medical records, owner reporting, and public clinic pages in a single product.

## Positioning

One app covers the whole clinic workflow (recap, payments, packages, medical records, referral rewards, WhatsApp, owner finance) instead of separate tools per task. Confirmed by the owner as the differentiator.

## Operating Context

[Inferred from the repository, not yet confirmed] Role-based dashboards (admin, therapist, owner, superadmin), Supabase backend, deployed on Vercel, installable as a PWA. Forms such as the daily recap modal are used heavily on mobile screens.

## Capabilities and Constraints

- React + Vite + Tailwind, Supabase, Vercel (from the codebase).
- UI language is Bahasa Indonesia [inferred from existing copy].
- Medical and payment data are sensitive; role-based access exists [inferred]. Platform and constraint questions were left without a stated preference, so no further constraints are recorded.

## Product Principles

- Mobile-first: every form must stay aligned and usable on a phone screen.
- One workflow per role; do not mix admin, therapist, and owner concerns on one screen.
- Keep Bahasa Indonesia copy short and consistent.
- Existing copy and behavior are preserved during refinement.
