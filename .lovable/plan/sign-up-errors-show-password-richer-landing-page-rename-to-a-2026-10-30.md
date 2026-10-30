# Sign-up errors, show password, richer landing page, rename to Al-Ghani Station

## 1. Real sign-up error messages
- On sign-up failure, show the actual message from the sign-in service (e.g. "Password is known to be weak and easy to guess, please choose a different one.") instead of "Something went wrong".
- Common cases (weak password, already registered, too many attempts) get translated English + Roman Urdu text; any other error shows the service's own message; generic text only if no message exists.
- Same treatment for sign-in (keep "wrong email or password" for invalid credentials), forgot password and reset password.

## 2. Show/hide password
- Eye icon button inside the password field on Sign in, Sign up and Reset password, with accessible label ("Show password" / "Password dikhayein").

## 3. Detailed landing page
Replace the single card + 3 small cards with full sections:
- Header with logo, language switch, Sign in / Get started.
- Hero: headline, subtext, two buttons, a mock "today's summary" panel (clearly illustrative, labelled as example).
- Problem/solution strip (notebook hisab vs. app).
- Features grid: Shifts & meter readings, Fuel stock & dips, Udhaar, Supplier payables, Expenses & cash closing, Reports, Roles & activity history, English/Roman Urdu.
- "How it works" in 3–4 steps (set up station → run shifts → close cash → view reports).
- Roles section (Owner / Manager / Attendant).
- Trust section (station data isolated, history never deleted).
- FAQ (accordion), final call-to-action, footer.
- Mobile-friendly; existing petrol blue + green style, Outfit/Figtree.

## 4. Rename to "Al-Ghani Station"
- Replace "PumpHisab" everywhere users see it: app name in translations, sidebar/logo, page titles and descriptions, auth/onboarding pages, print headers, README/docs.
- Update project memory with the new name.

## Technical details
- `src/routes/auth.tsx`, `reset-password.tsx`, `forgot-password.tsx`: `authErrorMessage(error, t)` helper in `src/lib/auth-errors.ts` mapping `error.code` (`weak_password`, `user_already_exists`, `over_email_send_rate_limit`, `invalid_credentials`) to i18n keys, falling back to `error.message`; unit test for mapping.
- `FormField` gets an optional password toggle (or new `PasswordField` in `src/components/common`), using lucide Eye/EyeOff.
- New i18n keys in `en.ts`/`ur.ts` (parity test) for landing sections, toggle labels and error messages.
- `src/routes/index.tsx` rewritten; head() updated with new name.
- `rg` sweep of "PumpHisab|Pump Hisab" across `src`, `README.md`, docs; internal identifiers (e.g. storage keys) left unchanged so saved language settings persist.
