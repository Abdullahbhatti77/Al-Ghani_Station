# PumpHisab — Foundation

## What you get
- Sign in, sign out, forgot/reset password, and a first-owner setup that creates your station (name, city, phone, preferred language).
- App shell: collapsible sidebar on desktop, compact menu + thumb-friendly actions on mobile, language switch (English / Roman Urdu) in the header, remembered for next visit.
- Working pages: Aaj ka Khulasa (Dashboard), Shifts, Fuel ka Stock, Customers/Udhaar, Suppliers, Kharchay, Reports, Settings. Non-dashboard modules show friendly "coming next" empty states.
- Dashboard shows a setup checklist while the station is incomplete and clearly labels values as "no data yet" vs real stored values (no fake numbers).
- Settings: edit station details and language.

## Design
Light neutral background, deep petrol teal-blue primary with green accent, large readable numbers, simple tables, visible status badges. Fonts: Outfit (headings) + Figtree (body).

## Backend (Lovable Cloud)
- Enable Cloud, turn on email/password sign-in.
- Tables: `stations`, `profiles` (auto-created on signup), `station_members` (role: owner/manager/staff).
- Row Level Security: users only see stations they belong to; membership checked via a secure helper function. Roles live in the membership table, never on profiles.
- Onboarding uses a secure database function that creates the station + owner membership in one step (client cannot forge membership).

## Localization
- Central dictionaries `en` and `ur` (Roman Urdu) with typed keys — missing keys fail typecheck.
- `I18nProvider` + `useT()` hook; preference saved in localStorage and on the profile.
- All visible strings (nav, forms, validation, toasts, dialogs, empty/loading/error states) via keys.

## Reusable building blocks
PageHeader, DataTable, EmptyState, LoadingState, ErrorState, ConfirmDialog, FormField (react-hook-form + zod with translated errors), StatCard (with "real / empty" state).

## Technical details
- Routes: `/` (landing → redirects signed-in users), `/auth`, `/forgot-password`, `/reset-password`, `_authenticated/onboarding`, `_authenticated/dashboard`, `shifts`, `fuel-stock`, `customers`, `suppliers`, `expenses`, `reports`, `settings`.
- Current station context loaded once in the authenticated layout; users without a membership are sent to onboarding.
- Root `onAuthStateChange` → router invalidate; proper sign-out cache clearing.
- Tests: dictionary key parity (en vs ur), no Urdu-script characters in dictionaries.
- Verification: Playwright run of signup → onboarding → navigate all pages → language switch → mobile viewport; SQL check that a second user cannot read the first station.
- Record architecture rules in AGENTS.md; save language/brand rules to memory.

## Remains for next step
Actual shift, fuel stock, udhaar, supplier, expense and report modules; staff invitations.
